import { normalizeVariants, selectedVariantKey } from "./product-variants";
import { selectedUnitPrice } from "./checkout-validation";

type StorefrontOption = {
  id: string;
  name?: string;
  priceDelta?: number;
  isAvailable: boolean;
};

type StorefrontOptionGroup = {
  name?: string;
  selectionType?: string;
  options: StorefrontOption[];
};

export type SelectableStorefrontProduct = {
  basePrice: number;
  promoPrice: number | null;
  stockQuantity: number | null;
  optionGroups: StorefrontOptionGroup[];
  variants?: unknown;
};

type CartStockLine = {
  productId: string;
  quantity: number;
};

export function calculateSelectedPrice(product: SelectableStorefrontProduct, selectedOptionIds: string[]) {
  const variant = normalizeVariants(product.variants).find((item) => item.key === selectedVariantKey(product.optionGroups.map((group) => ({ name: group.name ?? "", selectionType: group.selectionType, options: group.options.map((option) => ({ id: option.id, name: option.name ?? "" })) })), selectedOptionIds));
  return selectedUnitPrice(product, variant?.isVisible ? variant : undefined);
}

export function remainingSelectedStock(product: SelectableStorefrontProduct & { id: string }, selectedOptionIds: string[], cart: Array<CartStockLine & { selectedOptionIds?: string[] }>) {
  const key = selectedVariantKey(product.optionGroups.map((group) => ({ name: group.name ?? "", selectionType: group.selectionType, options: group.options.map((option) => ({ id: option.id, name: option.name ?? "" })) })), selectedOptionIds);
  const variant = normalizeVariants(product.variants).find((item) => item.key === key);
  if (!variant) return normalizeVariants(product.variants).length ? 0 : remainingProductStock(product, cart);
  if (!variant.isVisible) return 0;
  if (variant.stockQuantity === null) return null;
  const inCart = cart.filter((item) => item.productId === product.id && selectedVariantKey(product.optionGroups.map((group) => ({ name: group.name ?? "", selectionType: group.selectionType, options: group.options.map((option) => ({ id: option.id, name: option.name ?? "" })) })), item.selectedOptionIds ?? []) === key).reduce((sum, item) => sum + item.quantity, 0);
  const available = variant.stockQuantity - inCart;
  return available;
}

export function isOptionAvailable(group: StorefrontOptionGroup, optionId: string) {
  return group.options.some((option) => option.id === optionId && option.isAvailable);
}

export function remainingProductStock(
  product: SelectableStorefrontProduct & { id: string },
  cart: CartStockLine[]
) {
  if (normalizeVariants(product.variants).length) return null;
  if (product.stockQuantity === null) return null;
  return product.stockQuantity - cart
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
}
