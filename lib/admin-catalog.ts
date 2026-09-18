import { z } from "zod";

import { SelectionType } from "@/lib/generated/prisma/enums";
import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildProductSlug } from "@/lib/product-slug";
import { slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";

const nullableNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().int().min(1).max(30).nullable()
);

const nullableStockQuantity = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).replace(/\D/g, "");
  return normalized ? Number(normalized) : null;
}, z.number().int().min(0).max(999999).nullable());

const optionGroupSchema = z.object({
  name: z.string().min(1).max(60),
  selectionType: z.nativeEnum(SelectionType),
  isRequired: z.boolean().default(false),
  maxSelections: nullableNumber.default(null),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        priceDelta: z.union([z.number(), z.string()]).default(0),
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
  categoryName: z.string().max(80).optional().nullable(),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  stockQuantity: nullableStockQuantity.default(null),
  optionGroups: z.array(optionGroupSchema).max(12).default([])
});

export type ProductPayload = z.infer<typeof productSchema>;

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

  const categorySlug = slugify(categoryName) || "destacados";
  const category = await prisma.category.upsert({
    where: { storeId_slug: { storeId, slug: categorySlug } },
    update: { name: categoryName },
    create: {
      storeId,
      name: categoryName,
      slug: categorySlug
    }
  });

  return category.id;
}

export function buildOptionGroupCreates(optionGroups: ProductPayload["optionGroups"]) {
  return optionGroups.map((group, groupIndex) => ({
    name: group.name.trim(),
    selectionType: group.selectionType,
    isRequired: group.isRequired,
    minSelections: group.isRequired ? 1 : 0,
    maxSelections: group.selectionType === "MULTIPLE" ? group.maxSelections : 1,
    sortOrder: groupIndex,
    options: {
      create: group.options.map((option, optionIndex) => ({
        name: option.name.trim(),
        priceDelta: parsePriceToCents(String(option.priceDelta)),
        isAvailable: option.isAvailable,
        sortOrder: optionIndex
      }))
    }
  }));
}

export function productInclude() {
  return {
    category: true,
    optionGroups: {
      include: { options: { orderBy: { sortOrder: "asc" as const } } },
      orderBy: { sortOrder: "asc" as const }
    }
  };
}
