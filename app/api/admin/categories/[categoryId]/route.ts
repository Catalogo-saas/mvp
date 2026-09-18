import { NextResponse } from "next/server";
import { z } from "zod";

import { imageReferenceSchema } from "@/lib/image-upload-contract";
import { deletePromotedImages, deletePromotedTemporaries, resolveImageReferences } from "@/lib/image-uploads";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  image: imageReferenceSchema.nullable().optional()
});

type Params = Promise<{ categoryId: string }>;

async function deleteCategoryImage(storeId: string, imageUrl: string | null) {
  const key = imageUrl ? getPublicObjectKeyFromUrl(imageUrl) : null;
  if (key?.startsWith(`categories/${storeId}/`)) {
    await deletePublicObject(key).catch(() => null);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { categoryId } = await params;
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId: store.id } });
  if (!category) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
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

  const collision = await prisma.category.findFirst({
    where: { storeId: store.id, slug, NOT: { id: category.id } }
  });
  if (collision) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const previousImageUrl = category.imageUrl;
  let imageUrl = category.imageUrl;
  let resolvedImages = { urls: [] as string[], promoted: [] as Awaited<ReturnType<typeof resolveImageReferences>>["promoted"] };
  try {
    if (result.data.image !== undefined) {
      if (result.data.image === null) {
        imageUrl = null;
      } else {
        resolvedImages = await resolveImageReferences({
          storeId: store.id,
          scope: "categories",
          references: [result.data.image],
          allowedStoredUrls: category.imageUrl ? [category.imageUrl] : []
        });
        imageUrl = resolvedImages.urls[0] ?? null;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo validar la imagen." }, { status: 400 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { name, slug, imageUrl },
      include: { _count: { select: { products: true } } }
    });
    if (previousImageUrl !== imageUrl) {
      await deleteCategoryImage(store.id, previousImageUrl);
    }
    await deletePromotedTemporaries(resolvedImages.promoted);
    return NextResponse.json({ category: updated });
  } catch (error) {
    await deletePromotedImages(resolvedImages.promoted);
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { categoryId } = await params;
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId: store.id } });
  if (!category) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  await prisma.category.delete({ where: { id: category.id } });
  await deleteCategoryImage(store.id, category.imageUrl);
  return NextResponse.json({ ok: true });
}
