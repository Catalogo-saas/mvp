import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getEffectiveProductPrice } from "@/lib/catalog";

export const orderStatusSchema = z.enum(["PENDING_WHATSAPP", "PAID", "IN_PREPARATION", "DELIVERED", "CANCELLED"]);
export const adminOrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().min(1).max(99),
  selectedOptionIds: z.array(z.string()).default([])
});

export type ManagedOrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderItemForStock = { productId: string | null; productName: string; quantity: number };

export function hasDiscountedStock(status: ManagedOrderStatus) {
  return status === "PAID" || status === "IN_PREPARATION" || status === "DELIVERED";
}

async function decrementStockForItems(tx: Prisma.TransactionClient, items: OrderItemForStock[], storeId: string) {
  for (const item of items) {
    if (!item.productId) continue;
    const updated = await tx.product.updateMany({
      where: { id: item.productId, storeId, stockQuantity: { not: null, gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } }
    });
    if (updated.count > 0) continue;
    const product = await tx.product.findFirst({ where: { id: item.productId, storeId }, select: { name: true, stockQuantity: true } });
    if (!product || product.stockQuantity === null) continue;
    throw new Error(`Stock insuficiente para ${product.name || item.productName}`);
  }
}

export async function restoreStockForItems(tx: Prisma.TransactionClient, items: OrderItemForStock[], storeId: string) {
  for (const item of items) {
    if (!item.productId) continue;
    await tx.product.updateMany({
      where: { id: item.productId, storeId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: item.quantity } }
    });
  }
}

function getDemand(items: OrderItemForStock[]) {
  return items.reduce<Map<string, number>>((demand, item) => {
    if (item.productId) demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity);
    return demand;
  }, new Map());
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  storeId: string,
  previousItems: OrderItemForStock[],
  nextItems: OrderItemForStock[],
  previousStatus: ManagedOrderStatus,
  nextStatus: ManagedOrderStatus
) {
  const previousDemand = getDemand(previousItems);
  const nextDemand = getDemand(nextItems);
  const productIds = new Set([...previousDemand.keys(), ...nextDemand.keys()]);
  for (const productId of productIds) {
    const previousConsumed = hasDiscountedStock(previousStatus) ? previousDemand.get(productId) ?? 0 : 0;
    const nextConsumed = hasDiscountedStock(nextStatus) ? nextDemand.get(productId) ?? 0 : 0;
    const delta = nextConsumed - previousConsumed;
    if (delta > 0) {
      const productName = nextItems.find((item) => item.productId === productId)?.productName ?? "producto";
      await decrementStockForItems(tx, [{ productId, productName, quantity: delta }], storeId);
    } else if (delta < 0) {
      await restoreStockForItems(tx, [{ productId, productName: "producto", quantity: Math.abs(delta) }], storeId);
    }
  }
}

export async function buildOrderItems(
  tx: Prisma.TransactionClient,
  storeId: string,
  inputItems: z.infer<typeof adminOrderItemSchema>[],
  options: { validateAvailableStock?: boolean } = {}
) {
  const productIds = Array.from(new Set(inputItems.map((item) => item.productId)));
  const products = await tx.product.findMany({
    where: { storeId, id: { in: productIds } },
    include: { optionGroups: { include: { options: true }, orderBy: { sortOrder: "asc" } } }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  if (options.validateAvailableStock) {
    const demand = inputItems.reduce<Map<string, number>>((totals, item) => {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
      return totals;
    }, new Map());
    for (const [productId, quantity] of demand) {
      const product = productsById.get(productId);
      if (product?.stockQuantity !== null && product?.stockQuantity !== undefined && product.stockQuantity < quantity) {
        throw new Error(`Stock insuficiente para ${product.name}`);
      }
    }
  }
  const items = [];
  let total = 0;

  for (const inputItem of inputItems) {
    const product = productsById.get(inputItem.productId);
    if (!product) throw new Error("Uno de los productos seleccionados no existe.");
    const selectedIds = new Set(inputItem.selectedOptionIds);
    const validOptionIds = new Set(product.optionGroups.flatMap((group) => group.options.map((option) => option.id)));
    if (inputItem.selectedOptionIds.some((id) => !validOptionIds.has(id))) {
      throw new Error(`Una variante de ${product.name} no es válida.`);
    }
    const selectedOptions: Array<{ groupName: string; optionName: string; priceDelta: number }> = [];
    let unitPrice = getEffectiveProductPrice(product);
    for (const group of product.optionGroups) {
      const selected = group.options.filter((option) => selectedIds.has(option.id));
      if (group.isRequired && selected.length === 0) throw new Error(`Falta seleccionar ${group.name}.`);
      if (group.selectionType === "SINGLE" && selected.length > 1) throw new Error(`Solo se puede elegir una opción en ${group.name}.`);
      if (group.maxSelections && selected.length > group.maxSelections) throw new Error(`Máximo ${group.maxSelections} opción(es) en ${group.name}.`);
      for (const option of selected) {
        if (!option.isAvailable) throw new Error(`${option.name} no está disponible.`);
        unitPrice += option.priceDelta;
        selectedOptions.push({ groupName: group.name, optionName: option.name, priceDelta: option.priceDelta });
      }
    }
    const subtotal = unitPrice * inputItem.quantity;
    total += subtotal;
    items.push({ productId: product.id, productName: product.name, quantity: inputItem.quantity, unitPrice, options: selectedOptions, subtotal });
  }
  return { items, total };
}
