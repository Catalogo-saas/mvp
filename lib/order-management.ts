import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { normalizeVariants } from "@/lib/product-variants";
import { checkedMoney, CheckoutError, publicOrderItemSchema, resolveCheckoutItem, validateDemand } from "./checkout-validation";
import { lockProducts } from "./commerce-transaction";

export const orderStatusSchema = z.enum(["PENDING_WHATSAPP", "PAID", "IN_PREPARATION", "DELIVERED", "CANCELLED"]);
export const adminOrderItemSchema = publicOrderItemSchema;

export type ManagedOrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderItemForStock = { productId: string | null; productName: string; quantity: number; variantKey?: string | null };

export function hasDiscountedStock(status: ManagedOrderStatus, reservePending = false) {
  return status === "PAID" || status === "IN_PREPARATION" || status === "DELIVERED" || (reservePending && status === "PENDING_WHATSAPP");
}

export async function decrementStockForItems(tx: Prisma.TransactionClient, items: OrderItemForStock[], storeId: string) {
  await lockProducts(tx, storeId, items.map(item => item.productId));
  for (const item of items) {
    if (!item.productId || item.variantKey) continue;
    const updated = await tx.product.updateMany({
      where: { id: item.productId, storeId, stockQuantity: { not: null, gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } }
    });
    if (updated.count > 0) continue;
    const product = await tx.product.findFirst({ where: { id: item.productId, storeId }, select: { name: true, stockQuantity: true } });
    if (!product) throw new CheckoutError("PRODUCT_UNAVAILABLE", "Uno de los productos ya no está disponible.");
    if (product.stockQuantity === null) continue;
    throw new CheckoutError("INSUFFICIENT_STOCK", `Stock insuficiente para ${product.name || item.productName}`);
  }
  for (const item of items) {
    if (item.productId && item.variantKey) await changeVariantStock(tx, storeId, item.productId, item.variantKey, -item.quantity);
  }
}

