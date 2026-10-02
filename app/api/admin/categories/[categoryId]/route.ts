import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";
import { categoryDescendantIds } from "@/lib/category-tree";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  parentId: z.string().nullable().optional()
}).strict();

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
  const parentId = result.data.parentId === undefined ? category.parentId : result.data.parentId;
  const parent = parentId ? await prisma.category.findFirst({ where: { id: parentId, storeId: store.id }, include: { parent: true } }) : null;
  if (parentId && (!parent || parent.id === category.id || parent.parentId === category.id || parent.parent?.parentId || await prisma.category.count({ where: { parentId: category.id } }))) {
    return NextResponse.json({ error: "La categoría no puede superar tres niveles ni formar ciclos." }, { status: 400 });
  }
  const slug = parent ? `${parent.slug}-${slugify(name)}` : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const collision = await prisma.category.findFirst({
    where: { storeId: store.id, slug, NOT: { id: category.id } }
  });
  if (collision) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { name, slug, ...(result.data.parentId !== undefined ? { parentId: result.data.parentId } : {}) },
      include: { _count: { select: { products: true } } }
    });
    return NextResponse.json({ category: updated });
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

  const categories = await prisma.category.findMany({ where: { storeId: store.id }, select: { id: true, parentId: true, imageUrl: true } });
  const ids = [...categoryDescendantIds(category.id, categories)];
  const images = categories.filter(item => ids.includes(item.id)).map(item => item.imageUrl);
  await prisma.category.deleteMany({ where: { storeId: store.id, id: { in: ids } } });
  await Promise.all(images.map(imageUrl => deleteCategoryImage(store.id, imageUrl)));
  return NextResponse.json({ ok: true });
}
