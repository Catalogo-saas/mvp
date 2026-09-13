import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getMerchantStore } from "@/lib/merchant";
import { adminOrderItemSchema, applyStockDelta, buildOrderItems, orderStatusSchema } from "@/lib/order-management";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(6).max(40),
  fulfillment: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(500).optional().nullable(),
  status: orderStatusSchema.default("PENDING_WHATSAPP"),
  items: z.array(adminOrderItemSchema).min(1).max(80)
});

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Revisá los datos del pedido." }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const rebuilt = await buildOrderItems(tx, store.id, result.data.items, { validateAvailableStock: true });
      const stockItems = rebuilt.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity }));
      await applyStockDelta(tx, store.id, [], stockItems, "PENDING_WHATSAPP", result.data.status);
      const notes = result.data.notes || null;
      return tx.order.create({
        data: {
          storeId: store.id,
          code: `PED-${randomUUID().slice(0, 6).toUpperCase()}`,
          status: result.data.status,
          source: "BACKOFFICE",
          customerName: result.data.customerName,
          customerPhone: result.data.customerPhone,
          fulfillment: result.data.fulfillment,
          notes,
          total: rebuilt.total,
          checkout: {
            source: "BACKOFFICE",
            customerName: result.data.customerName,
            customerPhone: result.data.customerPhone,
            fulfillment: result.data.fulfillment,
            notes,
            status: result.data.status
          },
          items: {
            create: rebuilt.items.map((item) => ({ ...item, options: item.options as Prisma.InputJsonValue }))
          }
        },
        include: { items: true }
      });
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el pedido." }, { status: 409 });
  }
}
