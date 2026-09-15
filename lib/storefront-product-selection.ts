type StorefrontOption = {
  id: string;
  priceDelta: number;
  isAvailable: boolean;
};

type StorefrontOptionGroup = {
  options: StorefrontOption[];
};

export type SelectableStorefrontProduct = {
  basePrice: number;
  promoPrice: number | null;
  stockQuantity: number | null;
  optionGroups: StorefrontOptionGroup[];
};

type CartStockLine = {
  productId: string;
  quantity: number;
};

function effectiveBasePrice(product: SelectableStorefrontProduct) {
  return product.promoPrice && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
}

export function calculateSelectedPrice(product: SelectableStorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce(
    (total, group) => total + group.options.reduce((sum, option) => selected.has(option.id) ? sum + option.priceDelta : sum, 0),
    effectiveBasePrice(product)
  );
}

export function isOptionAvailable(group: StorefrontOptionGroup, optionId: string) {
  return group.options.some((option) => option.id === optionId && option.isAvailable);
}

export function remainingProductStock(
  product: SelectableStorefrontProduct & { id: string },
  cart: CartStockLine[]
) {
  if (product.stockQuantity === null) return null;
  return product.stockQuantity - cart
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
}
