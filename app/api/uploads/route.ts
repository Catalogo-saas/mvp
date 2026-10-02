import { NextResponse } from "next/server";

import { maxBytesForMimeType, presignUploadSchema, presignUploadsSchema } from "@/lib/image-upload-contract";
import { createPendingImageKey } from "@/lib/image-uploads";
import { getMerchantApiAccess } from "@/lib/merchant-authorization";
import { hasStorePermission } from "@/lib/store-permissions";
import { createPresignedUploadUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getMerchantApiAccess("operate");
  if (access.error) return access.error;
  const { store, role } = access.context;

  const body = await request.json().catch(() => null);
  const batchResult = presignUploadsSchema.safeParse(body);
  const legacyResult = presignUploadSchema.safeParse(body);
  if (!batchResult.success && !legacyResult.success) {
    return NextResponse.json({ error: "Solicitud de imagen inválida" }, { status: 400 });
  }
  const requestedUploads = batchResult.success
    ? batchResult.data.uploads
    : legacyResult.success
      ? [legacyResult.data]
      : [];

  for (const upload of requestedUploads) {
    if ((upload.scope === "logos" || upload.scope === "hero") && !hasStorePermission(role, "settings")) {
      return NextResponse.json({ error: "No tenés permisos para subir imágenes del diseño." }, { status: 403 });
    }
    const maximumSize = maxBytesForMimeType(upload.contentType);
    if (upload.size > maximumSize) {
      const label = upload.contentType === "image/gif" ? "10 MB" : "2 MB";
      return NextResponse.json({ error: `La imagen procesada no puede superar ${label}.` }, { status: 400 });
    }
  }

  try {
    const uploads = await Promise.all(
      requestedUploads.map(async (upload) => {
        const pendingKey = createPendingImageKey(store.id, upload.scope, upload.contentType);
        const uploadUrl = await createPresignedUploadUrl({
          key: pendingKey,
          contentType: upload.contentType,
          expiresIn: 300
        });

        return {
          uploadUrl,
          pendingKey,
          headers: { "Content-Type": upload.contentType }
        };
      })
    );

    if (!batchResult.success) {
      return NextResponse.json({ ...uploads[0], expiresIn: 300 });
    }

    return NextResponse.json({
      uploads,
      expiresIn: 300
    });
  } catch (error) {
    console.error("[image-upload] Failed to create presigned URL", error);
    return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500 });
  }
}
