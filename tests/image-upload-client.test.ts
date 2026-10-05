import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import imageCompression from "browser-image-compression";

vi.mock("browser-image-compression", () => ({
  default: vi.fn()
}));

import {
  getImageUploadErrorMessage,
  mapWithConcurrency,
  prepareImageUploads,
  uploadImageDirect,
  uploadImagesDirect
} from "../lib/image-upload-client";
import { STATIC_IMAGE_MAX_OUTPUT_BYTES } from "../lib/image-upload-contract";

const webpHeader = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80];
const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("direct image uploads", () => {
  beforeEach(() => {
    vi.mocked(imageCompression).mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a pending reference after a successful direct upload", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploads: [{ uploadUrl: "https://uploads.example/signed", pendingKey: "pending/store/products/id.gif" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const file = new File(["GIF89a"], "product.gif", { type: "image/gif" });

    await expect(uploadImageDirect("products", file)).resolves.toEqual({
      kind: "pending",
      key: "pending/store/products/id.gif"
    });
    expect(imageCompression).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[1][1]?.body).toBe(file);
  });

  it.each([
    { format: "WebP", header: webpHeader, declaredType: "image/webp", expectedType: "image/webp", extension: "webp" },
    { format: "PNG", header: pngHeader, declaredType: "image/png", expectedType: "image/png", extension: "png" },
    { format: "JPEG", header: [0xff, 0xd8, 0xff, 0x00], declaredType: "image/jpeg", expectedType: "image/jpeg", extension: "jpg" },
    { format: "PNG mislabeled as WebP", header: pngHeader, declaredType: "image/webp", expectedType: "image/png", extension: "png" }
  ])("uploads a WebP source compressed to $format with matching metadata", async ({ header, declaredType, expectedType, extension }) => {
    const optimized = new File([Uint8Array.from(header)], "compressed.webp", { type: declaredType });
    vi.mocked(imageCompression).mockResolvedValueOnce(optimized);
    const fetchMock = vi.mocked(fetch);
    const pendingKey = `pending/store/products/id.${extension}`;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploads: [{ uploadUrl: "https://uploads.example/signed", pendingKey }] }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const file = new File([Uint8Array.from(webpHeader)], "product.photo.webp", { type: "image/webp", lastModified: 1234 });

    await expect(uploadImageDirect("products", file)).resolves.toEqual({ kind: "pending", key: pendingKey });

    const presignRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(presignRequest).toEqual({ uploads: [{ scope: "products", contentType: expectedType, size: optimized.size }] });
    const putRequest = fetchMock.mock.calls[1][1];
    expect(putRequest?.headers).toEqual({ "Content-Type": expectedType });
    const uploadedFile = putRequest?.body as File;
    expect(uploadedFile.type).toBe(expectedType);
    expect(uploadedFile.name).toBe(`product.photo.${extension}`);
    expect(uploadedFile.lastModified).toBe(file.lastModified);
    expect(new Uint8Array(await uploadedFile.arrayBuffer())).toEqual(Uint8Array.from(header));
  });

  it.each(["not-an-image", "", "GIF89a"])("rejects unsupported compressed content %j before requesting an upload", async (content) => {
    vi.mocked(imageCompression).mockResolvedValueOnce(new File([content], "compressed.webp", { type: "image/webp" }));
    const file = new File([Uint8Array.from(webpHeader)], "product.webp", { type: "image/webp" });

    const error = await uploadImageDirect("products", file).catch((caught) => caught);

    expect(getImageUploadErrorMessage(error)).toBe("La imagen procesada tiene un formato no soportado. Probá con otro archivo.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a PNG fallback above the optimized size limit before requesting an upload", async () => {
    const bytes = new Uint8Array(STATIC_IMAGE_MAX_OUTPUT_BYTES + 1);
    bytes.set(pngHeader);
    vi.mocked(imageCompression).mockResolvedValueOnce(new File([bytes], "compressed.png", { type: "image/png" }));
    const file = new File([Uint8Array.from(webpHeader)], "product.webp", { type: "image/webp" });

    const error = await uploadImageDirect("products", file).catch((caught) => caught);

    expect(getImageUploadErrorMessage(error)).toBe("No pudimos reducir una de las imágenes al tamaño permitido.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a safe message and reports only safe metadata after network retries fail", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploads: [{ uploadUrl: "https://uploads.example/first", pendingKey: "pending/store/products/first.gif" }] }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ uploads: [{ uploadUrl: "https://uploads.example/second", pendingKey: "pending/store/products/second.gif" }] }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const file = new File(["GIF89a"], "private-name.gif", { type: "image/gif" });
    const error = await uploadImageDirect("products", file).catch((caught) => caught);

    expect(getImageUploadErrorMessage(error)).toBe("No pudimos subir las imágenes. Revisá tu conexión e intentá nuevamente.");
    expect(getImageUploadErrorMessage(error)).not.toMatch(/R2|CORS|S3/i);

    const reportCall = fetchMock.mock.calls[4];
    expect(reportCall[0]).toBe("/api/uploads/report");
    const report = JSON.parse(String(reportCall[1]?.body));
    expect(report).toEqual({
      stage: "direct-upload",
      scope: "products",
      reason: "network",
      contentType: "image/gif",
      size: file.size
    });
    expect(JSON.stringify(report)).not.toContain("private-name.gif");
    expect(JSON.stringify(report)).not.toContain("uploads.example");
  });

  it("reports an HTTP failure without exposing the storage response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ uploads: [{ uploadUrl: "https://uploads.example/signed", pendingKey: "pending/store/hero/id.gif" }] }))
      .mockResolvedValueOnce(new Response("private storage error", { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const file = new File(["GIF89a"], "hero.gif", { type: "image/gif" });
    const error = await uploadImageDirect("hero", file).catch((caught) => caught);

    expect(getImageUploadErrorMessage(error)).toBe("No pudimos subir las imágenes. Revisá tu conexión e intentá nuevamente.");
    const report = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(report).toEqual({
      stage: "direct-upload",
      scope: "hero",
      reason: "http",
      status: 500,
      contentType: "image/gif",
      size: file.size
    });
    expect(JSON.stringify(report)).not.toContain("private storage error");
  });

  it("prepares several uploads with a single API request", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        uploads: [
          { uploadUrl: "https://uploads.example/first", pendingKey: "pending/store/products/first.gif" },
          { uploadUrl: "https://uploads.example/second", pendingKey: "pending/store/products/second.gif" }
        ]
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const files = [
      new File(["GIF89a"], "first.gif", { type: "image/gif" }),
      new File(["GIF89a"], "second.gif", { type: "image/gif" })
    ];

    await expect(uploadImagesDirect(files.map((file) => ({ scope: "products", file })))).resolves.toEqual([
      { kind: "pending", key: "pending/store/products/first.gif" },
      { kind: "pending", key: "pending/store/products/second.gif" }
    ]);

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/uploads")).toHaveLength(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.uploads).toHaveLength(2);
  });

  it("reuses uploads started while the user is still editing", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        uploads: [
          { uploadUrl: "https://uploads.example/early", pendingKey: "pending/store/products/early.gif" }
        ]
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const file = new File(["GIF89a"], "early.gif", { type: "image/gif" });
    const tasks = [{ scope: "products" as const, file }];

    prepareImageUploads(tasks);
    await expect(uploadImagesDirect(tasks)).resolves.toEqual([
      { kind: "pending", key: "pending/store/products/early.gif" }
    ]);

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/uploads")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === "https://uploads.example/early")).toHaveLength(1);
  });
});

describe("concurrent image work", () => {
  it("waits for active work and stops queued work after the first failure", async () => {
    let releaseFirst!: () => void;
    const firstTask = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started: number[] = [];
    const failure = new Error("upload failed");

    const operation = mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item === 0) await firstTask;
      if (item === 1) throw failure;
      return item;
    });

    let settled = false;
    void operation.then(
      () => { settled = true; },
      () => { settled = true; }
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(started).toEqual([0, 1]);

    releaseFirst();
    await expect(operation).rejects.toBe(failure);
    expect(started).toEqual([0, 1]);
  });
});
