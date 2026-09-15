import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { storefrontEventSchema } from "@/lib/storefront-events";

export async function POST(request: Request) {
  const payload = storefrontEventSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    where: { slug: payload.data.storeSlug, isPublished: true, owner: { status: "ACTIVE" } },
    select: { id: true }
  });
  if (!store) {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }

  let productId: string | null = null;
  if (payload.data.productId) {
    const product = await prisma.product.findFirst({
      where: { id: payload.data.productId, storeId: store.id, isVisible: true },
      select: { id: true }
    });
    productId = product?.id ?? null;
  }

  await prisma.storefrontEvent.create({
    data: {
      storeId: store.id,
      productId,
      type: payload.data.type,
      sessionId: payload.data.sessionId || null
    }
  });

  return new NextResponse(null, { status: 204 });
}
