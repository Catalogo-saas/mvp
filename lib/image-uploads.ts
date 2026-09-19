import { randomUUID } from "node:crypto";

import {
  imageExtensions,
  isPendingImageKeyForStore,
  pendingImagePrefix,
  sniffImageMimeType,
  type ImageMimeType,
  type ImageReference,
  type ImageUploadScope,
  maxBytesForMimeType
} from "./image-upload-contract";
import {
  copyPublicObject,
  deletePublicObject,
  inspectObject,
  readObjectPrefix
} from "./storage";

export type PromotedImage = {
  key: string;
  pendingKey: string;
  url: string;
};

export function createPendingImageKey(storeId: string, scope: ImageUploadScope, contentType: ImageMimeType) {
  return `${pendingImagePrefix(storeId, scope)}${randomUUID()}.${imageExtensions[contentType]}`;
}

function permanentImagePrefix(scope: ImageUploadScope, storeId: string) {
  return `${scope}/${storeId}/`;
}

export async function promotePendingImage(input: {
  storeId: string;
  scope: ImageUploadScope;
  pendingKey: string;
}) {
  if (!isPendingImageKeyForStore(input.pendingKey, input.storeId, input.scope)) {
    throw new Error("La imagen temporal no pertenece a esta tienda.");
  }

  const [object, bytes] = await Promise.all([
    inspectObject(input.pendingKey),
    readObjectPrefix(input.pendingKey)
  ]);
  const contentType = object.contentType as ImageMimeType;
  if (!(contentType in imageExtensions)) {
    throw new Error("Formato de imagen no soportado.");
  }
  if (object.contentLength <= 0 || object.contentLength > maxBytesForMimeType(contentType)) {
    throw new Error(contentType === "image/gif" ? "El GIF no puede superar 10 MB." : "La imagen optimizada no puede superar 2 MB.");
  }

  if (sniffImageMimeType(bytes) !== contentType) {
    throw new Error("El contenido del archivo no coincide con su formato.");
  }

  const destinationKey = `${permanentImagePrefix(input.scope, input.storeId)}${randomUUID()}.${imageExtensions[contentType]}`;
  const url = await copyPublicObject({
    sourceKey: input.pendingKey,
    destinationKey,
    contentType,
    sourceEtag: object.etag
  });

  return { key: destinationKey, pendingKey: input.pendingKey, url } satisfies PromotedImage;
}

export async function resolveImageReferences(input: {
  storeId: string;
  scope: ImageUploadScope;
  references: ImageReference[];
  allowedStoredUrls: Iterable<string>;
}) {
  const allowedStoredUrls = new Set(input.allowedStoredUrls);
  for (const reference of input.references) {
    if (reference.kind === "stored" && !allowedStoredUrls.has(reference.url)) {
      throw new Error("Una imagen existente no pertenece a este registro.");
    }
  }

  const results = await Promise.allSettled(
    input.references.map(async (reference) => {
      if (reference.kind === "stored") {
        return { url: reference.url, promoted: null };
      }

      const promoted = await promotePendingImage({
        storeId: input.storeId,
        scope: input.scope,
        pendingKey: reference.key
      });
      return { url: promoted.url, promoted };
    })
  );
  const promoted = results.flatMap((result) =>
    result.status === "fulfilled" && result.value.promoted ? [result.value.promoted] : []
  );
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");

  if (failed) {
    await deletePromotedImages(promoted);
    throw failed.reason;
  }

  return {
    urls: results.map((result) => (result as PromiseFulfilledResult<{ url: string }>).value.url),
    promoted
  };
}

export async function deletePromotedImages(images: PromotedImage[]) {
  await Promise.all(images.map((image) => deletePublicObject(image.key).catch(() => null)));
}

export async function deletePromotedTemporaries(images: PromotedImage[]) {
  await Promise.all(images.map((image) => deletePublicObject(image.pendingKey).catch(() => null)));
}
