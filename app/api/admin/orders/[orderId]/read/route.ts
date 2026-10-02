import { NextResponse } from "next/server";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { orderId } = await params;
  // Reading is independent of the commercial version used for optimistic locking.
  const rows = await prisma.$queryRaw<Array<{ readAt: Date }>>`
    UPDATE "Order" SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP)
    WHERE id = ${orderId} AND "storeId" = ${store.id}
    RETURNING "readAt"
  `;
  if (!rows.length) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  const count = await prisma.order.count({ where: { storeId: store.id, readAt: null } });
  return NextResponse.json({ readAt: rows[0].readAt.toISOString(), count });
}
