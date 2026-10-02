import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  parentId: z.string().nullable().default(null)
}).strict();

export async function GET() {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    include: { _count: { select: { products: true, assignedProducts: true } } },
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
  const parent = result.data.parentId
    ? await prisma.category.findFirst({ where: { id: result.data.parentId, storeId: store.id }, include: { parent: true } })
    : null;
  if (result.data.parentId && (!parent || parent.parent?.parentId)) {
    return NextResponse.json({ error: "Solo se permiten tres niveles de categorías." }, { status: 400 });
  }
  const slug = parent ? `${parent.slug}-${slugify(name)}` : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const exists = await prisma.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (exists) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }
    const category = await prisma.category.create({
      data: { storeId: store.id, name, slug, parentId: result.data.parentId },
      include: { _count: { select: { products: true, assignedProducts: true } } }
    });
    return NextResponse.json({ category });
}
