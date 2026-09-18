import { describe, expect, it } from "vitest";

import {
  GIF_MAX_BYTES,
  imageReferenceSchema,
  isPendingImageKeyForStore,
  maxBytesForMimeType,
  sniffImageMimeType,
  STATIC_IMAGE_MAX_OUTPUT_BYTES,
  uploadFailureReportSchema
} from "../lib/image-upload-contract";

describe("image upload contract", () => {
  it("uses separate limits for optimized static images and animated GIFs", () => {
    expect(maxBytesForMimeType("image/webp")).toBe(STATIC_IMAGE_MAX_OUTPUT_BYTES);
    expect(maxBytesForMimeType("image/gif")).toBe(GIF_MAX_BYTES);
  });

  it("accepts only explicit stored or pending references", () => {
    expect(imageReferenceSchema.safeParse({ kind: "stored", url: "https://files.example/image.webp" }).success).toBe(true);
    expect(imageReferenceSchema.safeParse({ kind: "pending", key: "pending/store/products/id.webp" }).success).toBe(true);
    expect(imageReferenceSchema.safeParse({ kind: "stored", key: "missing-url" }).success).toBe(false);
  });

  it("keeps pending keys isolated by tenant and scope", () => {
    const key = "pending/store-a/products/123.webp";
    expect(isPendingImageKeyForStore(key, "store-a", "products")).toBe(true);
    expect(isPendingImageKeyForStore(key, "store-b", "products")).toBe(false);
    expect(isPendingImageKeyForStore(key, "store-a", "hero")).toBe(false);
    expect(isPendingImageKeyForStore(`${key}/nested`, "store-a", "products")).toBe(false);
  });

  it("keeps client failure reports limited to safe diagnostic fields", () => {
    const result = uploadFailureReportSchema.safeParse({
      stage: "direct-upload",
      scope: "products",
      reason: "http",
      status: 403,
      contentType: "image/webp",
      size: 1024,
      fileName: "private-name.webp",
      uploadUrl: "https://secret.example/presigned"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("fileName");
      expect(result.data).not.toHaveProperty("uploadUrl");
    }
  });
});

describe("image signature detection", () => {
  it("detects JPEG, PNG, WebP and GIF headers", () => {
    expect(sniffImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(sniffImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageMimeType(Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe("image/webp");
    expect(sniffImageMimeType(Uint8Array.from(Buffer.from("GIF89a")))).toBe("image/gif");
  });

  it("rejects a file whose bytes do not match an accepted image", () => {
    expect(sniffImageMimeType(Uint8Array.from(Buffer.from("not-an-image")))).toBeNull();
  });
});
