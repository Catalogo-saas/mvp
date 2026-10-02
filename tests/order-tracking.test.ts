import { describe, expect, it } from "vitest";

import { absoluteTrackingUrl, hashTrackingToken, trackingPath } from "../lib/order-tracking";

describe("order tracking links", () => {
  it("uses the approved public order-status shape", () => {
    const token = "example_opaque_token";
    expect(trackingPath("mi-tienda", token)).toBe("/mi-tienda/compra/proceso/orden?hash=example_opaque_token");
    expect(absoluteTrackingUrl("https://example.com", "mi-tienda", token)).toBe("https://example.com/mi-tienda/compra/proceso/orden?hash=example_opaque_token");
  });

  it("never stores the public token directly", () => {
    expect(hashTrackingToken("secret")).not.toBe("secret");
    expect(hashTrackingToken("secret")).toHaveLength(64);
  });
});
