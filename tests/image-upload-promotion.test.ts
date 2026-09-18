import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  copyPublicObject: vi.fn(),
  deletePublicObject: vi.fn(),
  inspectObject: vi.fn(),
  readObjectPrefix: vi.fn()
}));

vi.mock("../lib/storage", () => storage);

import { resolveImageReferences } from "../lib/image-uploads";

const webpHeader = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("pending image promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.inspectObject.mockResolvedValue({ contentLength: 1024, contentType: "image/webp", etag: '"etag"' });
    storage.readObjectPrefix.mockResolvedValue(webpHeader);
    storage.copyPublicObject.mockImplementation(async ({ destinationKey }: { destinationKey: string }) => `https://files.example/${destinationKey}`);
    storage.deletePublicObject.mockResolvedValue(undefined);
  });

  it("preserves reference order while promoting pending images", async () => {
    const result = await resolveImageReferences({
      storeId: "store-a",
      scope: "products",
      references: [
        { kind: "pending", key: "pending/store-a/products/first.webp" },
        { kind: "stored", url: "https://files.example/products/store-a/existing.webp" }
      ],
      allowedStoredUrls: ["https://files.example/products/store-a/existing.webp"]
    });

    expect(result.urls).toHaveLength(2);
    expect(result.urls[0]).toContain("products/store-a/");
    expect(result.urls[1]).toBe("https://files.example/products/store-a/existing.webp");
    expect(storage.copyPublicObject).toHaveBeenCalledWith(expect.objectContaining({ sourceEtag: '"etag"' }));
  });

  it("rejects stored URLs that are not attached to the edited entity", async () => {
    await expect(
      resolveImageReferences({
        storeId: "store-a",
        scope: "products",
        references: [{ kind: "stored", url: "https://attacker.example/image.webp" }],
        allowedStoredUrls: []
      })
    ).rejects.toThrow("no pertenece");
  });

  it("removes already promoted objects when a later promotion fails", async () => {
    storage.inspectObject
      .mockResolvedValueOnce({ contentLength: 1024, contentType: "image/webp", etag: '"etag-1"' })
      .mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(
      resolveImageReferences({
        storeId: "store-a",
        scope: "products",
        references: [
          { kind: "pending", key: "pending/store-a/products/first.webp" },
          { kind: "pending", key: "pending/store-a/products/second.webp" }
        ],
        allowedStoredUrls: []
      })
    ).rejects.toThrow("R2 unavailable");

    expect(storage.deletePublicObject).toHaveBeenCalledTimes(1);
    expect(storage.deletePublicObject).toHaveBeenCalledWith(expect.stringContaining("products/store-a/"));
  });
});
