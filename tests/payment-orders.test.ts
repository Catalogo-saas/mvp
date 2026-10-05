import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentMethod } from "../lib/commerce-settings";
import { buildCheckoutQuote } from "../lib/checkout-quote";
import type { Prisma } from "../lib/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  store: vi.fn(), existing: vi.fn(), create: vi.fn(), update: vi.fn(), products: vi.fn(), build: vi.fn(), stock: vi.fn()
}));
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@/lib/order-mail", () => ({ notifyNewOrder: vi.fn() }));
vi.mock("@/lib/order-tracking", () => ({
  createTrackingToken: () => "token", hashTrackingToken: () => "hash",
  trackingPath: () => "/fixture/compra/proceso/orden?hash=token",
  absoluteTrackingUrl: () => "http://localhost/fixture/compra/proceso/orden?hash=token"
}));
vi.mock("@/lib/order-management", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/order-management")>(),
  buildOrderItems: mocks.build, decrementStockForItems: mocks.stock
}));
vi.mock("@/lib/prisma", () => {
  const tx = { $queryRaw: vi.fn(), store: { findFirst: mocks.store }, order: { findUnique: mocks.existing, create: mocks.create, update: mocks.update }, product: { findMany: mocks.products } };
  return { prisma: { store: { findFirst: mocks.store }, order: { findUnique: mocks.existing }, $transaction: async (callback: (tx: unknown) => unknown) => callback(tx) } };
});
import { POST } from "../app/api/orders/route";
import { after } from "next/server";

const bankA = { ...createPaymentMethod("transfer", "bank-a"), enabled: true, name: "Banco A", discountPercent: 5, alias: "cuenta.a", accountHolder: "Ana", instructions: "Pagar en A", requestReceipt: true };
const bankB = { ...createPaymentMethod("transfer", "bank-b"), enabled: true, name: "Banco B", discountPercent: 12, alias: "cuenta.b", accountHolder: "Bea", instructions: "Pagar en B" };
const store = () => ({
  id: "store-a", slug: "fixture", name: "Fixture", owner: { email: "owner@test.com" },
  isPublished: true, whatsappOrdersEnabled: false, acceptCashPayments: true, acceptTransferPayments: true,
  checkoutSettings: { paymentMethods: [bankA, bankB] },
  deliveryMethods: [{ id: "pickup", type: "pickup", enabled: true, name: "Local", price: 0, pickupDetails: "Calle 100 · 9 a 18" }],
  showPricesWithoutTax: false, taxRatePercent: 21, paymentAlias: "legacy.alias"
});
const request = async (selection: Record<string, unknown>) => {
  const lines = [{ productId: "product-a", quantity: 1, selectedOptionIds: [] }];
  const { quote } = await buildCheckoutQuote({ product: { findMany: mocks.products } } as unknown as Pick<Prisma.TransactionClient, "product">, await mocks.store(), lines, { deliveryMethodId: "pickup", ...selection });
  return new Request("http://localhost/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeSlug: "fixture", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", quoteToken: quote.quoteToken ?? "unavailable", customerName: "Cliente", customerEmail: "client@test.com", customerPhone: "1112345678", deliveryMethodId: "pickup", items: lines, ...selection })
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CHECKOUT_QUOTE_SECRET", "checkout-test-signing-secret-at-least-32");
  mocks.store.mockResolvedValue(store());
  mocks.existing.mockResolvedValue(null);
  mocks.products.mockResolvedValue([{ id: "product-a", name: "Producto", isVisible: true, basePrice: 10000, promoPrice: null, stockQuantity: null, variants: [], imageUrls: [], freeShipping: false, optionGroups: [] }]);
  mocks.build.mockResolvedValue({ total: 10000, items: [{ productId: "product-a", productName: "Producto", quantity: 1, unitPrice: 10000, subtotal: 10000, options: [] }] });
  mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: "order-a", items: [] }));
  mocks.update.mockResolvedValue({});
});

describe("checkout con pagos repetidos", () => {
  it("guarda pedidos demo sin programar notificaciones", async () => {
    const fixture = store();
    mocks.store.mockResolvedValue({ ...fixture, checkoutSettings: { ...fixture.checkoutSettings, demoMode: true } });
    expect((await POST(await request({ paymentMethodId: bankA.id }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.checkout.demo).toBe(true);
    expect(after).not.toHaveBeenCalled();
  });
  it("mantiene las notificaciones en las tiendas normales", async () => {
    expect((await POST(await request({ paymentMethodId: bankA.id }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.checkout.demo).toBe(false);
    expect(after).toHaveBeenCalledOnce();
  });
  it.each(["discount", "discountPercent", "total", "shipping", "paymentStatus"])("rechaza el campo adulterado %s", async field => {
    expect((await POST(await request({ paymentMethodId: bankA.id, [field]: 0 }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.stock).not.toHaveBeenCalled();
  });
  it("rechaza token falsificado sin reservar stock", async () => {
    const response = await POST(await request({ paymentMethodId: bankA.id, quoteToken: "inventado.token" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_QUOTE" });
    expect(mocks.stock).not.toHaveBeenCalled();
  });
  it.each([[bankA, 9500], [bankB, 8800]])("calcula el total y guarda los datos de $name", async (bank, total) => {
    expect((await POST(await request({ paymentMethodId: bank.id }))).status).toBe(201);
    const saved = mocks.create.mock.calls[0][0].data;
    expect(saved.total).toBe(total);
    expect(saved.checkout).toMatchObject({ paymentMethodId: bank.id, paymentMethod: "transfer", paymentName: bank.name, paymentInstructions: bank.instructions, requestReceipt: bank.requestReceipt, paymentDetails: { alias: bank.alias, accountHolder: bank.accountHolder }, discount: 10000 - total });
    expect(mocks.stock).toHaveBeenCalledOnce();
  });

  it.each([{ paymentMethodId: "foreign" }, { paymentMethod: "transfer" }, { paymentMethodId: "bank-a", paymentMethod: "cash" }, {}])("rechaza selección inexistente, ambigua o incoherente: %j", async selection => {
    expect((await POST(await request(selection))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.stock).not.toHaveBeenCalled();
  });

  it("rechaza un método desactivado y admite el contrato antiguo cuando queda uno activo", async () => {
    const current = store();
    current.checkoutSettings.paymentMethods = [bankA, { ...bankB, enabled: false }];
    mocks.store.mockResolvedValue(current);
    expect((await POST(await request({ paymentMethodId: "bank-b" }))).status).toBe(400);
    expect((await POST(await request({ paymentMethod: "transfer" }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.checkout.paymentMethodId).toBe("bank-a");
  });

  it("conserva los datos de transferencia de una tienda heredada", async () => {
    mocks.store.mockResolvedValue({ ...store(), checkoutSettings: { transferDiscountPercent: 3 }, acceptCashPayments: false, paymentAccountHolder: "Original", paymentProvider: "Banco original", paymentCbu: "123" });
    expect((await POST(await request({ paymentMethod: "transfer" }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ total: 9700, checkout: { paymentMethodId: "legacy-transfer", paymentDetails: { alias: "legacy.alias", accountHolder: "Original", cbu: "123" } } });
  });
});