async function changeVariantStock(tx: Prisma.TransactionClient, storeId: string, productId: string, key: string, delta: number) {
  await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} AND "storeId" = ${storeId} FOR UPDATE`;
  const product = await tx.product.findFirst({ where: { id: productId, storeId }, select: { name: true, variants: true } });
  if (!product) {
    if (delta < 0) throw new CheckoutError("PRODUCT_UNAVAILABLE", "Uno de los productos ya no está disponible.");
    return;
  }
  const variants = normalizeVariants(product.variants);
  if (!variants.length) throw new CheckoutError("VARIANT_UNAVAILABLE", `La combinación de ${product.name} ya no está disponible.`);
  const index = variants.findIndex((variant) => variant.key === key);
  if (index < 0) throw new CheckoutError("VARIANT_UNAVAILABLE", `La combinación de ${product.name} ya no está disponible.`);
  const quantity = variants[index].stockQuantity;
  if (quantity === null) return;
  if (quantity + delta < 0) throw new CheckoutError("INSUFFICIENT_STOCK", `Stock insuficiente para ${product.name}.`);
  variants[index] = { ...variants[index], stockQuantity: quantity + delta };
  await tx.product.update({ where: { id: productId }, data: { variants } });
}

export async function restoreStockForItems(tx: Prisma.TransactionClient, items: OrderItemForStock[], storeId: string, legacyVariantGlobalStock = false) {
  await lockProducts(tx, storeId, items.map(item => item.productId));
  for (const item of items) {
    if (!item.productId) continue;
    if (!item.variantKey || legacyVariantGlobalStock) await tx.product.updateMany({
      where: { id: item.productId, storeId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: item.quantity } }
    });
    if (item.variantKey) await changeVariantStock(tx, storeId, item.productId, item.variantKey, item.quantity);
  }
}

function getDemand(items: OrderItemForStock[], includeVariants = false) {
  return items.reduce<Map<string, { quantity: number; item: OrderItemForStock }>>((demand, item) => {
    if (item.productId && (!item.variantKey || includeVariants)) {
      demand.set(item.productId, { quantity: (demand.get(item.productId)?.quantity ?? 0) + item.quantity, item });
    }
    return demand;
  }, new Map());
}

function getVariantDemand(items: OrderItemForStock[]) {
  const demand = new Map<string, { item: OrderItemForStock; quantity: number }>();
  for (const item of items) {
    if (!item.productId || !item.variantKey) continue;
    const key = `${item.productId}\0${item.variantKey}`;
    demand.set(key, { item, quantity: (demand.get(key)?.quantity ?? 0) + item.quantity });
  }
  return demand;
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  storeId: string,
  previousItems: OrderItemForStock[],
  nextItems: OrderItemForStock[],
  previousStatus: ManagedOrderStatus,
  nextStatus: ManagedOrderStatus,
  reservePending = false,
  legacyPreviousVariantGlobalStock = false
) {
  await lockProducts(tx, storeId, [...previousItems, ...nextItems].map(item => item.productId));
  const previousDemand = getDemand(previousItems, legacyPreviousVariantGlobalStock);
  const nextDemand = getDemand(nextItems);
  const stockKeys = new Set([...previousDemand.keys(), ...nextDemand.keys()]);
  for (const key of stockKeys) {
    const previousEntry = previousDemand.get(key);
    const nextEntry = nextDemand.get(key);
    const previousConsumed = hasDiscountedStock(previousStatus, reservePending) ? previousEntry?.quantity ?? 0 : 0;
    const nextConsumed = hasDiscountedStock(nextStatus, reservePending) ? nextEntry?.quantity ?? 0 : 0;
    const delta = nextConsumed - previousConsumed;
    if (delta > 0) {
      const item = nextEntry?.item;
      if (item) await decrementStockForItems(tx, [{ ...item, variantKey: null, quantity: delta }], storeId);
    } else if (delta < 0) {
      const item = previousEntry?.item;
      if (item) await restoreStockForItems(tx, [{ ...item, variantKey: null, quantity: Math.abs(delta) }], storeId);
    }
  }
  const previousVariants = getVariantDemand(previousItems);
  const nextVariants = getVariantDemand(nextItems);
  for (const key of new Set([...previousVariants.keys(), ...nextVariants.keys()])) {
    const previousEntry = previousVariants.get(key);
    const nextEntry = nextVariants.get(key);
    const previousQuantity = hasDiscountedStock(previousStatus, reservePending) ? previousEntry?.quantity ?? 0 : 0;
    const nextQuantity = hasDiscountedStock(nextStatus, reservePending) ? nextEntry?.quantity ?? 0 : 0;
    const delta = nextQuantity - previousQuantity;
    const item = nextEntry?.item ?? previousEntry?.item;
    if (!item?.productId || !item.variantKey || !delta) continue;
    await changeVariantStock(tx, storeId, item.productId, item.variantKey, -delta);
  }
}

export async function buildOrderItems(
  tx: Prisma.TransactionClient,
  storeId: string,
  inputItems: z.infer<typeof adminOrderItemSchema>[],
  options: { validateAvailableStock?: boolean; requireVisible?: boolean } = {}
) {
  const productIds = Array.from(new Set(inputItems.map((item) => item.productId)));
  const products = await tx.product.findMany({
    where: { storeId, id: { in: productIds } },
    include: { optionGroups: { include: { options: true }, orderBy: { sortOrder: "asc" } } }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const resolved = inputItems.map(item => resolveCheckoutItem(productsById.get(item.productId), item, options.requireVisible ?? false));
  validateDemand(resolved, options.validateAvailableStock ?? false);
  const items = resolved.map(({ productId, variantKey, productName, imageUrl, quantity, unitPrice, options, subtotal }) => ({ productId, variantKey, productName, imageUrl, quantity, unitPrice, options, subtotal }));
  return { items, total: checkedMoney(items.reduce((sum, item) => sum + item.subtotal, 0)) };
}
