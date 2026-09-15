import { NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  deleteProductImagesForStore,
  normalizeImageUrls,
  normalizePromoPrice,
  parseProductRequest,
  productInclude,
  productSchema,
  resolveCategoryId,
  uploadProductImages,
  validateProductImageFiles
} from "@/lib/admin-catalog";
import { getMerchantStore } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { deletePublicObject } from "@/lib/storage";

type Params = Promise<{ productId: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { productId } = await params;
  const existingProduct = await prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
  if (!existingProduct) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const { body, imageFiles } = await parseProductRequest(request).catch(() => ({ body: null, imageFiles: [] }));
  const result = productSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const imageError = validateProductImageFiles(imageFiles);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
  }
  if (result.data.imageUrls.length + imageFiles.length > 6) {
    return NextResponse.json({ error: "El máximo es 6 imágenes por producto." }, { status: 400 });
  }

  const basePrice = parsePriceToCents(String(result.data.basePrice));
  let promoPrice: number | null;
  let categoryId: string | null;

  try {
    promoPrice = normalizePromoPrice(result.data.promoPrice, basePrice);
    categoryId = await resolveCategoryId(store.id, result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const nextName = result.data.name.trim();
  const uploadedImages = imageFiles.length ? await uploadProductImages(store.id, imageFiles).catch(() => null) : [];
  if (uploadedImages === null) {
    return NextResponse.json({ error: "No se pudieron subir las imágenes." }, { status: 500 });
  }
  const nextImageUrls = normalizeImageUrls({ ...result.data, imageUrls: [...result.data.imageUrls, ...uploadedImages.map((image) => image.url)] });
  const removedImageUrls = existingProduct.imageUrls.filter((url) => !nextImageUrls.includes(url));

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
      await tx.optionGroup.deleteMany({ where: { productId: existingProduct.id } });
      return tx.product.update({
        where: { id: existingProduct.id },
        data: {
          categoryId,
          name: nextName,
          description: result.data.description?.trim() || null,
          basePrice,
          promoPrice,
          isFeatured: result.data.isFeatured,
          imageUrls: nextImageUrls,
          isVisible: result.data.isVisible,
          stockQuantity: result.data.stockQuantity,
          optionGroups: {
            create: buildOptionGroupCreates(result.data.optionGroups)
          }
        },
        include: productInclude()
      });
    });
  } catch (error) {
    await Promise.all(uploadedImages.map((image) => deletePublicObject(image.key).catch(() => null)));
    throw error;
  }

  await deleteProductImagesForStore(store.id, removedImageUrls);

  return NextResponse.json({ product });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { productId } = await params;
  const existingProduct = await prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
  if (!existingProduct) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  await prisma.product.delete({ where: { id: existingProduct.id } });
  await deleteProductImagesForStore(store.id, existingProduct.imageUrls);
  return NextResponse.json({ ok: true });
}
