import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

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
  description: z.string().max(500).optional().nullable(),
  whatsappPhone: z.string().refine(isCompleteArgentineLocalPhone),
  logoUrl: z.string().url().optional().or(z.literal("")),
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(220).optional().nullable(),
  heroImageUrls: z.array(z.string().url()).max(3).default([]),
  address: z.string().max(180).optional().nullable(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  useTemplateColors: z.boolean().default(false),
  showCategories: z.boolean().default(true),
  freeShippingEnabled: z.boolean().default(false),
  freeShippingThreshold: z.coerce.number().int().min(0).max(999999999).default(35000),
  acceptTransferPayments: z.boolean().default(false),
  paymentAccountHolder: z.string().max(120).optional().nullable(),
  paymentProvider: z.string().max(120).optional().nullable(),
  paymentAlias: z.string().max(120).optional().nullable(),
  paymentCbu: z.string().max(30).optional().nullable(),
  businessHoursText: z.string().max(300).optional().nullable(),
  restrictBySchedule: z.boolean().default(false),
  businessHours: z.unknown().default(emptyBusinessHours()),
  mobileProductColumns: z.coerce.number().int().refine((value) => value === 1 || value === 2)
});

const imageExtensionsByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

type CategoryImageUpload = {
  categoryId: string;
  file: File;
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
      logoFile: null as File | null,
      heroFiles: [] as File[],
      categoryFiles: [] as CategoryImageUpload[]
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { body: null, logoFile: null as File | null, heroFiles: [] as File[], categoryFiles: [] as CategoryImageUpload[] };
  }

  const logoFile = formData.get("logoFile");
  const heroFiles = formData.getAll("heroFiles").filter((file): file is File => file instanceof File && file.size > 0);
  const categoryFileIds = parseFormJson(formData, "categoryFileIds", []);
  const categoryFileIdList = Array.isArray(categoryFileIds) ? categoryFileIds : [];
  const categoryFiles = formData
    .getAll("categoryFiles")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .map((file, index) => ({ categoryId: typeof categoryFileIdList[index] === "string" ? categoryFileIdList[index] : "", file }));
  return {
    body: {
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      whatsappPhone: getFormString(formData, "whatsappPhone"),
      logoUrl: getFormString(formData, "logoUrl") ?? "",
      heroTitle: getFormString(formData, "heroTitle"),
      heroSubtitle: getFormString(formData, "heroSubtitle"),
      heroImageUrls: parseFormJson(formData, "heroImageUrls", []),
      address: getFormString(formData, "address"),
      primary: getFormString(formData, "primary"),
      accent: getFormString(formData, "accent"),
      useTemplateColors: getFormBoolean(formData, "useTemplateColors"),
      showCategories: getFormBoolean(formData, "showCategories"),
      freeShippingEnabled: getFormBoolean(formData, "freeShippingEnabled"),
      freeShippingThreshold: getFormString(formData, "freeShippingThreshold"),
      acceptTransferPayments: getFormBoolean(formData, "acceptTransferPayments"),
      paymentAccountHolder: getFormString(formData, "paymentAccountHolder"),
      paymentProvider: getFormString(formData, "paymentProvider"),
      paymentAlias: getFormString(formData, "paymentAlias"),
      paymentCbu: getFormString(formData, "paymentCbu"),
      businessHoursText: getFormString(formData, "businessHoursText"),
      restrictBySchedule: getFormBoolean(formData, "restrictBySchedule"),
      businessHours: parseFormJson(formData, "businessHours", emptyBusinessHours()),
      mobileProductColumns: getFormString(formData, "mobileProductColumns")
    },
    logoFile: logoFile instanceof File && logoFile.size > 0 ? logoFile : null,
    heroFiles,
    categoryFiles
  };
}

