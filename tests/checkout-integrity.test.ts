import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkedMoney, CheckoutError, publicOrderItemSchema, resolveCheckoutItem, validateDemand, type CheckoutProduct } from "../lib/checkout-validation";
import { buildCheckoutQuote, fingerprint, historicalTotals, requestFingerprint, signQuote, verifyQuote } from "../lib/checkout-quote";
import { calculateSelectedPrice, remainingSelectedStock } from "../lib/storefront-product-selection";
import { variantKeyFromNames } from "../lib/product-variants";
import type { Prisma } from "../lib/generated/prisma/client";
import { createPaymentMethod } from "../lib/commerce-settings";

const product: CheckoutProduct = { id: "p", name: "Producto", isVisible: true, basePrice: 10000, promoPrice: null, stockQuantity: 2, variants: [], imageUrls: [], freeShipping: false, optionGroups: [] };
const line = { productId: "p", quantity: 1, selectedOptionIds: [] as string[] };
const variants = ["S", "M"].map((name, index) => ({ key: variantKeyFromNames([{ groupName: "Talle", optionName: name }]), stockQuantity: 2, basePrice: index === 0 ? 5000 : null, promoPrice: null, isVisible: true, imageUrl: null }));
const variantProduct: CheckoutProduct = { ...product, variants, optionGroups: [{ name: "Talle", selectionType: "SINGLE", options: ["S", "M"].map(name => ({ id: name, name, isAvailable: true })) }] };

beforeEach(() => vi.stubEnv("CHECKOUT_QUOTE_SECRET", "checkout-test-signing-secret-at-least-32"));

describe("integridad de catálogo y cantidades", () => {
  it.each([undefined, { ...product, isVisible: false }])("rechaza productos inexistentes u ocultos", value => {
    expect(() => resolveCheckoutItem(value, line)).toThrow(CheckoutError);
  });
  it.each([0, -1, 1.5, "1", 100, NaN, Infinity])("rechaza la cantidad %s", quantity => {
    expect(publicOrderItemSchema.safeParse({ ...line, quantity }).success).toBe(false);
  });
  it.each(["unitPrice", "discount", "stockQuantity", "paymentStatus"])("rechaza el campo %s", field => {
    expect(publicOrderItemSchema.safeParse({ ...line, [field]: 0 }).success).toBe(false);
  });
  it("rechaza opciones repetidas, ajenas, faltantes y combinaciones que no existen", () => {
    for (const ids of [["M", "M"], ["foreign"], [], ["S", "M"]]) expect(() => resolveCheckoutItem(variantProduct, { ...line, selectedOptionIds: ids })).toThrow(CheckoutError);
    expect(() => resolveCheckoutItem({ ...variantProduct, variants: variants.slice(0, 1) }, { ...line, selectedOptionIds: ["M"] })).toThrow(CheckoutError);
    expect(remainingSelectedStock({ ...variantProduct, variants: variants.slice(0, 1) }, ["M"], [])).toBe(0);
  });
  it("rechaza variante oculta, opción desactivada y JSON inválido sin volver al stock global", () => {
    expect(() => resolveCheckoutItem({ ...variantProduct, variants: variants.map(v => ({ ...v, isVisible: false })) }, { ...line, selectedOptionIds: ["M"] })).toThrow(CheckoutError);
    expect(() => resolveCheckoutItem({ ...product, variants: [{ key: "bad" }] }, line)).toThrow(CheckoutError);
    expect(() => resolveCheckoutItem({ ...variantProduct, optionGroups: [{ ...variantProduct.optionGroups[0], options: [{ id: "M", name: "M", isAvailable: false }] }] }, { ...line, selectedOptionIds: ["M"] })).toThrow(CheckoutError);
  });
  it("hereda el precio del padre, nunca el de otra combinación", () => {
    const selected = { ...line, selectedOptionIds: ["M"] };
    expect(resolveCheckoutItem(variantProduct, selected).unitPrice).toBe(10000);
    expect(calculateSelectedPrice(variantProduct, ["M"])).toBe(10000);
    expect(resolveCheckoutItem({ ...variantProduct, promoPrice: 8000 }, selected).unitPrice).toBe(8000);
    expect(resolveCheckoutItem({ ...variantProduct, promoPrice: 8000 }, { ...line, selectedOptionIds: ["S"] }).unitPrice).toBe(5000);
  });
  it("acumula líneas repetidas y separa el stock por combinación", () => {
    const s = resolveCheckoutItem(variantProduct, { ...line, selectedOptionIds: ["S"], quantity: 2 });
    const m = resolveCheckoutItem(variantProduct, { ...line, selectedOptionIds: ["M"], quantity: 2 });
    expect(() => validateDemand([s, m])).not.toThrow();
    expect(() => validateDemand([s, s])).toThrow(CheckoutError);
    expect(() => validateDemand([resolveCheckoutItem({ ...product, stockQuantity: null }, { ...line, quantity: 60 }), resolveCheckoutItem({ ...product, stockQuantity: null }, { ...line, quantity: 60 })])).toThrow(CheckoutError);
  });
  it("mantiene ilimitado y rechaza desbordamientos monetarios", () => {
    expect(() => validateDemand([resolveCheckoutItem({ ...product, stockQuantity: null }, { ...line, quantity: 99 })])).not.toThrow();
    expect(() => checkedMoney(2147483648)).toThrow(CheckoutError);
    expect(() => checkedMoney(-1)).toThrow(CheckoutError);
    expect(() => resolveCheckoutItem({ ...product, basePrice: 999999999 }, { ...line, quantity: 99 })).toThrow(CheckoutError);
  });
});

