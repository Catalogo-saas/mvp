import { describe, expect, it } from "vitest";

import { publicStoreCanonicalUrl, publicStoreHref } from "../lib/public-store-url";

const store = { slug: "demo" };

describe("public store URLs", () => {
  it("always keeps the tenant slug in public paths", () => {
    expect(publicStoreHref(store, "/product/remera")).toBe("/demo/product/remera");
  });

  it("builds canonical metadata from the platform URL", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(publicStoreCanonicalUrl(store, "/product/remera")).toBe("https://app.example.com/demo/product/remera");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
});
