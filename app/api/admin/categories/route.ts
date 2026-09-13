import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deletePublicObject, uploadPublicObject } from "@/lib/storage";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  imageUrl: z.string().url().optional().or(z.literal(""))
});

const imageExtensionsByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

async function parseCategoryPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), imageFile: null as File | null };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { body: null, imageFile: null as File | null };
  }
  const imageFile = formData.get("imageFile");
  return {
    body: {
      name: formData.get("name"),
      imageUrl: formData.get("imageUrl")
    },
    imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : null
  };
}

function validateImage(file: File) {
  if (!file.type.startsWith("image/") || !imageExtensionsByType[file.type]) {
    return "Formato de imagen no soportado.";
  }
  if (file.size > 6 * 1024 * 1024) {
    return "La imagen no puede superar 6 MB.";
  }
  return null;
}

export async function GET() {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { body, imageFile } = await parseCategoryPayload(request);
  const result = categorySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (imageFile) {
    const imageError = validateImage(imageFile);
    if (imageError) {
      return NextResponse.json({ error: imageError }, { status: 400 });
    }
  }

  const name = result.data.name.trim();
  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const exists = await prisma.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (exists) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  let imageUrl = result.data.imageUrl || null;
  let uploadedKey: string | null = null;
  if (imageFile) {
    const extension = imageExtensionsByType[imageFile.type];
    uploadedKey = `categories/${store.id}/${randomUUID()}.${extension}`;
    imageUrl = await uploadPublicObject({ key: uploadedKey, body: Buffer.from(await imageFile.arrayBuffer()), contentType: imageFile.type }).catch(() => null);
    if (!imageUrl) {
      return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
    }
  }

  try {
    const category = await prisma.category.create({
      data: { storeId: store.id, name, slug, imageUrl },
      include: { _count: { select: { products: true } } }
    });
    return NextResponse.json({ category });
  } catch (error) {
    if (uploadedKey) {
      await deletePublicObject(uploadedKey).catch(() => null);
    }
    throw error;
  }
}
