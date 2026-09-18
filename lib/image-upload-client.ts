"use client";

import imageCompression from "browser-image-compression";

import {
  GIF_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  imageMimeTypes,
  STATIC_IMAGE_MAX_INPUT_BYTES,
  STATIC_IMAGE_MAX_OUTPUT_BYTES,
  type ImageReference,
  type ImageUploadScope
} from "@/lib/image-upload-contract";

const acceptedMimeTypes = new Set<string>(imageMimeTypes);

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
  if (validationError) throw new Error(validationError);
  if (file.type === "image/gif") return file;

  const optimized = await imageCompression(file, {
    fileType: "image/webp",
    maxSizeMB: 2,
    maxWidthOrHeight: IMAGE_MAX_DIMENSION,
    preserveExif: false,
    useWebWorker: true
  });
  if (optimized.size > STATIC_IMAGE_MAX_OUTPUT_BYTES) {
    throw new Error("No se pudo reducir la imagen por debajo de 2 MB.");
  }
  return new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", {
    type: "image/webp",
    lastModified: file.lastModified
  });
}

async function requestUpload(scope: ImageUploadScope, file: File) {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, contentType: file.type, size: file.size })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "No se pudo preparar la subida.");
  }
  return data as { uploadUrl: string; pendingKey: string };
}

export async function uploadImageDirect(scope: ImageUploadScope, source: File): Promise<ImageReference> {
  const file = await optimizeImage(source);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { uploadUrl, pendingKey } = await requestUpload(scope, file);
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
    } catch {
      if (attempt === 0) continue;
      throw new Error("No se pudo conectar con R2. Revisá tu conexión y la configuración CORS.");
    }
    if (response.ok) return { kind: "pending", key: pendingKey };
    if (attempt === 1 || response.status !== 403) {
      throw new Error("No se pudo subir la imagen a R2. Revisá tu conexión e intentá nuevamente.");
    }
  }

  throw new Error("No se pudo subir la imagen.");
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
