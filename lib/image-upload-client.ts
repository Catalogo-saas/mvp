"use client";

import imageCompression from "browser-image-compression";

import {
  GIF_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  imageMimeTypes,
  STATIC_IMAGE_MAX_INPUT_BYTES,
  STATIC_IMAGE_MAX_OUTPUT_BYTES,
  type ImageReference,
  type ImageMimeType,
  type UploadFailureReport,
  type ImageUploadScope
} from "./image-upload-contract";

const acceptedMimeTypes = new Set<string>(imageMimeTypes);
const GENERIC_UPLOAD_ERROR = "No pudimos subir las imágenes. Revisá tu conexión e intentá nuevamente.";

export class ImageUploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImageUploadError";
  }
}

export function getImageUploadErrorMessage(error: unknown) {
  return error instanceof ImageUploadError ? error.message : null;
}

function megabytes(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}

export function validateSelectedImage(file: File) {
  if (!acceptedMimeTypes.has(file.type)) {
    return "Formato no soportado. Usá JPG, PNG, WebP o GIF.";
  }
  const limit = file.type === "image/gif" ? GIF_MAX_BYTES : STATIC_IMAGE_MAX_INPUT_BYTES;
  if (file.size > limit) {
    return `La imagen no puede superar ${megabytes(limit)} MB.`;
  }
  return null;
}

export async function optimizeImage(file: File) {
  const validationError = validateSelectedImage(file);
  if (validationError) throw new ImageUploadError(validationError);
  if (file.type === "image/gif") return file;

  let optimized: File;
  try {
    optimized = await imageCompression(file, {
      fileType: "image/webp",
      maxSizeMB: 2,
      maxWidthOrHeight: IMAGE_MAX_DIMENSION,
      preserveExif: false,
      useWebWorker: true
    });
  } catch (error) {
    console.error("[image-upload] Browser optimization failed", error);
    throw new ImageUploadError("No pudimos preparar una de las imágenes. Probá con otro archivo.", { cause: error });
  }
  if (optimized.size > STATIC_IMAGE_MAX_OUTPUT_BYTES) {
    throw new ImageUploadError("No pudimos reducir una de las imágenes al tamaño permitido.");
  }
  return new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", {
    type: "image/webp",
    lastModified: file.lastModified
  });
}

async function requestUpload(scope: ImageUploadScope, file: File) {
  let response: Response;
  try {
    response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, contentType: file.type, size: file.size })
    });
  } catch (error) {
    console.error("[image-upload] Presign request failed", error);
    throw new ImageUploadError(GENERIC_UPLOAD_ERROR, { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      throw new ImageUploadError("Tu sesión venció. Volvé a ingresar e intentá nuevamente.");
    }
    if (response.status === 400 && typeof data?.error === "string") {
      throw new ImageUploadError(data.error);
    }
    throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
  }
  return data as { uploadUrl: string; pendingKey: string };
}

function reportUploadFailure(report: UploadFailureReport) {
  void fetch("/api/uploads/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true
  }).catch(() => null);
}

export async function uploadImageDirect(scope: ImageUploadScope, source: File): Promise<ImageReference> {
  const file = await optimizeImage(source);
  const reportBase = {
    stage: "direct-upload",
    scope,
    contentType: file.type as ImageMimeType,
    size: file.size
  } as const;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { uploadUrl, pendingKey } = await requestUpload(scope, file);
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
    } catch (error) {
      if (attempt === 0) continue;
      console.error("[image-upload] Direct upload request failed", error);
      reportUploadFailure({ ...reportBase, reason: "network" });
      throw new ImageUploadError(GENERIC_UPLOAD_ERROR, { cause: error });
    }
    if (response.ok) return { kind: "pending", key: pendingKey };
    if (attempt === 1 || response.status !== 403) {
      console.error("[image-upload] Direct upload returned an error status", response.status);
      reportUploadFailure({ ...reportBase, reason: "http", status: response.status });
      throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
    }
  }

  throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown;

  async function worker() {
    while (nextIndex < items.length && firstError === undefined) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  if (firstError !== undefined) {
    throw firstError;
  }
  return results;
}
