import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { paymentMethodSnapshot } from "@/lib/commerce-settings";
import { notifyNewOrder } from "@/lib/order-mail";
import { decrementStockForItems } from "@/lib/order-management";
import { absoluteTrackingUrl, createTrackingToken, hashTrackingToken, trackingPath } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";
import { argentinaProvinces } from "@/lib/argentina-provinces";
import { CheckoutError, publicOrderItemSchema } from "@/lib/checkout-validation";
import { buildCheckoutQuote, requestFingerprint, verifyQuote } from "@/lib/checkout-quote";
import { commerceError, commerceTransaction, lockProducts, lockStore } from "@/lib/commerce-transaction";

const orderRequestSchema = z.object({
  storeSlug: z.string().min(2).max(128),
  idempotencyKey: z.string().uuid(),
  quoteToken: z.string().min(1).max(1024),
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  customerPhone: z.string().trim().max(40).default(""),
  dni: z.string().trim().max(30).optional(),
  deliveryAddress: z.string().trim().max(220).default(""),
  province: z.string().trim().max(80).default(""),
  city: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(12).default(""),
  billingAddress: z.string().trim().max(220).optional(),
  deliveryMethodId: z.string().min(1).max(80),
  notes: z.string().trim().max(500).optional(),
  paymentMethodId: z.string().trim().min(1).max(80).optional(),
  paymentMethod: z.enum(["cash", "transfer", "seller", "custom"]).optional(),
  items: z.array(publicOrderItemSchema).min(1).max(80)
}).strict().refine(input => Boolean(input.paymentMethodId || input.paymentMethod), { path: ["paymentMethodId"], message: "Elegí un método de pago." });

