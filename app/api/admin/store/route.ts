import { NextResponse } from "next/server";
import { z } from "zod";

import { storeTemplates } from "@/lib/catalog";
import { imageReferenceSchema } from "@/lib/image-upload-contract";
import {
  deletePromotedImages,
  deletePromotedTemporaries,
  resolveImageReferences,
  type PromotedImage
} from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { publicPageConfigSchema } from "@/lib/public-page-config";
import { reservedSlugs, slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";
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
  logo: imageReferenceSchema.nullable(),
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(220).optional().nullable(),
  heroImages: z.array(imageReferenceSchema).max(3).default([]),
  categoryImages: z
    .array(z.object({ categoryId: z.string().min(1), image: imageReferenceSchema.nullable() }))
    .default([]),
  address: z.string().max(180).optional().nullable(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  useTemplateColors: z.boolean().default(false),
  template: z.enum(storeTemplates),
  publicPageConfig: publicPageConfigSchema,
  showCategories: z.boolean().default(true),
  showFeatured: z.boolean().default(true),
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

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function PATCH(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const categoryIds = result.data.categoryImages.map(({ categoryId }) => categoryId);
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
  let nextLogoUrl: string | null = null;
  let nextHeroUrls: string[] = [];
  const promotedImages: PromotedImage[] = [];

  try {
    if (result.data.logo) {
      const resolvedLogo = await resolveImageReferences({
        storeId: store.id,
        scope: "logos",
        references: [result.data.logo],
        allowedStoredUrls: previousLogoUrl ? [previousLogoUrl] : []
      });
      nextLogoUrl = resolvedLogo.urls[0] ?? null;
      promotedImages.push(...resolvedLogo.promoted);
    }

    const resolvedHero = await resolveImageReferences({
      storeId: store.id,
      scope: "hero",
      references: result.data.heroImages,
      allowedStoredUrls: previousHeroUrls
    });
    nextHeroUrls = resolvedHero.urls;
    promotedImages.push(...resolvedHero.promoted);

    for (const { categoryId, image } of result.data.categoryImages) {
      if (!image) {
        nextCategoryImages.set(categoryId, null);
        continue;
      }
      const previousImage = previousCategoryImages.get(categoryId);
      const resolvedCategory = await resolveImageReferences({
        storeId: store.id,
        scope: "categories",
        references: [image],
        allowedStoredUrls: previousImage ? [previousImage] : []
      });
      nextCategoryImages.set(categoryId, resolvedCategory.urls[0] ?? null);
      promotedImages.push(...resolvedCategory.promoted);
    }
  } catch (error) {
    await deletePromotedImages(promotedImages);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron validar las imágenes." }, { status: 400 });
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
          template: result.data.template,
          publicPageConfig: result.data.publicPageConfig,
          showCategories: result.data.showCategories,
          showFeatured: result.data.showFeatured,
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
    await deletePromotedImages(promotedImages);
    throw error;
  }

  await deletePromotedTemporaries(promotedImages);

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
  const removedKeys = [
    ...removedHeroKeys,
    ...removedCategoryKeys
  ];
  await Promise.all(removedKeys.map((key) => deletePublicObject(key).catch(() => null)));

  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ store: updated, categories });
}
