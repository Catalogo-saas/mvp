import { z } from "zod";
import { selectedVariantKey, variantCombinationSchema, type VariantCombination } from "./product-variants";

export class CheckoutError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export const publicOrderItemSchema = z.object({
  productId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
  selectedOptionIds: z.array(z.string().min(1).max(128)).max(30).default([])
}).strict();
export type CheckoutItemInput = z.infer<typeof publicOrderItemSchema>;
export const maxMoney = 2147483647;
export function checkedMoney(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maxMoney) throw new CheckoutError("INVALID_AMOUNT", "El importe del pedido no es válido.", 400);
  return value;
}

// Catalog minimum prices are display-only. A selected combination inherits only its parent.
export function selectedUnitPrice(product: { basePrice: number; promoPrice: number | null }, variant?: VariantCombination) {
  const regular = variant?.basePrice ?? product.basePrice;
  const promo = variant ? variant.promoPrice ?? (variant.basePrice === null ? product.promoPrice : null) : product.promoPrice;
  return checkedMoney(promo !== null && promo > 0 && promo < regular ? promo : regular);
}

export type CheckoutProduct = {
  id: string; name: string; isVisible: boolean; basePrice: number; promoPrice: number | null;
  stockQuantity: number | null; variants: unknown; imageUrls: string[]; freeShipping: boolean;
  optionGroups: Array<{ name: string; selectionType: string; options: Array<{ id: string; name: string; isAvailable: boolean }> }>;
};

export function resolveCheckoutItem(product: CheckoutProduct | undefined, input: CheckoutItemInput, requireVisible = true) {
  if (!product || requireVisible && !product.isVisible) throw new CheckoutError("PRODUCT_UNAVAILABLE", "Uno de los productos ya no está disponible.");
  const ids = new Set(input.selectedOptionIds);
  if (ids.size !== input.selectedOptionIds.length) throw new CheckoutError("INVALID_OPTIONS", "Hay opciones repetidas en el pedido.", 400);
  const validIds = new Set(product.optionGroups.flatMap(group => group.options.map(option => option.id)));
  if (input.selectedOptionIds.some(id => !validIds.has(id))) throw new CheckoutError("INVALID_OPTIONS", `Revisá las opciones de ${product.name}.`);
  const options = product.optionGroups.flatMap(group => {
    const selected = group.options.filter(option => ids.has(option.id));
    if (group.selectionType !== "SINGLE" || selected.length !== 1 || !selected[0].isAvailable) throw new CheckoutError("INVALID_OPTIONS", `Elegí una opción disponible en ${group.name} de ${product.name}.`);
    return selected.map(option => ({ groupName: group.name, optionName: option.name, priceDelta: 0 }));
  });
  const parsedVariants = z.array(variantCombinationSchema).max(100).safeParse(product.variants);
  if (!parsedVariants.success || new Set(parsedVariants.data.map(v => v.key)).size !== parsedVariants.data.length) throw new CheckoutError("PRODUCT_UNAVAILABLE", `No se puede comprar ${product.name} en este momento.`);
  const variants = parsedVariants.data;
  const key = selectedVariantKey(product.optionGroups, input.selectedOptionIds);
  const variant = variants.find(value => value.key === key);
  if (variants.length && (!variant || !variant.isVisible)) throw new CheckoutError("VARIANT_UNAVAILABLE", `La combinación de ${product.name} ya no está disponible.`);
  const stock = variant ? variant.stockQuantity : product.stockQuantity;
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw new CheckoutError("PRODUCT_UNAVAILABLE", `Revisá el stock de ${product.name}.`);
  const unitPrice = selectedUnitPrice(product, variant);
  return {
    productId: product.id, variantKey: variant?.key ?? null, productName: product.name,
    imageUrl: variant?.imageUrl ?? product.imageUrls[0] ?? null,
    quantity: input.quantity, unitPrice, options, subtotal: checkedMoney(unitPrice * input.quantity), stock
  };
}

export function demandKey(item: { productId: string; variantKey: string | null }) { return JSON.stringify([item.productId, item.variantKey]); }

export function validateDemand(items: Array<ReturnType<typeof resolveCheckoutItem>>, validateStock = true) {
  const demand = new Map<string, number>();
  for (const item of items) {
    const key = demandKey(item);
    const quantity = (demand.get(key) ?? 0) + item.quantity;
    demand.set(key, quantity);
    if (quantity > 99) throw new CheckoutError("INVALID_QUANTITY", `El máximo por combinación de ${item.productName} es 99 unidades.`, 400);
    if (validateStock && item.stock !== null && quantity > item.stock) throw new CheckoutError("INSUFFICIENT_STOCK", `No hay suficiente stock de ${item.productName}.`);
  }
}
