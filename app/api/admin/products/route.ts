import { after, NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  makeUniqueProductSlug,
  normalizePromoPrice,
  productInclude,
  productSchema,
  resolveVariantImages,
  resolveCategoryId,
  validateProductVariants
} from "@/lib/admin-catalog";
import { deletePromotedImages, deletePromotedTemporaries, resolveImageReferences } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { compareProducts, matchesProductFilters } from "@/lib/admin-product-filters";
import { paginationQuery, productListWhere } from "@/lib/admin-list-query";

export async function GET(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  if (params.has("page")) {
    const { page: requestedPage, pageSize } = paginationQuery(params);
    const where = productListWhere(store.id, params);
    const summaries = await prisma.product.findMany({ where, select: { id: true, name: true, sku: true, basePrice: true, promoPrice: true, stockQuantity: true, variants: true, imageUrls: true, sortOrder: true, createdAt: true } });
    const matching = summaries.filter(product => matchesProductFilters(product, params)).sort((a, b) => compareProducts(a, b, params.get("sort") ?? "default"));
    const total = matching.length;
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
    const ids = matching.slice((page - 1) * pageSize, page * pageSize).map(product => product.id);
    const records = await prisma.product.findMany({ where: { storeId: store.id, id: { in: ids } }, include: productInclude() });
    const byId = new Map(records.map(product => [product.id, product]));
    const products = ids.map(id => byId.get(id)).filter(Boolean);
    return NextResponse.json({ products, page, pageSize, total });
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
    validateProductVariants(result.data, basePrice);
    categoryId = await resolveCategoryId(store.id, {
      categoryId: result.data.categoryId,
      categoryName: result.data.categoryName?.trim() || null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }
  const assignedIds = Array.from(new Set([...result.data.categoryIds, ...(categoryId ? [categoryId] : [])]));
  if (await prisma.category.count({ where: { storeId: store.id, id: { in: assignedIds } } }) !== assignedIds.length) {
    return NextResponse.json({ error: "Una categoría no pertenece a esta tienda." }, { status: 400 });
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
    console.error("[image-upload] Failed to promote product images", error);
    return NextResponse.json({ error: "No pudimos procesar las imágenes. Intentá nuevamente." }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId,
        assignedCategories: { connect: assignedIds.map((id) => ({ id })) },
        name: result.data.name.trim(),
        slug: productSlug,
        description: result.data.description?.trim() || null,
        basePrice,
        promoPrice,
        isFeatured: result.data.isFeatured,
        imageUrls: resolvedImages.urls,
        isVisible: result.data.isVisible,
        stockQuantity: result.data.stockQuantity,
        sku: result.data.sku || null,
        freeShipping: result.data.freeShipping,
        variants: resolveVariantImages(result.data.variants, resolvedImages.urls),
        optionGroups: {
          create: buildOptionGroupCreates(result.data.optionGroups)
        }
      },
      include: productInclude()
    });

    after(() => deletePromotedTemporaries(resolvedImages.promoted));
    return NextResponse.json({ product });
  } catch (error) {
    await deletePromotedImages(resolvedImages.promoted);
    throw error;
  }
}
