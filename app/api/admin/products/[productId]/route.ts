import { after, NextResponse } from "next/server";

import {
  buildOptionGroupCreates,
  deleteProductImagesForStore,
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
import { quickProductSchema, validateQuickPrices } from "@/lib/product-quick-edit";
import { normalizeVariants } from "@/lib/product-variants";
import { commerceError, commerceTransaction, lockProducts, lockStore } from "@/lib/commerce-transaction";
import { CheckoutError } from "@/lib/checkout-validation";

type Params = Promise<{ productId: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { productId } = await params;
  const existingProduct = await prisma.product.findFirst({ where: { id: productId, storeId: store.id }, include: productInclude() });
  if (!existingProduct) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body && !Object.hasOwn(body, "name")) {
    const quick = quickProductSchema.safeParse(body);
    if (!quick.success) return NextResponse.json({ error: "Revisá los valores ingresados." }, { status: 400 });
    const { expectedUpdatedAt, ...changes } = quick.data;
    try {
      const product = await commerceTransaction(async tx => {
        await lockStore(tx, store.id);
        // Row lock protects stock edits against concurrent checkout reservations.
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} AND "storeId" = ${store.id} FOR UPDATE`;
        const current = await tx.product.findFirst({ where: { id: productId, storeId: store.id } });
        if (!current || current.updatedAt.toISOString() !== expectedUpdatedAt) throw new CheckoutError("PRODUCT_CHANGED", "El producto cambió. Actualizá el listado antes de volver a guardar.");
        const variants = changes.variants ? resolveVariantImages(changes.variants, current.imageUrls) : normalizeVariants(current.variants);
        const previousKeys = new Set(normalizeVariants(current.variants).map(v => v.key));
        if (changes.variants && (variants.length !== previousKeys.size || new Set(variants.map(v => v.key)).size !== variants.length || variants.some(v => !previousKeys.has(v.key)))) throw new CheckoutError("INVALID_VARIANTS", "Editá las propiedades de las variantes desde el formulario del producto.");
        try { validateQuickPrices({ ...current, ...changes, variants }); }
        catch (error) { throw new CheckoutError("INVALID_PRICE", error instanceof Error ? error.message : "Revisá los precios.", 400); }
        return tx.product.update({ where: { id: current.id }, data: { ...changes, ...(changes.variants ? { variants } : {}) }, include: productInclude() });
      });
      return NextResponse.json({ product });
    } catch (error) { const failure = commerceError(error); return NextResponse.json(failure.body, { status: failure.status }); }
  }
  const expectedVersion = quickProductSchema.shape.expectedUpdatedAt.safeParse(body?.expectedUpdatedAt);
  if (!expectedVersion.success && (body?.expectedUpdatedAt !== undefined || body && (Object.hasOwn(body, "stockQuantity") || Object.hasOwn(body, "variants")))) {
    return NextResponse.json({ code: "PRODUCT_VERSION_REQUIRED", error: "Actualizá el producto antes de guardar cambios de stock." }, { status: 400 });
  }
  const currentGroups = existingProduct.optionGroups.map(group=>({name:group.name,selectionType:group.selectionType,isRequired:group.isRequired,maxSelections:group.maxSelections,options:group.options.map(option=>({name:option.name,priceDelta:option.priceDelta,isAvailable:option.isAvailable}))}));
  const result = productSchema.safeParse(body && {...existingProduct,images:existingProduct.imageUrls.map(url=>({kind:"stored",url})),categoryIds:existingProduct.assignedCategories.map(c=>c.id),optionGroups:currentGroups,...body});
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const basePrice = parsePriceToCents(String(result.data.basePrice));
  let promoPrice: number | null;
  let categoryId: string | null;

  try {
    promoPrice = normalizePromoPrice(result.data.promoPrice, basePrice);
    validateProductVariants(result.data, basePrice);
    categoryId = await resolveCategoryId(store.id, result.data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }
  const assignedIds = Array.from(new Set([...result.data.categoryIds, ...(categoryId ? [categoryId] : [])]));
  if (await prisma.category.count({ where: { storeId: store.id, id: { in: assignedIds } } }) !== assignedIds.length) {
    return NextResponse.json({ error: "Una categoría no pertenece a esta tienda." }, { status: 400 });
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
    console.error("[image-upload] Failed to promote product images", error);
    return NextResponse.json({ error: "No pudimos procesar las imágenes. Intentá nuevamente." }, { status: 400 });
  }
  const nextImageUrls = resolvedImages.urls;
  const removedImageUrls = existingProduct.imageUrls.filter((url) => !nextImageUrls.includes(url));

  let product;
  try {
    product = await commerceTransaction(async (tx) => {
      await lockStore(tx, store.id);
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} AND "storeId" = ${store.id} FOR UPDATE`;
      const current = await tx.product.findFirstOrThrow({where:{id:productId,storeId:store.id}});
      if(current.updatedAt.toISOString() !== (expectedVersion.success ? expectedVersion.data : existingProduct.updatedAt.toISOString())) throw new CheckoutError("PRODUCT_CHANGED", "El producto cambió. Recargá antes de guardar para no sobrescribir el stock.");
      const activeVariantItems = await tx.orderItem.findMany({ where: { productId, variantKey: { not: null }, order: { stockReserved: true, status: { in: ["PENDING_WHATSAPP", "PAID", "IN_PREPARATION"] } } }, select: { variantKey: true } });
      const nextVariantKeys = new Set(result.data.variants.map(variant => variant.key));
      if (activeVariantItems.some(item => item.variantKey && !nextVariantKeys.has(item.variantKey))) throw new CheckoutError("VARIANT_IN_USE", "Hay pedidos abiertos con combinaciones que no podés eliminar todavía.");
      const groupsChanged=JSON.stringify(result.data.optionGroups.map(g=>({...g,options:g.options.map(o=>({...o,priceDelta:parsePriceToCents(String(o.priceDelta))}))})))!==JSON.stringify(currentGroups);
      if(groupsChanged) await tx.optionGroup.deleteMany({ where: { productId: existingProduct.id } });
      return tx.product.update({
        where: { id: existingProduct.id },
        data: {
          categoryId,
          assignedCategories: { set: assignedIds.map((id) => ({ id })) },
          name: nextName,
          description: result.data.description?.trim() || null,
          basePrice,
          promoPrice,
          isFeatured: result.data.isFeatured,
          imageUrls: nextImageUrls,
          isVisible: result.data.isVisible,
          stockQuantity: result.data.stockQuantity,
          sku: result.data.sku || null,
          freeShipping: result.data.freeShipping,
          variants: resolveVariantImages(result.data.variants, nextImageUrls),
          ...(groupsChanged ? {optionGroups: {create: buildOptionGroupCreates(result.data.optionGroups)}} : {})
        },
        include: productInclude()
      });
    });
  } catch (error) {
    await deletePromotedImages(resolvedImages.promoted);
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }

  after(() => Promise.all([
    deletePromotedTemporaries(resolvedImages.promoted),
    deleteProductImagesForStore(store.id, removedImageUrls)
  ]));

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

  try {
    await commerceTransaction(async tx => {
      await lockStore(tx, store.id);
      await lockProducts(tx, store.id, [productId]);
      const current = await tx.product.findFirst({ where: { id: productId, storeId: store.id } });
      if (!current) throw new CheckoutError("PRODUCT_UNAVAILABLE", "Producto no encontrado", 404);
      const open = await tx.orderItem.count({ where: { productId, order: { stockReserved: true, status: { in: ["PENDING_WHATSAPP", "PAID", "IN_PREPARATION"] } } } });
      if (open) throw new CheckoutError("PRODUCT_IN_USE", "Hay pedidos abiertos con este producto. Ocultalo hasta completar o cancelar esas ventas.");
      await tx.product.delete({ where: { id: current.id } });
    });
    await deleteProductImagesForStore(store.id, existingProduct.imageUrls);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
