import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const categorySchema = z.object({
  name: z.string().min(2).max(80)
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

  const exists = await prisma.category.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (exists) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: {
      storeId: store.id,
      name,
      slug
    },
    include: { _count: { select: { products: true } } }
  });

  return NextResponse.json({ category });
}
