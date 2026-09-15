import { NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  makeUniqueProductSlug,
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
    categoryId = await resolveCategoryId(store.id, {
      categoryId: result.data.categoryId,
      categoryName: result.data.categoryName?.trim() || "Destacados"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const productSlug = await makeUniqueProductSlug(store.id, result.data.name);
  const uploadedImages = imageFiles.length ? await uploadProductImages(store.id, imageFiles).catch(() => null) : [];
  if (uploadedImages === null) {
    return NextResponse.json({ error: "No se pudieron subir las imágenes." }, { status: 500 });
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
        imageUrls: normalizeImageUrls({ ...result.data, imageUrls: [...result.data.imageUrls, ...uploadedImages.map((image) => image.url)] }),
        isVisible: result.data.isVisible,
        stockQuantity: result.data.stockQuantity,
        optionGroups: {
          create: buildOptionGroupCreates(result.data.optionGroups)
        }
      },
      include: productInclude()
    });

    return NextResponse.json({ product });
  } catch (error) {
    await Promise.all(uploadedImages.map((image) => deletePublicObject(image.key).catch(() => null)));
    throw error;
  }
}
