import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";

import { publicStoreTemplates } from "@/lib/catalog";
import { imageReferenceSchema } from "@/lib/image-upload-contract";
import {
  deletePromotedImages,
  deletePromotedTemporaries,
  resolveImageReferences,
  type PromotedImage
} from "@/lib/image-uploads";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { prisma } from "@/lib/prisma";
import { publicPageConfigSchema } from "@/lib/public-page-config";
import { designConfigSchema } from "@/lib/design-config";
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
  favicon: imageReferenceSchema.nullable(),
  designConfig: designConfigSchema,
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(220).optional().nullable(),
  heroImages: z.array(imageReferenceSchema).max(3).default([]),
  categoryImages: z
    .array(z.object({ categoryId: z.string().min(1), image: imageReferenceSchema.nullable() }))
    .max(0)
    .default([]),
  address: z.string().max(180).optional().nullable(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  useTemplateColors: z.boolean().default(false),
  template: z.enum(publicStoreTemplates),
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
  const access = await getMerchantApiAccess("settings");
  if (access.error) return access.error;
  const { store } = access.context;

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

  const nextSlug = store.slug;

  const previousLogoUrl = store.logoUrl;
  const previousFaviconUrl = store.faviconUrl;
  const previousHeroUrls = store.heroImageUrls;
  const savedDraft = store.designDraft && typeof store.designDraft === "object" && !Array.isArray(store.designDraft) ? store.designDraft as Record<string, unknown> : {};
  const draftLogoUrl = typeof savedDraft.logoUrl === "string" ? savedDraft.logoUrl : null;
  const draftFaviconUrl = typeof savedDraft.faviconUrl === "string" ? savedDraft.faviconUrl : null;
  const draftHeroUrls = Array.isArray(savedDraft.heroImageUrls) ? savedDraft.heroImageUrls.filter((url): url is string => typeof url === "string") : [];
  const previousCategoryImages = new Map(categoriesForUpdate.map((category) => [category.id, category.imageUrl]));
  const nextCategoryImages = new Map(previousCategoryImages);
  let nextLogoUrl: string | null = null;
  let nextFaviconUrl: string | null = null;
  let nextHeroUrls: string[] = [];
  const promotedImages: PromotedImage[] = [];

  try {
    if (result.data.logo) {
      const resolvedLogo = await resolveImageReferences({
        storeId: store.id,
        scope: "logos",
        references: [result.data.logo],
        allowedStoredUrls: [previousLogoUrl, draftLogoUrl].filter((url): url is string => Boolean(url))
      });
      nextLogoUrl = resolvedLogo.urls[0] ?? null;
      promotedImages.push(...resolvedLogo.promoted);
    }
    if (result.data.favicon) {
      const resolvedFavicon = await resolveImageReferences({ storeId: store.id, scope: "logos", references: [result.data.favicon], allowedStoredUrls: [previousFaviconUrl, draftFaviconUrl].filter((url): url is string => Boolean(url)) });
      nextFaviconUrl = resolvedFavicon.urls[0] ?? null;
      promotedImages.push(...resolvedFavicon.promoted);
    }

    const resolvedHero = await resolveImageReferences({
      storeId: store.id,
      scope: "hero",
      references: result.data.heroImages,
      allowedStoredUrls: [...previousHeroUrls, ...draftHeroUrls]
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
    console.error("[image-upload] Failed to promote store images", error);
    return NextResponse.json({ error: "No pudimos procesar las imágenes. Intentá nuevamente." }, { status: 400 });
  }

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
          faviconUrl: nextFaviconUrl,
          designConfig: result.data.designConfig,
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
          businessHoursText: cleanOptionalText(result.data.businessHoursText),
          restrictBySchedule: result.data.restrictBySchedule,
          businessHours,
          mobileProductColumns: result.data.mobileProductColumns,
          designDraft: Prisma.DbNull
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
  if (previousLogoKey?.startsWith(`logos/${store.id}/`) && previousLogoUrl !== nextFaviconUrl) {
    await deletePublicObject(previousLogoKey).catch(() => null);
  }
  const previousFaviconKey = previousFaviconUrl && previousFaviconUrl !== nextFaviconUrl && previousFaviconUrl !== nextLogoUrl ? getPublicObjectKeyFromUrl(previousFaviconUrl) : null;
  if (previousFaviconKey?.startsWith(`logos/${store.id}/`)) await deletePublicObject(previousFaviconKey).catch(() => null);

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
