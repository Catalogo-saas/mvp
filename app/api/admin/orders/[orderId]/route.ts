import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getMerchantStore } from "@/lib/merchant";
import {
  adminOrderItemSchema,
  applyStockDelta,
  buildOrderItems,
  hasDiscountedStock,
  orderStatusSchema,
  restoreStockForItems,
  type OrderItemForStock
} from "@/lib/order-management";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ orderId: string }>;

const schema = z
  .object({
    status: orderStatusSchema.optional(),
    customerName: z.string().min(2).max(100).optional(),
    customerPhone: z.string().min(6).max(40).optional(),
    fulfillment: z.string().min(2).max(80).optional(),
    notes: z.string().max(500).nullable().optional(),
    items: z.array(adminOrderItemSchema).min(1).max(80).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export async function PATCH(request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { orderId } = await params;
  const existingOrder = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { items: true } });
  if (!existingOrder) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const nextStatus = result.data.status ?? existingOrder.status;
      const previousItems: OrderItemForStock[] = existingOrder.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity
      }));
      let nextItems = previousItems;
      let nextItemData: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        options: Prisma.InputJsonValue;
        subtotal: number;
      }> | null = null;
      let total = existingOrder.total;

      if (result.data.items) {
        const rebuilt = await buildOrderItems(tx, store.id, result.data.items);
        nextItemData = rebuilt.items;
        total = rebuilt.total;
        nextItems = rebuilt.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity
        }));
      }

      await applyStockDelta(tx, store.id, previousItems, nextItems, existingOrder.status, nextStatus);

      const checkout = existingOrder.checkout && typeof existingOrder.checkout === "object" && !Array.isArray(existingOrder.checkout)
        ? (existingOrder.checkout as Record<string, unknown>)
        : {};
      const nextCheckout = {
        ...checkout,
        ...(result.data.customerName !== undefined ? { customerName: result.data.customerName } : {}),
        ...(result.data.customerPhone !== undefined ? { customerPhone: result.data.customerPhone } : {}),
        ...(result.data.fulfillment !== undefined ? { fulfillment: result.data.fulfillment } : {}),
        ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
        status: nextStatus
      } as Prisma.InputJsonValue;

      const updated = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          ...(result.data.customerName !== undefined ? { customerName: result.data.customerName } : {}),
          ...(result.data.customerPhone !== undefined ? { customerPhone: result.data.customerPhone } : {}),
          ...(result.data.fulfillment !== undefined ? { fulfillment: result.data.fulfillment } : {}),
          ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
          status: nextStatus,
          total,
          checkout: nextCheckout,
          ...(nextItemData
            ? {
                items: {
                  deleteMany: {},
                  create: nextItemData
                }
              }
            : {})
        },
        include: { items: true }
      });
      return updated;
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el pedido." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const store = await getMerchantStore();
  if (!store) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { orderId } = await params;
  const existingOrder = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { items: true } });
  if (!existingOrder) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (hasDiscountedStock(existingOrder.status)) {
        await restoreStockForItems(
          tx,
          existingOrder.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity })),
          store.id
        );
      }
      await tx.order.delete({ where: { id: existingOrder.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el pedido." }, { status: 409 });
  }
}
