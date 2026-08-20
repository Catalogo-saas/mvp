import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const categorySchema = z.object({
  name: z.string().min(2).max(80)
});

type Params = Promise<{ categoryId: string }>;

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

  const body = await request.json().catch(() => null);
  const result = categorySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const name = result.data.name.trim();
  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const collision = await prisma.category.findFirst({
    where: {
      storeId: store.id,
      slug,
      NOT: { id: category.id }
    }
  });
  if (collision) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: { name, slug },
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

  await prisma.category.delete({ where: { id: category.id } });
  return NextResponse.json({ ok: true });
}
