import { NextResponse } from "next/server";
import { z } from "zod";

import { BusinessType } from "@/lib/generated/prisma/enums";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { reservedSlugs, slugify } from "@/lib/slug";
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

export async function PATCH(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
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

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      name: result.data.name,
      slug: nextSlug,
      description: result.data.description,
      whatsappPhone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
      businessType: result.data.businessType,
      logoUrl: result.data.logoUrl || null,
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

  return NextResponse.json({ store: updated });
}
