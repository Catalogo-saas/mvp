import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { SelectionType } from "@/lib/generated/prisma/enums";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl, uploadPublicObject } from "@/lib/storage";

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
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageUrls: z.array(z.string().url()).max(6).default([]),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().max(80).optional().nullable(),
  isVisible: z.boolean().default(true),
  stockQuantity: nullableStockQuantity.default(null),
  optionGroups: z.array(optionGroupSchema).max(12).default([])
});

export type ProductPayload = z.infer<typeof productSchema>;

const productImageExtensionsByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function parseProductRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      body: await request.json().catch(() => null),
      imageFiles: [] as File[]
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { body: null, imageFiles: [] as File[] };
  }

  const payload = formData.get("payload");
  let body = null;
  if (typeof payload === "string") {
    try {
      body = JSON.parse(payload);
    } catch {
      body = null;
    }
  }
  const imageFiles = formData.getAll("images").filter((file): file is File => file instanceof File && file.size > 0);

  return { body, imageFiles };
}

export function validateProductImageFiles(files: File[]) {
  for (const file of files) {
    if (!file.type.startsWith("image/") || !productImageExtensionsByType[file.type]) {
      return "Formato de imagen no soportado.";
    }
    if (file.size > 6 * 1024 * 1024) {
      return "Cada imagen no puede superar 6 MB.";
    }
  }
  return null;
}

export async function uploadProductImages(storeId: string, files: File[]) {
  const uploaded: Array<{ url: string; key: string }> = [];

  try {
    for (const file of files) {
      const extension = productImageExtensionsByType[file.type];
      const key = `products/${storeId}/${randomUUID()}.${extension}`;
      const url = await uploadPublicObject({
        key,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type
      });
      uploaded.push({ url, key });
    }
  } catch (error) {
    await Promise.all(uploaded.map((image) => deletePublicObject(image.key).catch(() => null)));
    throw error;
  }

  return uploaded;
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

export function normalizeImageUrls(input: Pick<ProductPayload, "imageUrl" | "imageUrls">) {
  const urls = [...input.imageUrls];
  if (input.imageUrl && !urls.includes(input.imageUrl)) {
    urls.unshift(input.imageUrl);
  }
  return Array.from(new Set(urls)).slice(0, 6);
}

export async function makeUniqueProductSlug(storeId: string, name: string, exceptProductId?: string) {
  const baseSlug = slugify(name) || "producto";
  const conflicting = await prisma.product.findFirst({
    where: {
      storeId,
      slug: baseSlug,
      ...(exceptProductId ? { NOT: { id: exceptProductId } } : {})
    }
  });

  return conflicting ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
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
