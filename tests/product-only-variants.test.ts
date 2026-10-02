import { describe, expect, it } from "vitest";
import { productSchema } from "../lib/admin-catalog";

describe("productos con variantes solamente", () => {
  it("rechaza extras de selección múltiple y recargos por opción", () => {
    const base = { name: "Remera", basePrice: 1000 };
    expect(productSchema.safeParse({ ...base, optionGroups: [{ name: "Extras", selectionType: "MULTIPLE", isRequired: false, maxSelections: 3, options: [{ name: "Otro", priceDelta: 100 }] }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, optionGroups: [{ name: "Color", selectionType: "SINGLE", isRequired: true, maxSelections: 1, options: [{ name: "Negro", priceDelta: 100 }] }] }).success).toBe(false);
  });

  it("acepta una variante obligatoria sin precio extra", () => {
    expect(productSchema.safeParse({ name: "Remera", basePrice: 1000, optionGroups: [{ name: "Color", selectionType: "SINGLE", isRequired: true, maxSelections: 1, options: [{ name: "Negro", priceDelta: "0" }] }] }).success).toBe(true);
  });
});
