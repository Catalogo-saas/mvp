import { NextResponse } from "next/server";
import { z } from "zod";

import { BusinessType } from "@/lib/generated/prisma/enums";
import { getCurrentUserId } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { reservedSlugs, slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().min(2).max(90),
  slug: z.string().min(2).max(64),
  whatsappPhone: z.string().min(8).max(30),
  businessType: z.nativeEnum(BusinessType).default("MIXED")
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const existingStore = await prisma.store.findFirst({ where: { ownerId: userId } });
  if (existingStore) {
    return NextResponse.json({ error: "El usuario ya tiene una tienda" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const slug = slugify(result.data.slug);
  if (!slug || reservedSlugs.has(slug)) {
    return NextResponse.json({ error: "Slug no disponible" }, { status: 400 });
  }

  const slugExists = await prisma.store.findUnique({ where: { slug } });
  if (slugExists) {
    return NextResponse.json({ error: "Slug no disponible" }, { status: 409 });
  }

  const store = await prisma.store.create({
    data: {
      ownerId: userId,
      name: result.data.name,
      slug,
      whatsappPhone: result.data.whatsappPhone,
      businessType: result.data.businessType,
      heroTitle: result.data.name,
      heroSubtitle: "Catálogo online con pedidos por WhatsApp"
    }
  });

  await prisma.category.create({
    data: {
      storeId: store.id,
      name: "Destacados",
      slug: "destacados"
    }
  });

  return NextResponse.json({ store });
}
