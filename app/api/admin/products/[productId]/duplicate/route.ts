import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { makeUniqueProductSlug, productInclude } from "@/lib/admin-catalog";
import { copyPublicObject, deletePublicObject, getPublicObjectKeyFromUrl, inspectObject } from "@/lib/storage";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function POST(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const product = await prisma.product.findFirst({ where: { id: (await params).productId, storeId: store.id }, include: productInclude() });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if (product.optionGroups.some(group => group.selectionType !== "SINGLE" || !group.isRequired || group.options.some(option => option.priceDelta !== 0))) {
    return NextResponse.json({ error: "Este producto usa extras antiguos. Editalo para dejar solo variantes antes de duplicarlo." }, { status: 400 });
  }
  const copiedKeys: string[] = [];
  try {
    const imageUrls: string[] = [];
    for (const url of product.imageUrls) {
      const sourceKey = getPublicObjectKeyFromUrl(url);
      if (!sourceKey) { imageUrls.push(url); continue; } // External images are never deleted by this app.
      if (!sourceKey.startsWith(`products/${store.id}/`)) throw new Error("La imagen no pertenece a esta tienda.");
      const meta = await inspectObject(sourceKey);
      const destinationKey = `products/${store.id}/${randomUUID()}.${sourceKey.split(".").pop() || "webp"}`;
      imageUrls.push(await copyPublicObject({ sourceKey, destinationKey, contentType: meta.contentType, sourceEtag: meta.etag }));
      copiedKeys.push(destinationKey);
    }
    const name = `${product.name.slice(0, 110)} (copia)`;
    const copy = await prisma.product.create({ data: {
      storeId: store.id, name, slug: await makeUniqueProductSlug(store.id, name), description: product.description,
      basePrice: product.basePrice, promoPrice: product.promoPrice, stockQuantity: product.stockQuantity,
      isVisible: false, isFeatured: false, sku: null, freeShipping: product.freeShipping, imageUrls,
      categoryId: product.categoryId, assignedCategories: { connect: product.assignedCategories.map(c => ({ id: c.id })) },
      variants: product.variants as Prisma.InputJsonValue,
      optionGroups: { create: product.optionGroups.map(g => ({ name: g.name, selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, sortOrder: g.sortOrder, options: { create: g.options.map(o => ({ name: o.name, priceDelta: 0, isAvailable: o.isAvailable, sortOrder: o.sortOrder })) } })) }
    }, select: { id: true } });
    return NextResponse.json({ product: copy });
  } catch (error) {
    await Promise.allSettled(copiedKeys.map(deletePublicObject));
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo duplicar el producto." }, { status: 400 });
  }
}
