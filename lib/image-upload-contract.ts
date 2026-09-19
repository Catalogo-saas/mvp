import { z } from "zod";

export const STATIC_IMAGE_MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const STATIC_IMAGE_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const GIF_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 2560;

export const imageUploadScopes = ["products", "logos", "hero", "categories"] as const;
export type ImageUploadScope = (typeof imageUploadScopes)[number];

export const imageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageMimeType = (typeof imageMimeTypes)[number];

export const imageExtensions: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const imageReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stored"), url: z.string().url() }),
  z.object({ kind: z.literal("pending"), key: z.string().min(1).max(300) })
]);

export type ImageReference = z.infer<typeof imageReferenceSchema>;

export const presignUploadSchema = z.object({
  scope: z.enum(imageUploadScopes),
  contentType: z.enum(imageMimeTypes),
  size: z.number().int().positive()
});

export const presignUploadsSchema = z.object({
  uploads: z.array(presignUploadSchema).min(1).max(6)
});

export const uploadFailureReportSchema = z.object({
  stage: z.literal("direct-upload"),
  scope: z.enum(imageUploadScopes),
  reason: z.enum(["network", "http"]),
  status: z.number().int().min(400).max(599).optional(),
  contentType: z.enum(imageMimeTypes),
  size: z.number().int().positive().max(GIF_MAX_BYTES)
});

export type UploadFailureReport = z.infer<typeof uploadFailureReportSchema>;

export function maxBytesForMimeType(contentType: ImageMimeType) {
  return contentType === "image/gif" ? GIF_MAX_BYTES : STATIC_IMAGE_MAX_OUTPUT_BYTES;
}

const signatures: Record<ImageMimeType, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/webp": (bytes) =>
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  "image/gif": (bytes) => {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
};

export function pendingImagePrefix(storeId: string, scope: ImageUploadScope) {
  return `pending/${storeId}/${scope}/`;
}

export function isPendingImageKeyForStore(key: string, storeId: string, scope: ImageUploadScope) {
  const prefix = pendingImagePrefix(storeId, scope);
  return key.startsWith(prefix) && !key.slice(prefix.length).includes("/");
}

export function sniffImageMimeType(bytes: Uint8Array): ImageMimeType | null {
  const match = (Object.entries(signatures) as Array<[ImageMimeType, (input: Uint8Array) => boolean]>).find(([, test]) => test(bytes));
  return match?.[0] ?? null;
}
