import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashTrackingToken } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";
import { receiptDownload, receiptMaxBytes, receiptMime } from "@/lib/order-receipt";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,50}$/.test(value);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("hash");
  if (!validToken(token)) return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });
  const order = await prisma.order.findFirst({ where: { trackingTokenHash: hashTrackingToken(token) }, select: { receiptKey: true, receiptName: true, receiptMimeType: true } });
  if (!order?.receiptKey) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  return receiptDownload(order.receiptKey, order.receiptName, order.receiptMimeType);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get("hash");
  const file = form?.get("file");
  if (!validToken(token) || !(file instanceof File) || file.size === 0 || file.size > receiptMaxBytes) return NextResponse.json({ error: "Elegí un archivo JPG, PNG, WebP o PDF de hasta 10 MB." }, { status: 400 });
  const order = await prisma.order.findFirst({ where: { trackingTokenHash: hashTrackingToken(token) }, select: { id: true, storeId: true, checkout: true, paymentStatus: true, receiptKey: true } });
  const checkout = order?.checkout && typeof order.checkout === "object" && !Array.isArray(order.checkout) ? order.checkout as Record<string, unknown> : null;
  if (!order || checkout?.requestReceipt !== true || order.paymentStatus !== "PENDING") return NextResponse.json({ error: "Este pedido no admite comprobantes." }, { status: 403 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = receiptMime(bytes);
  if (!mime || mime !== file.type) return NextResponse.json({ error: "El contenido del archivo no coincide con su formato." }, { status: 400 });
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const key = `receipts/${order.storeId}/${order.id}/${randomUUID()}.${ext}`;
  try {
    await putPrivateObject(key, bytes, mime);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (current.paymentStatus !== "PENDING") throw new Error("El pago ya fue procesado.");
      await tx.order.update({ where: { id: order.id }, data: { receiptKey: key, receiptName: file.name.slice(0, 180), receiptMimeType: mime, receiptUploadedAt: new Date() } });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "RECEIPT", label: "Comprobante adjuntado; pago pendiente de verificación" } });
    });
    if (order.receiptKey && order.receiptKey !== key) await deletePrivateObject(order.receiptKey).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await deletePrivateObject(key).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el comprobante." }, { status: 409 });
  }
}
