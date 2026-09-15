import { describe, expect, it } from "vitest";

import { buildProductSlug } from "../lib/product-slug";

describe("product slugs", () => {
  it("normalizes the title and appends a stable-sized unique identifier", () => {
    expect(buildProductSlug("  Remera Óversize Negra!!!  ", "a8f3c921")).toBe("remera-oversize-negra-a8f3c921");
  });

  it("never relies on the title alone", () => {
    expect(buildProductSlug("Remera", "11111111")).not.toBe(buildProductSlug("Remera", "22222222"));
  });
});
