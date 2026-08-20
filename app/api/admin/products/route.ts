import { NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  makeUniqueProductSlug,
  normalizeImageUrls,
  normalizePromoPrice,
  productInclude,
  productSchema,
  resolveCategoryId
} from "@/lib/admin-catalog";
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

  const body = await request.json().catch(() => null);
  const result = productSchema.safeParse(body);
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
  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId,
      name: result.data.name.trim(),
      slug: productSlug,
      description: result.data.description?.trim() || null,
      basePrice,
      promoPrice,
      imageUrls: normalizeImageUrls(result.data),
      isVisible: result.data.isVisible,
      optionGroups: {
        create: buildOptionGroupCreates(result.data.optionGroups)
      }
    },
    include: productInclude()
  });

  return NextResponse.json({ product });
}
