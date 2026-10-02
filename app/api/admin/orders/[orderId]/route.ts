import { after, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { nextOrderState } from "@/lib/order-state";
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
import { notifyOrderStatus } from "@/lib/order-mail";
import { absoluteTrackingUrl, createTrackingToken } from "@/lib/order-tracking";
import { commerceError, commerceTransaction, lockProducts, lockStore } from "@/lib/commerce-transaction";
import { CheckoutError } from "@/lib/checkout-validation";
import { historicalTotals } from "@/lib/checkout-quote";

type Params = Promise<{ orderId: string }>;

const schema = z
  .object({
    expectedUpdatedAt: z.string().datetime().optional(),
    status: orderStatusSchema.optional(),
    paymentStatus: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
    fulfillmentStatus: z.enum(["PENDING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
    archived: z.boolean().optional(),
    customerName: z.string().min(2).max(100).optional(),
    customerPhone: z.string().min(6).max(40).optional(),
    fulfillment: z.string().min(2).max(80).optional(),
    notes: z.string().max(500).nullable().optional(),
    items: z.array(adminOrderItemSchema).min(1).max(80).optional()
  }).strict()
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
    let previousState = existingOrder;
    const order = await commerceTransaction(async (tx) => {
      await lockStore(tx, store.id);
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND "storeId" = ${store.id} FOR UPDATE`;
      const current = await tx.order.findFirst({where:{id:orderId,storeId:store.id},include:{items:true}});
      if (!current) throw new CheckoutError("ORDER_UNAVAILABLE", "Pedido no encontrado", 404);
      previousState = current;
      if (result.data.expectedUpdatedAt && current.updatedAt.toISOString() !== result.data.expectedUpdatedAt) throw new CheckoutError("ORDER_CHANGED", "La venta cambió. Actualizá la página antes de continuar.");
      await lockProducts(tx, store.id, [...current.items.map(item => item.productId), ...(result.data.items?.map(item => item.productId) ?? [])]);
      const existingOrder = current;
      const existingCheckout = existingOrder.checkout && typeof existingOrder.checkout === "object" && !Array.isArray(existingOrder.checkout)
        ? existingOrder.checkout as Record<string, unknown> : {};
      const legacyVariantGlobalStock = existingCheckout.stockMode !== "variant-exclusive";
      const {paymentStatus,fulfillmentStatus,status:nextStatus}=nextOrderState(current,result.data);
      const previousItems: OrderItemForStock[] = existingOrder.items.map((item) => ({
        productId: item.productId,
        variantKey: item.variantKey,
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
      let repriced: ReturnType<typeof historicalTotals> | null = null;

      if (result.data.items) {
        const rebuilt = await buildOrderItems(tx, store.id, result.data.items);
        nextItemData = rebuilt.items;
        repriced = historicalTotals(rebuilt.total, existingCheckout);
        total = repriced.total;
        nextItems = rebuilt.items.map((item) => ({
          productId: item.productId,
          variantKey: item.variantKey,
          productName: item.productName,
          quantity: item.quantity
        }));
      }

      await applyStockDelta(tx, store.id, previousItems, nextItems, existingOrder.status, nextStatus, existingOrder.stockReserved, legacyVariantGlobalStock);

      const checkout = existingOrder.checkout && typeof existingOrder.checkout === "object" && !Array.isArray(existingOrder.checkout)
        ? (existingOrder.checkout as Record<string, unknown>)
        : {};
      const nextCheckout = {
        ...checkout,
        ...(repriced ?? {}),
        ...(result.data.customerName !== undefined ? { customerName: result.data.customerName } : {}),
        ...(result.data.customerPhone !== undefined ? { customerPhone: result.data.customerPhone } : {}),
        ...(result.data.fulfillment !== undefined ? { fulfillment: result.data.fulfillment } : {}),
        ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
        status: nextStatus,
        stockMode: "variant-exclusive"
      } as Prisma.InputJsonValue;

      const updated = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          ...(result.data.customerName !== undefined ? { customerName: result.data.customerName } : {}),
          ...(result.data.customerPhone !== undefined ? { customerPhone: result.data.customerPhone } : {}),
          ...(result.data.fulfillment !== undefined ? { fulfillment: result.data.fulfillment } : {}),
          ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
          status: nextStatus,
          paymentStatus,
          fulfillmentStatus,
          ...(result.data.archived !== undefined ? { archivedAt: result.data.archived ? new Date() : null } : {}),
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
      if (paymentStatus !== existingOrder.paymentStatus) {
        await tx.orderEvent.create({ data: { orderId: existingOrder.id, type: "PAYMENT", label: paymentStatus === "CONFIRMED" ? "Pago confirmado" : paymentStatus === "CANCELLED" ? "Pago cancelado" : "Pago pendiente" } });
      }
      if (fulfillmentStatus !== existingOrder.fulfillmentStatus) {
        await tx.orderEvent.create({ data: { orderId: existingOrder.id, type: "FULFILLMENT", label: fulfillmentStatus === "PACKED" ? "Pedido empaquetado" : fulfillmentStatus === "SHIPPED" ? "Pedido enviado" : fulfillmentStatus === "DELIVERED" ? "Pedido entregado" : fulfillmentStatus === "CANCELLED" ? "Pedido cancelado" : "Por empaquetar" } });
      }
      if (result.data.archived !== undefined && Boolean(existingOrder.archivedAt) !== result.data.archived) await tx.orderEvent.create({ data: { orderId: existingOrder.id, type: "ARCHIVE", label: result.data.archived ? "Venta archivada" : "Venta restaurada" } });
      return updated;
    });

    let notificationWarning: string | null = null;
    if (order.source === "STOREFRONT" && order.trackingTokenHash && order.customerEmail && (order.paymentStatus !== previousState.paymentStatus || order.fulfillmentStatus !== previousState.fulfillmentStatus)) {
      const token = createTrackingToken(order.id, store.id);
      const trackingUrl = absoluteTrackingUrl(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin, store.slug, token);
      const label = order.status === "CANCELLED" ? "Pedido cancelado" : order.fulfillmentStatus === "DELIVERED" ? "Pedido entregado" : order.fulfillmentStatus === "SHIPPED" ? "Pedido enviado" : order.fulfillmentStatus === "PACKED" ? "Pedido empaquetado" : order.paymentStatus === "CONFIRMED" ? "Pago confirmado" : "Pago pendiente";
      const sellerEmail = (await prisma.user.findUnique({ where: { id: store.ownerId }, select: { email: true } }))?.email ?? "";
      const notification = { order, storeName: store.name, sellerEmail, trackingUrl, label };
      if (order.fulfillmentStatus === "SHIPPED") {
        if (!await notifyOrderStatus(notification)) notificationWarning = "El pedido se marcó como enviado, pero el correo no pudo enviarse. Contactá al cliente por otro medio.";
      } else after(() => notifyOrderStatus(notification));
    }

    return NextResponse.json({ order, notificationWarning });
  } catch (error) {
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
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
    await commerceTransaction(async (tx) => {
      await lockStore(tx, store.id);
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND "storeId" = ${store.id} FOR UPDATE`;
      const current = await tx.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { items: true } });
      if (!current) throw new CheckoutError("ORDER_UNAVAILABLE", "Pedido no encontrado", 404);
      await lockProducts(tx, store.id, current.items.map(item => item.productId));
      if (hasDiscountedStock(current.status, current.stockReserved)) {
        await restoreStockForItems(
          tx,
          current.items.map((item) => ({ productId: item.productId, variantKey: item.variantKey, productName: item.productName, quantity: item.quantity })),
          store.id,
          current.checkout && typeof current.checkout === "object" && !Array.isArray(current.checkout)
            ? (current.checkout as Record<string, unknown>).stockMode !== "variant-exclusive"
            : true
        );
      }
      await tx.order.delete({ where: { id: current.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
