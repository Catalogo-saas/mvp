import { NextResponse } from "next/server";
import { z } from "zod";

import { getEffectiveProductPrice } from "@/lib/catalog";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  storeSlug: z.string().min(2),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(6).max(40),
  fulfillment: z.string().min(2).max(80),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().int().min(1).max(99),
        selectedOptionIds: z.array(z.string()).default([])
      })
    )
    .min(1)
    .max(80)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { slug: result.data.storeSlug },
    include: {
      products: {
        where: {
          id: { in: result.data.items.map((item) => item.productId) },
          isVisible: true
        },
        include: {
          optionGroups: {
            include: {
              options: true
            }
          }
        }
      }
    }
  });

  if (!store?.isPublished) {
    return NextResponse.json({ error: "Tienda no disponible" }, { status: 404 });
  }

  const productsById = new Map(store.products.map((product) => [product.id, product]));
  const orderItems = [];
  let total = 0;

  for (const inputItem of result.data.items) {
    const product = productsById.get(inputItem.productId);
    if (!product) {
      return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
    }

    const selectedIds = new Set(inputItem.selectedOptionIds);
    const selectedOptions = [];
    let unitPrice = getEffectiveProductPrice(product);

    for (const group of product.optionGroups) {
      const selectedInGroup = group.options.filter((option) => selectedIds.has(option.id) && option.isAvailable);

      if (group.isRequired && selectedInGroup.length === 0) {
        return NextResponse.json({ error: `Falta seleccionar ${group.name}` }, { status: 400 });
      }

      if (group.selectionType === "SINGLE" && selectedInGroup.length > 1) {
        return NextResponse.json({ error: `Solo se puede elegir una opción en ${group.name}` }, { status: 400 });
      }

      if (group.maxSelections && selectedInGroup.length > group.maxSelections) {
        return NextResponse.json({ error: `Máximo ${group.maxSelections} opción(es) en ${group.name}` }, { status: 400 });
      }

      for (const option of selectedInGroup) {
        unitPrice += option.priceDelta;
        selectedOptions.push({
          groupName: group.name,
          optionName: option.name,
          priceDelta: option.priceDelta
        });
      }
    }

    const subtotal = unitPrice * inputItem.quantity;
    total += subtotal;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: inputItem.quantity,
      unitPrice,
      options: selectedOptions,
      subtotal
    });
  }

  const code = `PED-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      code,
      customerName: result.data.customerName,
      customerPhone: result.data.customerPhone,
      fulfillment: result.data.fulfillment,
      notes: result.data.notes,
      total,
      checkout: {
        customerName: result.data.customerName,
        customerPhone: result.data.customerPhone,
        fulfillment: result.data.fulfillment,
        notes: result.data.notes
      },
      items: {
        create: orderItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          options: item.options,
          subtotal: item.subtotal
        }))
      }
    },
    include: { items: true }
  });

  const whatsappUrl = buildWhatsAppOrderUrl({
    phone: store.whatsappPhone,
    storeName: store.name,
    code: order.code,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    notes: order.notes,
    items: orderItems,
    total: order.total
  });

  return NextResponse.json({ orderId: order.id, code: order.code, whatsappUrl });
}
