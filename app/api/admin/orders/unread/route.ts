import { NextResponse } from "next/server";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const count = await prisma.order.count({ where: { storeId: store.id, readAt: null } });
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
