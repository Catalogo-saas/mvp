import { z } from "zod";

import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildProductSlug } from "@/lib/product-slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";
import { variantCombinationSchema, variantCombinations } from "@/lib/product-variants";
import type { VariantCombination } from "@/lib/product-variants";

const nullableStockQuantity = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).replace(/\D/g, "");
  return normalized ? Number(normalized) : null;
}, z.number().int().min(0).max(999999).nullable());

const optionGroupSchema = z.object({
  name: z.string().min(1).max(60),
  selectionType: z.literal("SINGLE"),
  isRequired: z.literal(true),
  maxSelections: z.literal(1),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        priceDelta: z.union([z.literal(0), z.literal("0")]).default(0),
        isAvailable: z.boolean().default(true)
      })
    )
    .max(30)
});

export const productSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(800).optional().nullable(),
  basePrice: z.union([z.number(), z.string()]),
  promoPrice: z.union([z.number(), z.string()]).optional().nullable(),
  images: z.array(imageReferenceSchema).max(6).default([]),
  categoryId: z.string().optional().nullable(),
  categoryIds: z.array(z.string()).max(30).default([]),
  categoryName: z.string().max(80).optional().nullable(),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  stockQuantity: nullableStockQuantity.default(null),
  sku: z.string().trim().max(80).optional().nullable(),
  freeShipping: z.boolean().default(false),
  optionGroups: z.array(optionGroupSchema).max(12).default([]),
  variants: z.array(variantCombinationSchema).max(100).default([])
});

export type ProductPayload = z.infer<typeof productSchema>;

export function validateProductVariants(payload: ProductPayload, basePrice: number) {
  const allowed = new Set(variantCombinations(payload.optionGroups).map((item) => item.key));
  if (payload.variants.some((variant) => !allowed.has(variant.key)) || new Set(payload.variants.map((variant) => variant.key)).size !== payload.variants.length) {
    throw new Error("Las combinaciones no coinciden con las propiedades del producto.");
  }
  for (const variant of payload.variants) {
    if (variant.promoPrice !== null && variant.promoPrice >= (variant.basePrice ?? basePrice)) throw new Error("La oferta de una combinación debe ser menor que su precio.");
  }
}

export function resolveVariantImages(variants: VariantCombination[], imageUrls: string[]) {
  return variants.map(({ imageIndex, ...variant }) => {
    const imageUrl = imageIndex === undefined ? variant.imageUrl : imageUrls[imageIndex];
    if (imageUrl && !imageUrls.includes(imageUrl)) throw new Error("La foto de una variante debe pertenecer a la galería del producto.");
    if (imageIndex !== undefined && !imageUrl) throw new Error("La foto elegida para una variante ya no existe.");
    return { ...variant, imageUrl: imageUrl ?? null };
  });
}

export async function deleteProductImagesForStore(storeId: string, imageUrls: string[]) {
  await Promise.all(
    imageUrls.map(async (imageUrl) => {
      const key = getPublicObjectKeyFromUrl(imageUrl);
      if (key?.startsWith(`products/${storeId}/`)) {
        await deletePublicObject(key).catch(() => null);
      }
    })
  );
}

export function normalizePromoPrice(value: ProductPayload["promoPrice"], basePrice: number) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const promoPrice = parsePriceToCents(String(value));
  if (promoPrice <= 0) {
    return null;
  }

  if (promoPrice >= basePrice) {
    throw new Error("El precio promocional debe ser menor al precio base.");
  }

  return promoPrice;
}

export async function makeUniqueProductSlug(storeId: string, name: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = buildProductSlug(name);
    const conflicting = await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } });
    if (!conflicting) return candidate;
  }
  throw new Error("No se pudo generar una URL única para el producto.");
}

export async function resolveCategoryId(storeId: string, input: Pick<ProductPayload, "categoryId" | "categoryName">) {
  const categoryId = input.categoryId?.trim();
  if (categoryId && categoryId !== "none") {
    const category = await prisma.category.findFirst({ where: { id: categoryId, storeId } });
    if (!category) {
      throw new Error("Categoría inválida.");
    }
    return category.id;
  }

  const categoryName = input.categoryName?.trim();
  if (!categoryName) {
    return null;
  }

  throw new Error("Creá la categoría desde la sección Categorías y luego vinculala al producto.");
}

export function buildOptionGroupCreates(optionGroups: ProductPayload["optionGroups"]) {
  return optionGroups.map((group, groupIndex) => ({
    name: group.name.trim(),
    selectionType: "SINGLE" as const,
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: groupIndex,
    options: {
      create: group.options.map((option, optionIndex) => ({
        name: option.name.trim(),
        priceDelta: 0,
        isAvailable: option.isAvailable,
        sortOrder: optionIndex
      }))
    }
  }));
}

export function productInclude() {
  return {
    category: true,
    assignedCategories: true,
    optionGroups: {
      include: { options: { orderBy: { sortOrder: "asc" as const } } },
      orderBy: { sortOrder: "asc" as const }
    }
  };
}
