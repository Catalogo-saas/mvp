import { describe, expect, it } from "vitest";

import { calculateSelectedPrice, isOptionAvailable, remainingProductStock } from "../lib/storefront-product-selection";

const product = {
  id: "product-1",
  basePrice: 1000,
  promoPrice: null,
  stockQuantity: 20,
  optionGroups: [
    { id: "color", name: "Color", selectionType: "SINGLE" as const, options: [
      { id: "red", name: "Rojo", priceDelta: 0, isAvailable: true },
      { id: "blue", name: "Azul", priceDelta: 50, isAvailable: true }
    ] },
    { id: "size", name: "Talle", selectionType: "SINGLE" as const, options: [
      { id: "s", name: "S", priceDelta: 0, isAvailable: true },
      { id: "m", name: "M", priceDelta: 100, isAvailable: true }
    ] }
  ]
};

describe("storefront product selection", () => {
  it("adds selected option deltas to the product price", () => {
    expect(calculateSelectedPrice(product, ["blue", "m"])).toBe(1150);
  });

  it("honors availability on each option", () => {
    expect(isOptionAvailable(product.optionGroups[0], "blue")).toBe(true);
    expect(isOptionAvailable(product.optionGroups[0], "missing")).toBe(false);
  });

  it("subtracts every cart line from product-level stock", () => {
    expect(remainingProductStock(product, [{ productId: product.id, quantity: 3 }, { productId: product.id, quantity: 2 }])).toBe(15);
  });
});
