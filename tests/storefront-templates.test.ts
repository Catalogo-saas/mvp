import { describe, expect, it } from "vitest";
import { categoryDescendantIds } from "../lib/category-tree";
import { getStoreThemeColors, isPanelStorefrontTemplate, publicStoreTemplates } from "../lib/catalog";
import { normalizeDesignConfig } from "../lib/design-config";
import { publicCategoryCounts } from "../lib/public-categories";
import { contrastingTextColor } from "../lib/storefront-design";

describe("plantillas Roma, Dana y Vene", () => {
  it("mantiene la ficha compartida y el carrito en las tres plantillas", () => {
    for (const template of publicStoreTemplates) expect(isPanelStorefrontTemplate(template)).toBe(true);
  });
  it("usa la tipografía propia sin eliminar la personalización explícita", () => {
    expect(normalizeDesignConfig(null).font).toBe("template");
    expect(normalizeDesignConfig({ font: "serif" }).font).toBe("serif");
    expect(normalizeDesignConfig({ font: "sans" }).font).toBe("sans");
  });
  it("ofrece paletas diferentes y conserva los colores personalizados", () => {
    expect(new Set(publicStoreTemplates.map(template => getStoreThemeColors(template, { useTemplateColors: true }).primary)).size).toBe(publicStoreTemplates.length);
    for (const template of publicStoreTemplates) expect(getStoreThemeColors(template, { primary: "#123456", accent: "#abcdef", useTemplateColors: false })).toMatchObject({ primary: "#123456", accent: "#abcdef" });
  });
  it("filtra categorías principales incluyendo todas sus subcategorías", () => {
    const nodes = [{ id: "ropa" }, { id: "mujer", parentId: "ropa" }, { id: "remeras", parentId: "mujer" }, { id: "calzado" }];
    expect([...categoryDescendantIds("ropa", nodes)]).toEqual(["ropa", "mujer", "remeras"]);
    expect([...categoryDescendantIds("mujer", nodes)]).toEqual(["mujer", "remeras"]);
  });
  it("tolera árboles antiguos con ciclos sin bloquear la tienda", () => {
    expect([...categoryDescendantIds("a", [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }])]).toEqual(["a", "b"]);
  });
  it("cuenta productos únicos en toda la rama, incluyendo la relación anterior", () => {
    const categories = [
      { id: "root", parentId: null, products: [], assignedProducts: [] },
      { id: "child", parentId: "root", products: [{ id: "legacy" }, { id: "both" }], assignedProducts: [{ id: "both" }] },
      { id: "grandchild", parentId: "child", products: [], assignedProducts: [{ id: "both" }, { id: "new" }] },
      { id: "empty", parentId: null, products: [], assignedProducts: [] }
    ];
    expect(Object.fromEntries(publicCategoryCounts(categories))).toEqual({ root: 3, child: 3, grandchild: 2, empty: 0 });
  });
  it("elige texto legible para colores claros, oscuros e inválidos", () => {
    expect(contrastingTextColor("#ffffff")).toBe("#000000");
    expect(contrastingTextColor("#d99195")).toBe("#000000");
    expect(contrastingTextColor("#176877")).toBe("#ffffff");
    expect(contrastingTextColor("#000000")).toBe("#ffffff");
    expect(contrastingTextColor("invalid")).toBe("#ffffff");
  });
});
