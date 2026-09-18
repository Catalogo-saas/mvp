import { NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  makeUniqueProductSlug,
  normalizePromoPrice,
  productInclude,
  productSchema,
  resolveCategoryId
} from "@/lib/admin-catalog";
import { deletePromotedImages, deletePromotedTemporaries, resolveImageReferences } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: productInclude(),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
    categoryId = await resolveCategoryId(store.id, {
      categoryId: result.data.categoryId,
      categoryName: result.data.categoryName?.trim() || "Destacados"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const productSlug = await makeUniqueProductSlug(store.id, result.data.name);
  let resolvedImages;
  try {
    resolvedImages = await resolveImageReferences({
      storeId: store.id,
      scope: "products",
      references: result.data.images,
      allowedStoredUrls: []
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron validar las imágenes." }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId,
        name: result.data.name.trim(),
        slug: productSlug,
        description: result.data.description?.trim() || null,
        basePrice,
        promoPrice,
        isFeatured: result.data.isFeatured,
        imageUrls: resolvedImages.urls,
        isVisible: result.data.isVisible,
        stockQuantity: result.data.stockQuantity,
        optionGroups: {
          create: buildOptionGroupCreates(result.data.optionGroups)
        }
      },
      include: productInclude()
    });

    await deletePromotedTemporaries(resolvedImages.promoted);
    return NextResponse.json({ product });
  } catch (error) {
    await deletePromotedImages(resolvedImages.promoted);
    throw error;
  }
}
