import { describe, expect, it } from "vitest";

import { createBannerItem, createHomeSection, defaultPublicPageConfig, featuredCategoryLayoutSlots, getBannerItems, normalizePublicPageConfig, publicSectionIds, safeBannerLink, safeSocialUrl } from "../lib/public-page-config";
import { purchaseInfoIconOptions } from "../lib/purchase-info-icon-options";

describe("public page configuration", () => {
  it("falls back safely when persisted data is invalid", () => {
    expect(normalizePublicPageConfig({ version: 99 })).toEqual(defaultPublicPageConfig);
  });

  it("deduplicates sections, ignores retired blocks and restores missing sections", () => {
    const config = normalizePublicPageConfig({ ...defaultPublicPageConfig, sections: ["catalog", "catalog"] });
    expect(config.sections).toEqual(["catalog", ...publicSectionIds.filter((section) => section !== "catalog")]);
  });

  it("upgrades legacy page configuration without retired fields", () => {
    const config = normalizePublicPageConfig({ ...defaultPublicPageConfig, version: 1, sections: ["featured", "categories", "catalog", "about", "info"], homeMode: "direct" });
    expect(config).toMatchObject({ version: 3, sections: ["featured", "categories", "catalog", "info"], categoriesTitle: "" });
    expect(config).not.toHaveProperty("homeMode");
  });

  it("only accepts web social links", () => {
    expect(safeSocialUrl("https://instagram.com/marca")).toBe("https://instagram.com/marca");
    expect(safeSocialUrl("javascript:alert(1)")).toBe("");
  });

  it("keeps edited homepage sections in their exact order and allows removal", () => {
    const sections = [createHomeSection("productGroup", "one"), createHomeSection("banners", "two")];
    sections[0].enabled = false;
    expect(normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: sections }).homeSections).toEqual(sections);
  });

  it("supports four purchase-info items and custom colors", () => {
    const sections = structuredClone(defaultPublicPageConfig.homeSections);
    const info = sections.find(section => section.type === "purchaseInfo")!;
    info.infoItems.push({ icon: "whatsapp", title: "Atención", text: "Escribinos" });
    info.infoColors = { mode: "custom", background: "#f5e5ee", text: "#25202a" };
    const normalized = normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: sections });
    expect(normalized.homeSections.find(section => section.type === "purchaseInfo")).toMatchObject({ infoItems: expect.arrayContaining([expect.objectContaining({ icon: "whatsapp" })]), infoColors: { mode: "custom", background: "#f5e5ee", text: "#25202a" } });
  });

  it("keeps purchase-info options visually unique and normalizes repeated selections", () => {
    expect(new Set(purchaseInfoIconOptions.map(option => option.icon)).size).toBe(purchaseInfoIconOptions.length);

    const section = createHomeSection("purchaseInfo", "purchase-info");
    const config = normalizePublicPageConfig({
      ...defaultPublicPageConfig,
      homeSections: [{ ...section, infoItems: section.infoItems.map(item => ({ ...item, icon: "truck" as const })) }]
    });
    const items = config.homeSections.find(item => item.type === "purchaseInfo")!.infoItems;

    expect(new Set(items.map(item => item.icon)).size).toBe(items.length);
  });

  it("keeps existing image banners editable and accepts new per-image settings", () => {
    const legacy = { ...createHomeSection("banners", "legacy"), images: ["https://example.com/one.jpg"] };
    const normalizedLegacy = normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: [legacy] }).homeSections[0];
    expect(getBannerItems(normalizedLegacy)).toMatchObject([{ imageUrl: legacy.images[0], desktop: true, mobile: true, title: "", description: "" }]);

    const item = { ...createBannerItem("https://example.com/two.jpg", "two"), mobile: false, title: "Oferta", link: "/productos", position: "top-right" as const };
    const configured = normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: [{ ...legacy, images: [], bannerItems: [item], bannerAutoplay: false, bannerHeight: "large" }] }).homeSections[0];
    expect(getBannerItems(configured)).toEqual([item]);
    expect(configured).toMatchObject({ bannerAutoplay: false, bannerHeight: "large" });
    const withOldButton = normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: [{ ...legacy, images: [], bannerItems: [{ ...item, showButton: true, buttonText: "Ver productos" }] }] });
    expect(getBannerItems(withOldButton.homeSections[0])[0]).not.toHaveProperty("buttonText");
  });

  it("accepts only shop paths and http links for banners", () => {
    expect(safeBannerLink("/productos?categoria=ropa", "demo")).toBe("/demo/productos?categoria=ropa");
    expect(safeBannerLink("https://example.com", "demo")).toBe("https://example.com/");
    expect(safeBannerLink("javascript:alert(1)", "demo")).toBe("");
    const item = { ...createBannerItem("https://example.com/banner.jpg", "one"), link: "javascript:alert(1)" };
    const invalid = normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: [{ ...createHomeSection("banners", "banner"), bannerItems: [item] }] });
    expect(invalid).toEqual(defaultPublicPageConfig);
  });

  it("supports six reference category layouts and visual options", () => {
    expect(["three-even", "four-even", "three-left", "four-right-bottom", "four-right-top", "five"].map(key => featuredCategoryLayoutSlots[key as keyof typeof featuredCategoryLayoutSlots])).toEqual([3, 4, 3, 4, 4, 5]);
    const categories = { ...createHomeSection("featuredCategories", "categories"), categoryLayout: "four-even", categorySpacing: "none", categoryColors: { mode: "custom", background: "#ffffff", text: "#202020" } };
    expect(normalizePublicPageConfig({ ...defaultPublicPageConfig, homeSections: [categories] }).homeSections[0]).toMatchObject(categories);
  });
});
