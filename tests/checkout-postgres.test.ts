import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { buildCheckoutQuote } from "../lib/checkout-quote";
import { createPaymentMethod } from "../lib/commerce-settings";
import { normalizeVariants, variantKeyFromNames } from "../lib/product-variants";
import type { CheckoutItemInput } from "../lib/checkout-validation";

const mocks = vi.hoisted(() => ({ merchant: vi.fn() }));
vi.mock("@/lib/merchant", () => ({ getMerchantStore: mocks.merchant }));
vi.mock("@/lib/order-mail", () => ({ notifyNewOrder: vi.fn(), notifyOrderStatus: vi.fn().mockResolvedValue(true) }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@/lib/admin-catalog", async original => ({ ...await original<typeof import("../lib/admin-catalog")>(), deleteProductImagesForStore: vi.fn() }));
import { POST } from "../app/api/orders/route";
import { PATCH, DELETE } from "../app/api/admin/orders/[orderId]/route";
import { PATCH as editProduct, DELETE as deleteProduct } from "../app/api/admin/products/[productId]/route";

// Never run destructive fixtures against an ordinary application or remote database.
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const enabled = process.env.CHECKOUT_POSTGRES_TESTS === "1" && url && ["127.0.0.1", "localhost"].includes(url.hostname) && /^\/landing_saas_checkout_test_[a-z0-9_]+$/.test(url.pathname);
const storeSlug = "checkout-test-" + randomUUID().slice(0, 8);
const ownerId = "checkout-test-owner-" + randomUUID();
const payment = { ...createPaymentMethod("transfer", "bank"), enabled: true, discountPercent: 12 };
const delivery = { id: "pickup", type: "pickup", enabled: true, price: 0, name: "Retiro", pickupDetails: "Local QA" };
let store: Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  return prisma.store.create({ data: {
    name: "Checkout QA", slug: storeSlug, whatsappPhone: "541112345678", checkoutSettings: { paymentMethods: [payment] }, deliveryMethods: [delivery],
    owner: { create: { id: ownerId, email: ownerId + "@example.test" } },
    products: { create: { name: "Producto QA", slug: "producto", basePrice: 10000, stockQuantity: 1 } }
  }, include: { products: true } });
}
async function request(items: CheckoutItemInput[], key = randomUUID(), extra: Record<string, unknown> = {}) {
  const current = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
  const { quote } = await buildCheckoutQuote(prisma, current, items, { paymentMethodId: "bank", deliveryMethodId: "pickup" });
  return new Request("http://localhost/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    storeSlug, idempotencyKey: key, quoteToken: quote.quoteToken, customerName: "Cliente QA", customerEmail: "cliente@example.test", customerPhone: "1112345678", paymentMethodId: "bank", deliveryMethodId: "pickup", items, ...extra
  }) });
}
const line = () => ({ productId: store.products[0].id, quantity: 1, selectedOptionIds: [] });
const params = (orderId: string) => ({ params: Promise.resolve({ orderId }) });
const patch = (body: unknown) => new Request("http://localhost/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe.skipIf(!enabled)("checkout con PostgreSQL y bloqueos reales", () => {
  beforeEach(async () => {
    vi.stubEnv("CHECKOUT_QUOTE_SECRET", "checkout-postgres-signing-secret-32-characters");
    vi.stubEnv("TRACKING_TOKEN_SECRET", "checkout-postgres-tracking-secret-32-characters");
    store = await fixture();
    mocks.merchant.mockResolvedValue(store);
  });
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.deleteMany({ where: { id: { in: [ownerId, ownerId + "-foreign"] } } }); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("veinte compras de la última unidad crean una sola venta", async () => {
    const requests = await Promise.all(Array.from({ length: 20 }, () => request([line()])));
    const responses = await Promise.all(requests.map(value => POST(value)));
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(19);
    expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(0);
  }, 20000);

  it("la misma solicitud concurrente y su repetición no descuentan dos veces", async () => {
    const original = await request([line()]);
    const raw = await original.text();
    const responses = await Promise.all(Array.from({ length: 10 }, () => POST(new Request("http://localhost/api/orders", { method: "POST", body: raw }))));
    expect(responses.filter(value => value.status === 201)).toHaveLength(1);
    expect(responses.filter(value => value.status === 200)).toHaveLength(9);
    const ids = await Promise.all(responses.map(async value => (await value.json()).orderId));
    expect(new Set(ids).size).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(0);
    const altered = JSON.parse(raw); altered.customerName = "Otra persona";
    const conflict = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(altered) }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  }, 20000);

  it("serializa variantes del mismo producto sin perder actualizaciones", async () => {
    const variants = ["S", "M"].map(name => ({ key: variantKeyFromNames([{ groupName: "Talle", optionName: name }]), stockQuantity: 1, basePrice: null, promoPrice: null, isVisible: true, imageUrl: null }));
    const product = await prisma.product.update({ where: { id: line().productId }, data: { stockQuantity: null, variants, optionGroups: { create: { name: "Talle", selectionType: "SINGLE", isRequired: true, options: { create: [{ name: "S" }, { name: "M" }] } } } }, include: { optionGroups: { include: { options: true } } } });
    const options = product.optionGroups[0].options;
    const requests = await Promise.all(Array.from({ length: 12 }, (_, index) => request([{ ...line(), selectedOptionIds: [options[index % 2].id] }])));
    const responses = await Promise.all(requests.map(value => POST(value)));
    expect(responses.filter(value => value.status === 201)).toHaveLength(2);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(normalizeVariants(saved.variants).map(value => value.stockQuantity)).toEqual([0, 0]);
  }, 20000);

  it("carritos en orden inverso terminan sin bloqueos mutuos", async () => {
    const other = await prisma.product.create({ data: { storeId: store.id, name: "Segundo", slug: "segundo", basePrice: 5000, stockQuantity: 1 } });
    const items = [line(), { productId: other.id, quantity: 1, selectedOptionIds: [] }];
    const requests = await Promise.all([request(items), request([...items].reverse())]);
    expect((await Promise.all(requests.map(value => POST(value)))).map(value => value.status).sort()).toEqual([201, 409]);
    expect((await prisma.product.findMany({ where: { storeId: store.id } })).map(value => value.stockQuantity)).toEqual([0, 0]);
  });

  it("un fallo al guardar revierte todo el descuento de inventario", async () => {
    const original = await request([line()]);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await prisma.$executeRaw`CREATE FUNCTION checkout_test_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced transaction failure'; END $$`;
    await prisma.$executeRaw`CREATE TRIGGER checkout_test_reject BEFORE INSERT ON "Order" FOR EACH ROW EXECUTE FUNCTION checkout_test_reject_order()`;
    try {
      const response = await POST(original);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "COMMERCE_UNAVAILABLE" });
      expect(log).toHaveBeenCalled();
      expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(0);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER checkout_test_reject ON "Order"`;
      await prisma.$executeRaw`DROP FUNCTION checkout_test_reject_order()`;
    }
  });

  it("precio y descuento cambiados requieren otra confirmación", async () => {
    const original = await request([line()]);
    await prisma.product.update({ where: { id: line().productId }, data: { basePrice: 12000 } });
    await prisma.store.update({ where: { id: store.id }, data: { checkoutSettings: { paymentMethods: [{ ...payment, discountPercent: 5 }] } } });
    const response = await POST(original);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "QUOTE_CHANGED", quote: { totals: { productSubtotal: 12000, discount: 600, total: 11400 } } });
    expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
  });

  it("un costo de entrega cambiado no se cobra sin reconfirmación", async () => {
    const shipping = { ...delivery, id: "shipping", type: "custom", price: 2000, name: "Envío QA" };
    await prisma.store.update({ where: { id: store.id }, data: { deliveryMethods: [shipping] } });
    const current = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    const { quote } = await buildCheckoutQuote(prisma, current, [line()], { paymentMethodId: "bank", deliveryMethodId: "shipping" });
    const original = await request([line()], randomUUID(), { quoteToken: quote.quoteToken, deliveryMethodId: "shipping", deliveryAddress: "Calle QA 123", city: "La Plata", province: "Buenos Aires", postalCode: "1900" });
    await prisma.store.update({ where: { id: store.id }, data: { deliveryMethods: [{ ...shipping, price: 3500 }] } });
    const response = await POST(original);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "QUOTE_CHANGED", quote: { totals: { shipping: 3500, total: 12300 } } });
    expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
  });

  it("editar cantidades conserva las condiciones históricas y ajusta solo la diferencia de stock", async () => {
    await prisma.product.update({ where: { id: line().productId }, data: { stockQuantity: 5 } });
    const { orderId } = await (await POST(await request([line()]))).json();
    await prisma.store.update({ where: { id: store.id }, data: { checkoutSettings: { paymentMethods: [{ ...payment, discountPercent: 30 }] } } });
    const edited = await PATCH(patch({ items: [{ ...line(), quantity: 2 }] }), params(orderId));
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ order: { total: 17600, checkout: { productSubtotal: 20000, discountPercent: 12, discount: 2400, shipping: 0, total: 17600 } } });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(3);
    const canceled = await PATCH(patch({ status: "CANCELLED" }), params(orderId));
    expect(canceled.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(5);
  });

  it("rechaza productos ocultados o eliminados después de cotizar", async () => {
    const hidden = await request([line()]);
    await prisma.product.update({ where: { id: line().productId }, data: { isVisible: false } });
    expect((await POST(hidden)).status).toBe(409);
    await prisma.product.update({ where: { id: line().productId }, data: { isVisible: true } });
    const deleted = await request([line()]);
    await prisma.product.delete({ where: { id: line().productId } });
    expect((await POST(deleted)).status).toBe(409);
    expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(0);
  });

  it("rechaza IDs inexistentes o de otra tienda sin tocar ningún inventario", async () => {
    const foreign = await prisma.store.create({ data: {
      name: "Otra tienda QA", slug: "foreign-" + storeSlug, whatsappPhone: "541112345678",
      owner: { create: { id: ownerId + "-foreign", email: ownerId + "-foreign@example.test" } },
      products: { create: { name: "Producto ajeno", slug: "ajeno", basePrice: 1, stockQuantity: 99 } }
    }, include: { products: true } });
    const raw = JSON.parse(await (await request([line()])).text());
    for (const productId of ["does-not-exist", foreign.products[0].id]) {
      const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify({ ...raw, items: [{ ...line(), productId }] }) }));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    }
    expect(await prisma.order.count({ where: { storeId: { in: [store.id, foreign.id] } } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: foreign.products[0].id } })).stockQuantity).toBe(99);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
  });

  it("una edición administrativa vieja no sobrescribe una reserva", async () => {
    const original = await prisma.product.update({ where: { id: line().productId }, data: { updatedAt: new Date("2020-01-01T00:00:00Z") } });
    expect((await POST(await request([line()]))).status).toBe(201);
    const params = { params: Promise.resolve({ productId: original.id }) };
    const stale = await editProduct(patch({ expectedUpdatedAt: original.updatedAt.toISOString(), stockQuantity: 1 }), params);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "PRODUCT_CHANGED" });
    const noVersion = await editProduct(patch({ name: original.name, stockQuantity: 1 }), params);
    expect(noVersion.status).toBe(400);
    expect(await noVersion.json()).toMatchObject({ code: "PRODUCT_VERSION_REQUIRED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: original.id } })).stockQuantity).toBe(0);
  });

  it("cancelaciones y eliminación simultáneas devuelven stock una sola vez", async () => {
    const response = await POST(await request([line()]));
    const { orderId } = await response.json();
    const canceled = await Promise.all(Array.from({ length: 8 }, () => PATCH(patch({ status: "CANCELLED" }), params(orderId))));
    expect(canceled.every(value => value.status === 200)).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
    expect(await prisma.orderEvent.count({ where: { orderId, type: "PAYMENT" } })).toBe(1);
    const deleted = await Promise.all([DELETE(new Request("http://localhost"), params(orderId)), DELETE(new Request("http://localhost"), params(orderId))]);
    expect(deleted.map(value => value.status).sort()).toEqual([200, 404]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
  }, 20000);

  it("eliminar un pedido reservado mientras se cancela no duplica stock", async () => {
    const { orderId } = await (await POST(await request([line()]))).json();
    const responses = await Promise.all([DELETE(new Request("http://localhost"), params(orderId)), PATCH(patch({ status: "CANCELLED" }), params(orderId))]);
    expect(responses.every(value => [200, 404].includes(value.status))).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: line().productId } })).stockQuantity).toBe(1);
  });

  it("no elimina productos con reservas abiertas", async () => {
    const { orderId } = await (await POST(await request([line()]))).json();
    const deleted = await deleteProduct(new Request("http://localhost"), { params: Promise.resolve({ productId: line().productId }) });
    expect(deleted.status).toBe(409);
    await PATCH(patch({ status: "CANCELLED" }), params(orderId));
    expect((await deleteProduct(new Request("http://localhost"), { params: Promise.resolve({ productId: line().productId }) })).status).toBe(200);
  });
});