function validateImageFile(file: File, label: string) {
  if (!file.type.startsWith("image/") || !imageExtensionsByType[file.type]) {
    return `Formato de ${label} no soportado.`;
  }
  if (file.size > 6 * 1024 * 1024) {
    return `Cada archivo de ${label} no puede superar 6 MB.`;
  }
  return null;
}

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function PATCH(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { body, logoFile, heroFiles, categoryFiles } = await parseSettingsPayload(request);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const logoError = logoFile ? validateImageFile(logoFile, "logo") : null;
  if (logoError) {
    return NextResponse.json({ error: logoError }, { status: 400 });
  }
  for (const file of heroFiles) {
    const heroError = validateImageFile(file, "hero");
    if (heroError) {
      return NextResponse.json({ error: heroError }, { status: 400 });
    }
  }
  for (const { file } of categoryFiles) {
    const categoryError = validateImageFile(file, "categoría");
    if (categoryError) {
      return NextResponse.json({ error: categoryError }, { status: 400 });
    }
  }
  if (result.data.heroImageUrls.length + heroFiles.length > 3) {
    return NextResponse.json({ error: "El máximo es 3 imágenes para el hero." }, { status: 400 });
  }

  const categoryIds = categoryFiles.map(({ categoryId }) => categoryId);
  if (categoryIds.some((categoryId) => !categoryId) || new Set(categoryIds).size !== categoryIds.length) {
    return NextResponse.json({ error: "No se pudieron identificar las categorías." }, { status: 400 });
  }
  const categoriesForUpdate = categoryIds.length
    ? await prisma.category.findMany({ where: { storeId: store.id, id: { in: categoryIds } } })
    : [];
  if (categoriesForUpdate.length !== categoryIds.length) {
    return NextResponse.json({ error: "Una de las categorías no pertenece a esta tienda." }, { status: 400 });
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
  const previousHeroUrls = store.heroImageUrls;
  const previousCategoryImages = new Map(categoriesForUpdate.map((category) => [category.id, category.imageUrl]));
  const nextCategoryImages = new Map(previousCategoryImages);
  let nextLogoUrl = result.data.logoUrl || null;
  let nextHeroUrls = result.data.heroImageUrls;
  const uploadedKeys: string[] = [];

  try {
    if (logoFile) {
      const extension = imageExtensionsByType[logoFile.type];
      const key = `logos/${store.id}/${randomUUID()}.${extension}`;
      nextLogoUrl = await uploadPublicObject({
        key,
        body: Buffer.from(await logoFile.arrayBuffer()),
        contentType: logoFile.type
      });
      uploadedKeys.push(key);
    }

    for (const file of heroFiles) {
      const extension = imageExtensionsByType[file.type];
      const key = `hero/${store.id}/${randomUUID()}.${extension}`;
      const url = await uploadPublicObject({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
      uploadedKeys.push(key);
      nextHeroUrls = [...nextHeroUrls, url].slice(0, 3);
    }

    for (const { categoryId, file } of categoryFiles) {
      const extension = imageExtensionsByType[file.type];
      const key = `categories/${store.id}/${randomUUID()}.${extension}`;
      const url = await uploadPublicObject({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
      uploadedKeys.push(key);
      nextCategoryImages.set(categoryId, url);
    }
  } catch {
    await Promise.all(uploadedKeys.map((key) => deletePublicObject(key).catch(() => null)));
    return NextResponse.json({ error: "No se pudieron subir las imágenes." }, { status: 500 });
  }

  const paymentValues = result.data.acceptTransferPayments
    ? {
        paymentAccountHolder: cleanOptionalText(result.data.paymentAccountHolder),
        paymentProvider: cleanOptionalText(result.data.paymentProvider),
        paymentAlias: cleanOptionalText(result.data.paymentAlias),
        paymentCbu: cleanOptionalText(result.data.paymentCbu)
      }
    : {
        paymentAccountHolder: store.paymentAccountHolder,
        paymentProvider: store.paymentProvider,
        paymentAlias: store.paymentAlias,
        paymentCbu: store.paymentCbu
      };

  let updated;
  try {
    updated = await prisma.$transaction(async (transaction) => {
      const updatedStore = await transaction.store.update({
        where: { id: store.id },
        data: {
          name: result.data.name,
          slug: nextSlug,
          description: cleanOptionalText(result.data.description),
          whatsappPhone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
          logoUrl: nextLogoUrl,
          heroTitle: cleanOptionalText(result.data.heroTitle),
          heroSubtitle: cleanOptionalText(result.data.heroSubtitle),
          heroImageUrls: nextHeroUrls,
          address: cleanOptionalText(result.data.address),
          theme: { primary: result.data.primary, accent: result.data.accent, font: "Inter", useTemplateColors: result.data.useTemplateColors },
          showCategories: result.data.showCategories,
          freeShippingEnabled: result.data.freeShippingEnabled,
          freeShippingThreshold: result.data.freeShippingThreshold,
          acceptTransferPayments: result.data.acceptTransferPayments,
          ...paymentValues,
          businessHoursText: cleanOptionalText(result.data.businessHoursText),
          restrictBySchedule: result.data.restrictBySchedule,
          businessHours,
          mobileProductColumns: result.data.mobileProductColumns
        }
      });

      for (const category of categoriesForUpdate) {
        const imageUrl = nextCategoryImages.get(category.id);
        if (imageUrl !== category.imageUrl) {
          await transaction.category.update({ where: { id: category.id }, data: { imageUrl } });
        }
      }

      return updatedStore;
    });
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => deletePublicObject(key).catch(() => null)));
    throw error;
  }

  const previousLogoKey = previousLogoUrl && nextLogoUrl !== previousLogoUrl ? getPublicObjectKeyFromUrl(previousLogoUrl) : null;
  if (previousLogoKey?.startsWith(`logos/${store.id}/`)) {
    await deletePublicObject(previousLogoKey).catch(() => null);
  }

  const removedHeroKeys = previousHeroUrls
    .filter((url) => !nextHeroUrls.includes(url))
    .map(getPublicObjectKeyFromUrl)
    .filter((key): key is string => Boolean(key?.startsWith(`hero/${store.id}/`)));
  const removedCategoryKeys = categoriesForUpdate
    .map((category) => {
      const previousImageUrl = previousCategoryImages.get(category.id);
      const nextImageUrl = nextCategoryImages.get(category.id);
      return previousImageUrl && previousImageUrl !== nextImageUrl ? getPublicObjectKeyFromUrl(previousImageUrl) : null;
    })
    .filter((key): key is string => Boolean(key?.startsWith(`categories/${store.id}/`)));
  await Promise.all([...removedHeroKeys, ...removedCategoryKeys].map((key) => deletePublicObject(key).catch(() => null)));

  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ store: updated, categories });
}
