import { describe, expect, it } from "vitest";
import { buildDemoCatalog, demoCommerce, demoDesign, demoHome, demoIdentities } from "../prisma/demo-data";
import { variantCombinationSchema, variantCombinations } from "../lib/product-variants";
import { designConfigSchema } from "../lib/design-config";
import { checkoutSettingsSchema, strictDeliveryMethods } from "../lib/commerce-settings";
import { publicPageConfigSchema } from "../lib/public-page-config";

for (const demo of demoIdentities) describe(`catálogo ${demo.name}`, () => {
  const catalog = buildDemoCatalog(demo.kind);
  it("ofrece 60 productos distintos, bien categorizados y con al menos 50 disponibles", () => {
    expect(catalog.products).toHaveLength(60);
    expect(new Set(catalog.products.map(p => p.slug)).size).toBe(60);
    expect(new Set(catalog.products.map(p => p.sku)).size).toBe(60);
    const slugs = new Set(catalog.categories.map(c => c.slug));
    for (const p of catalog.products) {
      expect(slugs.has(p.categorySlug)).toBe(true);
      expect(p.assignedSlugs.every(slug => slugs.has(slug))).toBe(true);
      expect(p.imageUrls.length).toBeGreaterThanOrEqual(2);
      expect(new Set(p.imageUrls).size).toBe(p.imageUrls.length);
      expect(p.description.length).toBeGreaterThan(200);
      expect(p.basePrice).toBeGreaterThan(0);
    }
    expect(catalog.products.filter(p => p.variants.length ? p.variants.some(v => v.isVisible && (v.stockQuantity === null || v.stockQuantity > 0)) : p.stockQuantity === null || p.stockQuantity > 0).length).toBeGreaterThanOrEqual(50);
    expect(catalog.products.some(p => p.variants.length ? p.variants.every(v => v.stockQuantity === 0) : p.stockQuantity === 0)).toBe(true);
    expect(catalog.categories.filter(c => c.parentSlug)).toHaveLength(12);
    for (const leaf of catalog.categories.filter(c => c.parentSlug)) expect(catalog.products.filter(p => p.categorySlug === leaf.slug)).toHaveLength(5);
  });
  it("usa combinaciones comprables y promociones válidas", () => {
    for (const p of catalog.products) {
      expect(p.variants.map(v => v.key)).toEqual(variantCombinations(p.groups).map(v => v.key));
      if (demo.kind === "clothing") expect(p.groups.map(g => g.name)).toEqual(["Talle", "Color"]);
      for (const v of p.variants) {
        expect(variantCombinationSchema.safeParse(v).success).toBe(true);
        if (v.promoPrice !== null) expect(v.promoPrice).toBeLessThan(v.basePrice);
        expect(p.imageUrls).toContain(v.imageUrl);
      }
      if (p.promoPrice !== null) expect(p.promoPrice).toBeLessThan(p.basePrice);
    }
  });
  it("configura siete secciones con referencias reales y compra válida", () => {
    const ids = new Map(catalog.categories.map(c => [c.slug, `cat-${c.slug}`]));
    const products = new Map(catalog.products.map(p => [p.slug, `product-${p.slug}`]));
    const home = demoHome(demo.kind, ids, products);
    expect(publicPageConfigSchema.safeParse(home).success).toBe(true);
    expect(home.homeSections).toHaveLength(7);
    for (const section of home.homeSections) {
      expect(section.productIds.every(id => [...products.values()].includes(id))).toBe(true);
      expect(section.categoryIds.every(id => [...ids.values()].includes(id))).toBe(true);
    }
    const commerce = demoCommerce(demo.kind);
    expect(checkoutSettingsSchema.safeParse(commerce.checkoutSettings).success).toBe(true);
    expect(strictDeliveryMethods(commerce.deliveryMethods).safeParse(commerce.deliveryMethods).success).toBe(true);
    expect(commerce.checkoutSettings.paymentMethods!.map(p => p.type)).toEqual(["cash", "transfer", "seller"]);
    expect(commerce.deliveryMethods.map(d => d.type)).toEqual(["pickup", "custom"]);
    expect(designConfigSchema.safeParse(demoDesign(demo.kind)).success).toBe(true);
  });
});

it("mantiene la demo NORTE exclusiva de prendas y las colecciones de NEXO separadas", () => {
  const ropa = buildDemoCatalog("clothing");
  expect(ropa.rootSlugs).toEqual(["mujer", "hombre"]);
  expect(ropa.products.some(p => /calzado|zapatilla|mochila|gorra|cartera/i.test(p.name))).toBe(false);
  expect(buildDemoCatalog("products").rootSlugs).toEqual(["decoracion", "cocina", "organizacion", "iluminacion", "audio", "tecnologia"]);
});