describe("cotizaciones firmadas e historial", () => {
  it("detecta adulteración, vencimiento y cambio de importe", () => {
    const hash = fingerprint({ total: 10000 });
    const token = signQuote(hash, 1000);
    expect(() => verifyQuote(token, hash, 2000)).not.toThrow();
    expect(() => verifyQuote(token.slice(0, -1) + "!", hash, 2000)).toThrow(CheckoutError);
    expect(() => verifyQuote(token, hash, 601000)).toThrow(/Actualizamos/);
    expect(() => verifyQuote(token, fingerprint({ total: 5000 }), 2000)).toThrow(/Cambió/);
  });
  it("la idempotencia depende del contenido y no del token renovado", () => {
    const input = { customerName: "Ana", items: [line], idempotencyKey: "one", quoteToken: "one" };
    expect(requestFingerprint(input)).toBe(requestFingerprint({ ...input, quoteToken: "two", idempotencyKey: "two" }));
    expect(requestFingerprint(input)).not.toBe(requestFingerprint({ ...input, items: [{ ...line, quantity: 2 }] }));
  });
  it("recalcula ediciones con descuento y envío históricos", () => {
    expect(historicalTotals(20000, { productSubtotal: 10000, discount: 1200, shipping: 3000, preTaxTotal: null })).toMatchObject({ discount: 2400, total: 20600, discountPercent: 12 });
    expect(historicalTotals(20000, { discountPercent: 5, shipping: null })).toMatchObject({ discount: 1000, total: 19000, shipping: null });
  });
  it("cotiza y marca cada línea sin eliminarla ni reservar stock", async () => {
    const tx = { product: { findMany: vi.fn().mockResolvedValue([product]) } } as unknown as Pick<Prisma.TransactionClient, "product">;
    const payment = { ...createPaymentMethod("transfer", "bank"), discountPercent: 12 };
    const store = { id: "store", slug: "demo", checkoutSettings: { paymentMethods: [payment] }, deliveryMethods: [{ id: "pickup", type: "pickup", price: 0, enabled: true, name: "Retiro", pickupDetails: "Local" }], acceptCashPayments: false, acceptTransferPayments: false, paymentAccountHolder: null, paymentProvider: null, paymentAlias: null, paymentCbu: null, taxRatePercent: 21, showPricesWithoutTax: false };
    const valid = await buildCheckoutQuote(tx, store, [line], { paymentMethodId: "bank", deliveryMethodId: "pickup" });
    expect(valid.quote).toMatchObject({ valid: true, complete: true, totals: { total: 8800, discount: 1200 } });
    expect(valid.quote.quoteToken).toBeTruthy();
    const short = await buildCheckoutQuote(tx, store, [{ ...line, lineId: "line", quantity: 3 }], { paymentMethodId: "bank", deliveryMethodId: "pickup" });
    expect(short.quote.items).toHaveLength(1);
    expect(short.quote).toMatchObject({ valid: false, quoteToken: null, issueDetails: [{ lineId: "line", code: "INSUFFICIENT_STOCK", availableQuantity: 2 }] });
    await expect(buildCheckoutQuote(tx, { ...store, checkoutSettings: { paymentMethods: [{ ...payment, discountPercent: -5 }] } }, [line], {})).rejects.toThrow(CheckoutError);
    await expect(buildCheckoutQuote(tx, { ...store, deliveryMethods: [{ broken: true }] }, [line], {})).rejects.toThrow(CheckoutError);
  });
});
