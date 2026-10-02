import { NextResponse } from "next/server";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { receiptDownload } from "@/lib/order-receipt";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const order = await prisma.order.findFirst({ where: { id: (await params).orderId, storeId: store.id }, select: { receiptKey: true, receiptName: true, receiptMimeType: true } });
  if (!order?.receiptKey) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  return receiptDownload(order.receiptKey, order.receiptName, order.receiptMimeType);
}
