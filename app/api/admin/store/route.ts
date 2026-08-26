import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { BusinessType } from "@/lib/generated/prisma/enums";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { reservedSlugs, slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl, uploadPublicObject } from "@/lib/storage";
import {
  emptyBusinessHours,
  isCompleteArgentineLocalPhone,
  normalizeArgentineWhatsAppPhone,
  normalizeBusinessHours
} from "@/lib/store-settings";

const schema = z.object({
  name: z.string().min(2).max(90),
  description: z.string().max(500).optional(),
  whatsappPhone: z.string().refine(isCompleteArgentineLocalPhone),
  businessType: z.nativeEnum(BusinessType),
  logoUrl: z.string().url().optional().or(z.literal("")),
  heroTitle: z.string().max(120).optional(),
  heroSubtitle: z.string().max(220).optional(),
  address: z.string().max(180).optional(),
  template: z.enum(["market", "quick-menu", "premium"]).default("market"),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  paymentAccountHolder: z.string().max(120).optional(),
  paymentProvider: z.string().max(120).optional(),
  paymentAlias: z.string().max(120).optional(),
  paymentCbu: z.string().max(30).optional(),
  restrictBySchedule: z.boolean().default(false),
  businessHours: z.unknown().default(emptyBusinessHours()),
  mobileProductColumns: z.coerce.number().int().refine((value) => value === 1 || value === 2)
});

const logoExtensionsByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function getFormBoolean(formData: FormData, key: string) {
  return getFormString(formData, key) === "true";
}

function parseFormJson(formData: FormData, key: string, fallback: unknown) {
  const value = getFormString(formData, key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function parseSettingsPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      body: await request.json().catch(() => null),
      logoFile: null as File | null
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { body: null, logoFile: null as File | null };
  }

  const logoFile = formData.get("logoFile");
  return {
    body: {
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      whatsappPhone: getFormString(formData, "whatsappPhone"),
      businessType: getFormString(formData, "businessType"),
      logoUrl: getFormString(formData, "logoUrl") ?? "",
      heroTitle: getFormString(formData, "heroTitle"),
      heroSubtitle: getFormString(formData, "heroSubtitle"),
      address: getFormString(formData, "address"),
      template: getFormString(formData, "template"),
      primary: getFormString(formData, "primary"),
      accent: getFormString(formData, "accent"),
      paymentAccountHolder: getFormString(formData, "paymentAccountHolder"),
      paymentProvider: getFormString(formData, "paymentProvider"),
      paymentAlias: getFormString(formData, "paymentAlias"),
      paymentCbu: getFormString(formData, "paymentCbu"),
      restrictBySchedule: getFormBoolean(formData, "restrictBySchedule"),
      businessHours: parseFormJson(formData, "businessHours", emptyBusinessHours()),
      mobileProductColumns: getFormString(formData, "mobileProductColumns")
    },
    logoFile: logoFile instanceof File && logoFile.size > 0 ? logoFile : null
  };
}

function validateLogoFile(file: File) {
  if (!file.type.startsWith("image/") || !logoExtensionsByType[file.type]) {
    return "Formato de logo no soportado.";
  }

  if (file.size > 6 * 1024 * 1024) {
    return "El logo no puede superar 6 MB.";
  }

  return null;
}

export async function PATCH(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { body, logoFile } = await parseSettingsPayload(request);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (logoFile) {
    const logoError = validateLogoFile(logoFile);
    if (logoError) {
      return NextResponse.json({ error: logoError }, { status: 400 });
    }
  }

  let businessHours;
  try {
    businessHours = normalizeBusinessHours(result.data.businessHours);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Horarios inválidos" }, { status: 400 });
  }

  const nextSlug = slugify(result.data.name);
  if (!nextSlug || reservedSlugs.has(nextSlug)) {
    return NextResponse.json({ error: "El nombre no genera una URL disponible." }, { status: 400 });
  }

  const slugOwner = await prisma.store.findUnique({ where: { slug: nextSlug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== store.id) {
    return NextResponse.json({ error: "Ya existe una tienda con esa URL." }, { status: 409 });
  }

  const previousLogoUrl = store.logoUrl;
  let nextLogoUrl = result.data.logoUrl || null;
  let uploadedLogoKey: string | null = null;
  if (logoFile) {
    try {
      const extension = logoExtensionsByType[logoFile.type];
      uploadedLogoKey = `logos/${store.id}/${randomUUID()}.${extension}`;
      nextLogoUrl = await uploadPublicObject({
        key: uploadedLogoKey,
        body: Buffer.from(await logoFile.arrayBuffer()),
        contentType: logoFile.type
      });
    } catch {
      return NextResponse.json({ error: "No se pudo subir el logo." }, { status: 500 });
    }
  }

  let updated;
  try {
    updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: result.data.name,
        slug: nextSlug,
        description: result.data.description,
        whatsappPhone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
        businessType: result.data.businessType,
        logoUrl: nextLogoUrl,
        heroTitle: result.data.heroTitle,
        heroSubtitle: result.data.heroSubtitle,
        address: result.data.address,
        template: result.data.template,
        theme: {
          primary: result.data.primary,
          accent: result.data.accent,
          font: "Inter"
        },
        paymentAccountHolder: result.data.paymentAccountHolder?.trim() || null,
        paymentProvider: result.data.paymentProvider?.trim() || null,
        paymentAlias: result.data.paymentAlias?.trim() || null,
        paymentCbu: result.data.paymentCbu?.trim() || null,
        restrictBySchedule: result.data.restrictBySchedule,
        businessHours,
        mobileProductColumns: result.data.mobileProductColumns
      }
    });
  } catch (error) {
    if (uploadedLogoKey) {
      await deletePublicObject(uploadedLogoKey).catch(() => null);
    }
    throw error;
  }

  if (previousLogoUrl && nextLogoUrl !== previousLogoUrl) {
    const previousLogoKey = getPublicObjectKeyFromUrl(previousLogoUrl);
    if (previousLogoKey?.startsWith(`logos/${store.id}/`)) {
      await deletePublicObject(previousLogoKey).catch(() => null);
    }
  }

  return NextResponse.json({ store: updated });
}
