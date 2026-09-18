import { NextResponse } from "next/server";
import { z } from "zod";

import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { deletePromotedImages, deletePromotedTemporaries, resolveImageReferences } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  image: imageReferenceSchema.nullable().default(null)
});

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

  const result = categorySchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
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

  let resolvedImages = { urls: [] as string[], promoted: [] as Awaited<ReturnType<typeof resolveImageReferences>>["promoted"] };
  try {
    if (result.data.image) {
      resolvedImages = await resolveImageReferences({
        storeId: store.id,
        scope: "categories",
        references: [result.data.image],
        allowedStoredUrls: []
      });
    }
  } catch (error) {
    console.error("[image-upload] Failed to promote category image", error);
    return NextResponse.json({ error: "No pudimos procesar la imagen. Intentá nuevamente." }, { status: 400 });
  }
  const imageUrl = resolvedImages.urls[0] ?? null;

  try {
    const category = await prisma.category.create({
      data: { storeId: store.id, name, slug, imageUrl },
      include: { _count: { select: { products: true } } }
    });
    await deletePromotedTemporaries(resolvedImages.promoted);
    return NextResponse.json({ category });
  } catch (error) {
    await deletePromotedImages(resolvedImages.promoted);
    throw error;
  }
}
