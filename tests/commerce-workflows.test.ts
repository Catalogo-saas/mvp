import { describe, expect, it } from "vitest";
import { compareProducts, matchesProductFilters, type ProductFilterSummary } from "../lib/admin-product-filters";
import { orderListWhere } from "../lib/admin-orders";

const product: ProductFilterSummary = { id: "a", name: "Camisa 2", sku: "SKU-2", basePrice: 1000, promoPrice: null, stockQuantity: null, variants: [], imageUrls: [], sortOrder: 0, createdAt: new Date("2026-09-20T12:00:00Z") };
const variant = { key: '[["Talle","S"]]', basePrice: 900, promoPrice: null, stockQuantity: 0, isVisible: true, imageUrl: null };
const matches = (fields: Partial<ProductFilterSummary>, filters: string) => matchesProductFilters({ ...product, ...fields }, new URLSearchParams(filters));

describe("filtros de productos", () => {
  it("considera el stock ilimitado y cero en productos simples", () => {
    expect(matches({}, "stock=available")).toBe(true);
    expect(matches({ stockQuantity: 0 }, "stock=out")).toBe(true);
    expect(matches({ stockQuantity: 0 }, "stock=available")).toBe(false);
  });
  it("usa las variantes visibles sin heredar stock del producto padre", () => {
    expect(matches({ variants: [variant] }, "stock=out&variants=yes")).toBe(true);
    expect(matches({ stockQuantity: 0, variants: [{ ...variant, stockQuantity: null }] }, "stock=available")).toBe(true);
    expect(matches({ variants: [{ ...variant, stockQuantity: 9, isVisible: false }] }, "stock=available")).toBe(false);
  });
  it("combina imágenes, variantes y descuentos efectivos", () => {
    expect(matches({ variants: [{ ...variant, promoPrice: 700 }], imageUrls: ["/photo.jpg"] }, "offer=yes&variants=yes&images=yes")).toBe(true);
    expect(matches({ variants: [{ ...variant, promoPrice: 900 }] }, "offer=yes")).toBe(false);
    expect(matches({ variants: [variant], promoPrice: 500 }, "offer=yes")).toBe(false);
    expect(matches({}, "variants=no&images=no&offer=no")).toBe(true);
  });
  it("ordena por nombre, SKU, precio efectivo y fecha en ambos sentidos", () => {
    const other = { ...product, id: "b", name: "Camisa 10", sku: "SKU-10", basePrice: 1500, createdAt: new Date("2026-09-25T12:00:00Z") };
    for (const sort of ["name", "sku", "price", "oldest"]) expect(compareProducts(product, other, sort)).toBeLessThan(0);
    for (const sort of ["name-desc", "sku-desc", "price-desc", "newest"]) expect(compareProducts(product, other, sort)).toBeGreaterThan(0);
    expect(compareProducts(product, { ...other, promoPrice: 500 }, "price")).toBeGreaterThan(0);
    expect(compareProducts({ ...product, variants: [{ ...variant, basePrice: 100 }] }, other, "price")).toBeLessThan(0);
  });
  it("desempata de forma estable para paginar sin duplicados", () => {
    expect(compareProducts(product, { ...product, id: "b" }, "name")).toBeLessThan(0);
  });
});

describe("estado de la venta", () => {
  it("muestra abiertas por defecto y conserva el alcance de tienda", () => {
    expect(orderListWhere("tenant-a", new URLSearchParams())).toEqual({ storeId: "tenant-a", archivedAt: null, status: { not: "CANCELLED" } });
  });
  it("incluye archivadas y canceladas cuando se piden no leídas", () => {
    expect(orderListWhere("tenant-a", new URLSearchParams("sale=unread"))).toEqual({ storeId: "tenant-a", readAt: null });
    expect(orderListWhere("tenant-a", new URLSearchParams("sale=all"))).toEqual({ storeId: "tenant-a" });
  });
  it("permite estados archivada y cancelada explícitos", () => {
    expect(orderListWhere("a", new URLSearchParams("sale=archived"))).toEqual({ storeId: "a", archivedAt: { not: null } });
    expect(orderListWhere("a", new URLSearchParams("sale=cancelled"))).toEqual({ storeId: "a", status: "CANCELLED" });
  });
});
