import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ orderId: string }>;

const schema = z.object({
  status: z.enum(["PENDING_WHATSAPP", "PAID", "DELIVERED", "CANCELLED"])
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { orderId } = await params;
  const existingOrder = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id } });
  if (!existingOrder) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id: existingOrder.id },
    data: { status: result.data.status },
    include: { items: true }
  });

  return NextResponse.json({ order });
}
