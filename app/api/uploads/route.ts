import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { uploadPublicObject } from "@/lib/storage";

export const runtime = "nodejs";

const scopeSchema = z.enum(["logos", "products"]);

const extensionsByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const scopeResult = scopeSchema.safeParse(formData?.get("scope"));

  if (!(file instanceof File) || !scopeResult.success) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  if (!file.type.startsWith("image/") || !extensionsByType[file.type]) {
    return NextResponse.json({ error: "Formato de imagen no soportado" }, { status: 400 });
  }

  if (file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen no puede superar 6 MB" }, { status: 400 });
  }

  try {
    const extension = extensionsByType[file.type];
    const key = `${scopeResult.data}/${store.id}/${randomUUID()}.${extension}`;
    const url = await uploadPublicObject({
      key,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type
    });

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }
}
