import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("direct image uploads", () => {
  beforeEach(() => {
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
