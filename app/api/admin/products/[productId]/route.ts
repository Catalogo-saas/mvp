import { NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  deleteProductImagesForStore,
  normalizePromoPrice,
  productInclude,
  productSchema,
  resolveCategoryId
} from "@/lib/admin-catalog";
import { deletePromotedImages, deletePromotedTemporaries, resolveImageReferences } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

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

  const result = productSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
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
  let resolvedImages;
  try {
    resolvedImages = await resolveImageReferences({
      storeId: store.id,
      scope: "products",
      references: result.data.images,
      allowedStoredUrls: existingProduct.imageUrls
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron validar las imágenes." }, { status: 400 });
  }
  const nextImageUrls = resolvedImages.urls;
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
    await deletePromotedImages(resolvedImages.promoted);
    throw error;
  }

  await deletePromotedTemporaries(resolvedImages.promoted);
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
