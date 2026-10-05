import { describe, expect, it } from "vitest";
import catalog from "../prisma/strom-catalog.json";
import brand from "../prisma/strom-brand.json";
import { replaceStromImageReferences } from "../prisma/strom-images";
import { stromCategories, stromCommerce, stromExistingTemplateDesign, stromHome, stromTemplate, stromTheme } from "../prisma/strom-seed";
import { storeTemplates, getStoreThemeColors } from "../lib/catalog";
import { normalizeCheckoutSettings } from "../lib/commerce-settings";

describe("Strom demo", () => {
  it("incluye 24 productos con URLs públicas, procedencia y seis categorías completas", () => {
    expect(catalog).toHaveLength(24);
    expect(new Set(catalog.map(p => p.slug)).size).toBe(24);
    expect(stromCategories.map(([slug]) => catalog.filter(p => p.category === slug).length)).toEqual([6, 4, 4, 4, 4, 2]);
    for (const product of catalog) {
      expect(new URL(product.image).protocol).toBe("https:");
      expect(new URL(product.image).hostname).toBe("pub-adf22e48a50a4f26a24345e17a0b801d.r2.dev");
      expect(new URL(product.sourcePage).protocol).toBe("https:");
      expect(product.price).toBeGreaterThan(0);
      if (product.promoPrice !== null) expect(product.promoPrice).toBeLessThan(product.price);
      expect(new Set(product.options).size).toBe(product.options.length);
    }
    expect(catalog.filter(p => p.stromVerified)).toHaveLength(2);
    expect(catalog.filter(p => p.featured)).toHaveLength(8);
    expect(catalog.filter(p => p.promoPrice)).toHaveLength(4);
  });
  it("resuelve todas las selecciones de portada a identificadores del tenant", () => {
    const categoryIds = new Map(stromCategories.map(([slug]) => [slug, `category-${slug}`]));
    const productIds = new Map(catalog.map(p => [p.slug, `product-${p.slug}`]));
    const home = stromHome(categoryIds, productIds);
    expect(home.homeSections.map(s => s.type)).toEqual(["banners", "purchaseInfo", "featuredCategories", "productGroup", "productGroup"]);
    for (const section of home.homeSections) {
      expect(section.productIds.every(id => [...productIds.values()].includes(id))).toBe(true);
      expect(section.categoryIds.every(id => [...categoryIds.values()].includes(id))).toBe(true);
    }
  });
  it("usa Vene sin agregar plantillas, con banners y contenido editables", () => {
    expect(storeTemplates).toEqual(["roma", "dana", "vene"]);
    expect(stromTemplate).toBe("vene");
    expect(getStoreThemeColors(stromTemplate, stromTheme)).toMatchObject({ primary: "#151515", accent: "#ffdf00", useTemplateColors: false });
    const home = stromHome(new Map(stromCategories.map(([slug]) => [slug, slug])), new Map(catalog.map(product => [product.slug, product.slug])));
    const hero = home.homeSections[0];
    expect(hero.bannerItems).toHaveLength(2);
    expect(hero.bannerItems?.map(item => [item.desktop, item.mobile])).toEqual([[true, false], [false, true]]);
    expect(hero.bannerItems?.every(item => item.imageUrl.startsWith("https:") && item.title && item.description && item.link === "/productos")).toBe(true);
    const legacy = { publicPageConfig: { ...home, homeSections: home.homeSections.filter(section => section.type !== "purchaseInfo").map(section => section.type === "banners" ? { ...section, title: "Mi título", bannerItems: undefined } : section) }, designConfig: {}, heroTitle: null, heroSubtitle: null };
    const migrated = stromExistingTemplateDesign(legacy, home);
    expect(migrated.template).toBe("vene");
    expect(migrated.heroImageUrls).toEqual([]);
    expect(migrated.publicPageConfig.homeSections[0].bannerItems?.[0].title).toBe("Mi título");
    const custom = { ...legacy, publicPageConfig: home };
    expect(stromExistingTemplateDesign(custom, home).publicPageConfig.homeSections[0].bannerItems).toEqual(hero.bannerItems);
  });
  it("migra solo referencias locales conocidas y conserva imágenes personalizadas", () => {
    const original = { logo: "/strom/logo.webp", hero: ["/strom/1.webp", "/strom/7.webp"], draft: { imageUrl: "/strom/24.webp" }, custom: "https://example.com/own.webp", route: "/strom", missing: "/strom/unknown.webp", nullable: null };
    const migrated = replaceStromImageReferences(original);
    expect(migrated).toEqual({ ...original, logo: brand.logoUrl, hero: [catalog[0].image, catalog[6].image], draft: { imageUrl: catalog[23].image } });
    expect(original.logo).toBe("/strom/logo.webp");
    expect(replaceStromImageReferences(migrated)).toEqual(migrated);
    expect(new URL(brand.logoUrl).protocol).toBe("https:");
  });
  it("mantiene demoMode desactivado por defecto y pagos ficticios completos para Strom", () => {
    expect(normalizeCheckoutSettings({}).demoMode).toBe(false);
    const commerce = stromCommerce();
    expect(commerce.checkoutSettings.demoMode).toBe(true);
    expect(commerce.checkoutSettings.paymentMethods?.map(p => p.type)).toEqual(["cash", "transfer"]);
    expect(commerce.checkoutSettings.paymentMethods?.every(p => !p.requestReceipt)).toBe(true);
    expect(commerce.deliveryMethods.map(d => d.price)).toEqual([0, 4500]);
  });
});
