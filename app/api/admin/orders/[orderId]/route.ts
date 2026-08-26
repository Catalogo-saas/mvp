import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/lib/generated/prisma/client";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ orderId: string }>;

const schema = z.object({
  status: z.enum(["PENDING_WHATSAPP", "PAID", "DELIVERED", "CANCELLED"])
});

type OrderItemForStock = {
  productId: string | null;
  productName: string;
  quantity: number;
};

function hasDiscountedStock(status: z.infer<typeof schema>["status"]) {
  return status === "PAID" || status === "DELIVERED";
}

async function decrementStockForItems(
  tx: Prisma.TransactionClient,
  items: OrderItemForStock[]
) {
  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        stockQuantity: { not: null, gte: item.quantity }
      },
      data: {
        stockQuantity: { decrement: item.quantity }
      }
    });

    if (updated.count > 0) {
      continue;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { name: true, stockQuantity: true }
    });
    if (!product || product.stockQuantity === null) {
      continue;
    }
    throw new Error(`Stock insuficiente para ${product.name || item.productName}`);
  }
}

async function restoreStockForItems(
  tx: Prisma.TransactionClient,
  items: OrderItemForStock[]
) {
  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    await tx.product.updateMany({
      where: {
        id: item.productId,
        stockQuantity: { not: null }
      },
      data: {
        stockQuantity: { increment: item.quantity }
      }
    });
  }
}

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

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const currentDiscounted = hasDiscountedStock(existingOrder.status);
      const nextDiscounted = hasDiscountedStock(result.data.status);

      if (!currentDiscounted && nextDiscounted) {
        await decrementStockForItems(tx, existingOrder.items);
      }
      if (currentDiscounted && !nextDiscounted) {
        await restoreStockForItems(tx, existingOrder.items);
      }

      return tx.order.update({
        where: { id: existingOrder.id },
        data: { status: result.data.status },
        include: { items: true }
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el pedido." }, { status: 409 });
  }

  return NextResponse.json({ order });
}
