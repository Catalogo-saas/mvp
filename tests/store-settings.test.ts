import { describe, expect, it } from "vitest";

import { formatArgentineInteger } from "../lib/store-settings";

describe("store settings formatting", () => {
  it("formats grouped Argentine integer amounts", () => {
    expect(formatArgentineInteger("80000")).toBe("80.000");
    expect(formatArgentineInteger("8.000")).toBe("8.000");
    expect(formatArgentineInteger(0)).toBe("0");
  });

  it("returns an empty string when the amount has no digits", () => {
    expect(formatArgentineInteger("abc")).toBe("");
    expect(formatArgentineInteger(null)).toBe("");
  });
});
