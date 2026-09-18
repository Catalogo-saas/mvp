import { NextResponse } from "next/server";

import { maxBytesForMimeType, presignUploadSchema } from "@/lib/image-upload-contract";
import { createPendingImageKey } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { createPresignedUploadUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = presignUploadSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Solicitud de imagen inválida" }, { status: 400 });
  }

  const maximumSize = maxBytesForMimeType(result.data.contentType);
  if (result.data.size > maximumSize) {
    const label = result.data.contentType === "image/gif" ? "10 MB" : "2 MB";
    return NextResponse.json({ error: `La imagen procesada no puede superar ${label}.` }, { status: 400 });
  }

  try {
    const pendingKey = createPendingImageKey(store.id, result.data.scope, result.data.contentType);
    const uploadUrl = await createPresignedUploadUrl({
      key: pendingKey,
      contentType: result.data.contentType,
      expiresIn: 300
    });

    return NextResponse.json({
      uploadUrl,
      pendingKey,
      expiresIn: 300,
      headers: { "Content-Type": result.data.contentType }
    });
  } catch (error) {
    console.error("[image-upload] Failed to create presigned URL", error);
    return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500 });
  }
}
