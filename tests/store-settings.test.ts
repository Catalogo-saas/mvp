import { describe, expect, it } from "vitest";

import { formatArgentineInteger, formatArgentineLocalPhone, isCompleteArgentineLocalPhone } from "../lib/store-settings";

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

  it("formats customer phone numbers and strips non-digits", () => {
    expect(formatArgentineLocalPhone("381abc1234567")).toBe("381 123-4567");
    expect(formatArgentineLocalPhone("381123456789")).toBe("381 123-4567");
    expect(formatArgentineLocalPhone("381123")).toBe("381 123");
  });

  it("recognizes complete local phone numbers", () => {
    expect(isCompleteArgentineLocalPhone("381 123-4567")).toBe(true);
    expect(isCompleteArgentineLocalPhone("381 123-456")).toBe(false);
  });
});
