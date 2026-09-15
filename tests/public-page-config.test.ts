import { describe, expect, it } from "vitest";

import { defaultPublicPageConfig, normalizePublicPageConfig, publicSectionIds, safeSocialUrl } from "../lib/public-page-config";

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
    expect(config).toMatchObject({ version: 2, sections: ["featured", "categories", "catalog", "info"], categoriesTitle: "" });
    expect(config).not.toHaveProperty("homeMode");
  });

  it("only accepts web social links", () => {
    expect(safeSocialUrl("https://instagram.com/marca")).toBe("https://instagram.com/marca");
    expect(safeSocialUrl("javascript:alert(1)")).toBe("");
  });
});