export async function POST(request: Request) {
  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_ORDER", error: "Revisá los datos de la compra y actualizá el carrito." }, { status: 400 });
  const input = parsed.data;
  const inputHash = requestFingerprint(input);
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const responseFor = (order: { id: string; code: string }, store: { id: string; slug: string }, status = 200) => {
    const token = createTrackingToken(order.id, store.id);
    return NextResponse.json({ orderId: order.id, code: order.code, trackingPath: trackingPath(store.slug, token), trackingUrl: absoluteTrackingUrl(origin, store.slug, token) }, { status });
  };
  let storeId: string | undefined;
  try {
    const initialStore = await prisma.store.findFirst({ where: { slug: input.storeSlug, isPublished: true, owner: { status: "ACTIVE" } }, select: { id: true, slug: true } });
    if (!initialStore) throw new CheckoutError("STORE_UNAVAILABLE", "Tienda no disponible.", 404);
    storeId = initialStore.id;
    const created = await commerceTransaction(async tx => {
      await lockStore(tx, initialStore.id);
      // Suspension and publication are checked again after waiting for locks.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = (SELECT "ownerId" FROM "Store" WHERE id = ${initialStore.id}) FOR SHARE`;
      const store = await tx.store.findFirst({ where: { id: initialStore.id, isPublished: true, owner: { status: "ACTIVE" } }, include: { owner: { select: { email: true } } } });
      if (!store) throw new CheckoutError("STORE_UNAVAILABLE", "Tienda no disponible.", 404);
      const existing = await tx.order.findUnique({ where: { storeId_clientRequestId: { storeId: store.id, clientRequestId: input.idempotencyKey } }, include: { items: true } });
      if (existing) {
        if (existing.requestFingerprint !== inputHash || !existing.trackingTokenHash) throw new CheckoutError("IDEMPOTENCY_CONFLICT", "Este intento corresponde a otro pedido. Iniciá una nueva compra.");
        return { order: existing, store, replay: true };
      }
      if (store.whatsappOrdersEnabled) throw new CheckoutError("WHATSAPP_ONLY", "Esta tienda recibe pedidos por WhatsApp.");
      await lockProducts(tx, store.id, input.items.map(item => item.productId));
      const raced = await tx.order.findUnique({ where: { storeId_clientRequestId: { storeId: store.id, clientRequestId: input.idempotencyKey } }, include: { items: true } });
      if (raced) {
        if (raced.requestFingerprint !== inputHash || !raced.trackingTokenHash) throw new CheckoutError("IDEMPOTENCY_CONFLICT", "Este intento corresponde a otro pedido. Iniciá una nueva compra.");
        return { order: raced, store, replay: true };
      }
      const { quote, quoteFingerprint, rebuilt, payment, delivery, settings } = await buildCheckoutQuote(tx, store, input.items, input);
      if (!quote.valid || !payment || !delivery) {
        const issue = quote.issueDetails[0];
        const error = new CheckoutError(issue?.code ?? "INVALID_SELECTION", issue?.message ?? "Elegí pago y entrega vigentes.", issue && ["PAYMENT_UNAVAILABLE", "DELIVERY_UNAVAILABLE", "INVALID_QUANTITY"].includes(issue.code) ? 400 : 409);
        return { rejected: error, quote };
      }
      try { verifyQuote(input.quoteToken, quoteFingerprint); }
      catch (error) {
        if (!(error instanceof CheckoutError)) throw error;
        return { rejected: error, quote };
      }
      if (delivery.type === "custom" && (input.deliveryAddress.length < 5 || input.city.length < 2 || input.postalCode.length < 3 || !argentinaProvinces.some(province => province.toLocaleLowerCase("es-AR") === input.province.toLocaleLowerCase("es-AR")))) throw new CheckoutError("INVALID_CUSTOMER", "Completá dirección, localidad, provincia y código postal.", 400);
      if (settings.requirePhone && input.customerPhone.length < 6) throw new CheckoutError("INVALID_CUSTOMER", "Ingresá un teléfono válido.", 400);
      if (settings.requireDni && !input.dni) throw new CheckoutError("INVALID_CUSTOMER", "Ingresá tu DNI/CUIT/CUIL.", 400);
      if (settings.requireBilling && !input.billingAddress) throw new CheckoutError("INVALID_CUSTOMER", "Ingresá el domicilio de facturación.", 400);
      await decrementStockForItems(tx, rebuilt.items, store.id);
      const order = await tx.order.create({
        data: {
          storeId: store.id, clientRequestId: input.idempotencyKey, requestFingerprint: inputHash,
          code: "PED-" + randomUUID().slice(0, 8).toUpperCase(),
          customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone,
          fulfillment: delivery.name, stockReserved: true, notes: settings.allowNotes ? input.notes : null, total: quote.totals.total,
          checkout: {
            stockMode: "variant-exclusive",
            customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone,
            dni: input.dni ?? null, deliveryAddress: delivery.type === "custom" ? input.deliveryAddress : null,
            province: delivery.type === "custom" ? input.province : null, city: delivery.type === "custom" ? input.city : null,
            postalCode: delivery.type === "custom" ? input.postalCode : null, country: "Argentina", billingAddress: input.billingAddress ?? null,
            deliveryMethodId: delivery.id, deliveryName: delivery.name, deliveryDescription: delivery.description,
            pickupDetails: delivery.type === "pickup" ? delivery.pickupDetails : null,
            ...quote.totals, ...paymentMethodSnapshot(payment)
          },
          items: { create: rebuilt.items.map(item => ({ ...item, options: item.options as Prisma.InputJsonValue })) },
          events: { create: { type: "CREATED", label: "Pedido creado" } }
        }, include: { items: true }
      });
      const token = createTrackingToken(order.id, store.id);
      await tx.order.update({ where: { id: order.id }, data: { trackingTokenHash: hashTrackingToken(token) } });
      return { order, store, replay: false };
    });
    if (created.rejected) return NextResponse.json({ code: created.rejected.code, error: created.rejected.message, quote: created.quote }, { status: created.rejected.status });
    if (!created.replay) {
      const trackingUrl = absoluteTrackingUrl(origin, created.store.slug, createTrackingToken(created.order.id, created.store.id));
      const adminUrl = new URL("/gestion/pedidos?orderId=" + encodeURIComponent(created.order.id), origin).toString();
      after(() => notifyNewOrder({ order: created.order, storeName: created.store.name, sellerEmail: created.store.owner.email, trackingUrl, adminUrl }));
    }
    return responseFor(created.order, created.store, created.replay ? 200 : 201);
  } catch (error) {
    // A concurrent identical attempt can commit while this one waits for inventory or uniqueness.
    if (storeId && !(error instanceof CheckoutError && error.code === "IDEMPOTENCY_CONFLICT")) {
      try {
        const duplicate = await prisma.order.findUnique({ where: { storeId_clientRequestId: { storeId, clientRequestId: input.idempotencyKey } } });
        if (duplicate) {
          if (duplicate.requestFingerprint !== inputHash || !duplicate.trackingTokenHash) throw new CheckoutError("IDEMPOTENCY_CONFLICT", "Este intento corresponde a otro pedido. Iniciá una nueva compra.");
          return responseFor(duplicate, { id: storeId, slug: input.storeSlug });
        }
      } catch (lookupError) { if (lookupError instanceof CheckoutError) error = lookupError; }
    }
    const failure = commerceError(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
