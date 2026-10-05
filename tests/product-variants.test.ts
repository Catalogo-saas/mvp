import { describe, expect, it } from "vitest";

import { selectedVariantKey, variantCombinations } from "../lib/product-variants";
import { calculateSelectedPrice, remainingSelectedStock } from "../lib/storefront-product-selection";
import { getCatalogPrices } from "../lib/catalog";

const groups = [
  { name: "Color", selectionType: "SINGLE", isRequired: true, options: [{ id: "red", name: "Rojo", priceDelta: 0, isAvailable: true }, { id: "blue", name: "Azul", priceDelta: 0, isAvailable: true }] },
  { name: "Talle", selectionType: "SINGLE", isRequired: true, options: [{ id: "s", name: "S", priceDelta: 0, isAvailable: true }, { id: "m", name: "M", priceDelta: 0, isAvailable: true }] }
];

describe("variant combinations", () => {
  it("inherits a parent's promotion only when the variant inherits its base price", () => {
    const key = selectedVariantKey(groups, ["blue", "m"]);
    const variant = { key, stockQuantity: 2, basePrice: null, promoPrice: null, isVisible: true, imageUrl: null };
    expect(getCatalogPrices({ basePrice: 1000, promoPrice: 900, variants: [variant] })).toEqual({ regular: 1000, effective: 900 });
    expect(getCatalogPrices({ basePrice: 1000, promoPrice: 900, variants: [{ ...variant, basePrice: 1200 }] })).toEqual({ regular: 1200, effective: 1200 });
  });
  it("generates every color/size combination", () => {
    const combinations = variantCombinations(groups);
    expect(combinations).toHaveLength(4);
    expect(combinations.some((item) => item.key === selectedVariantKey(groups, ["blue", "m"]))).toBe(true);
  });

  it("overrides price and tracks stock for the selected combination", () => {
    const key = selectedVariantKey(groups, ["blue", "m"]);
    const product = { id: "p1", basePrice: 1000, promoPrice: null, stockQuantity: null, optionGroups: groups, variants: [{ key, stockQuantity: 2, basePrice: 1300, promoPrice: 1200 }] };
    expect(calculateSelectedPrice(product, ["blue", "m"])).toBe(1200);
    expect(remainingSelectedStock(product, ["blue", "m"], [{ productId: "p1", quantity: 1, selectedOptionIds: ["blue", "m"] }])).toBe(1);
  });

  it("uses each combination's inventory without limiting it by legacy global stock", () => {
    const key = selectedVariantKey(groups, ["blue", "m"]);
    const product = { id: "p1", basePrice: 1000, promoPrice: null, stockQuantity: 0, optionGroups: groups, variants: [{ key, stockQuantity: 3, basePrice: 1300, promoPrice: null, isVisible: true, imageUrl: null }] };
    expect(remainingSelectedStock(product, ["blue", "m"], [])).toBe(3);
    expect(calculateSelectedPrice(product, ["blue", "m"])).toBe(1300);
  });

  it("hides an unavailable combination and displays the lowest visible offer", () => {
    const visibleKey = selectedVariantKey(groups, ["blue", "m"]);
    const hiddenKey = selectedVariantKey(groups, ["red", "s"]);
    const product = { id: "p1", basePrice: 5000, promoPrice: null, stockQuantity: null, optionGroups: groups, variants: [
      { key: hiddenKey, stockQuantity: 8, basePrice: 1000, promoPrice: null, isVisible: false, imageUrl: null },
      { key: visibleKey, stockQuantity: null, basePrice: 3000, promoPrice: 2400, isVisible: true, imageUrl: null }
    ] };
    expect(remainingSelectedStock(product, ["red", "s"], [])).toBe(0);
    expect(remainingSelectedStock(product, ["blue", "m"], [])).toBeNull();
    expect(getCatalogPrices(product)).toEqual({ regular: 3000, effective: 2400 });
  });
});
