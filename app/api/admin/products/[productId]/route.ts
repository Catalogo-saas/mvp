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
    categoryId = await resolveCategoryId(store.id, result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const nextName = result.data.name.trim();
  const slug =
    existingProduct.name === nextName ? existingProduct.slug : await makeUniqueProductSlug(store.id, nextName, existingProduct.id);

  const product = await prisma.$transaction(async (tx) => {
    await tx.optionGroup.deleteMany({ where: { productId: existingProduct.id } });
    return tx.product.update({
      where: { id: existingProduct.id },
      data: {
        categoryId,
        name: nextName,
        slug,
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
  });

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
  return NextResponse.json({ ok: true });
}
