import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, Store } from "./generated/prisma/client";
import { checkoutSettingsSchema, normalizePaymentMethods, resolvePaymentMethod, paymentMethodSnapshot, strictDeliveryMethods } from "./commerce-settings";
import { checkedMoney, CheckoutError, demandKey, resolveCheckoutItem, type CheckoutItemInput } from "./checkout-validation";

export type QuoteSelection = { paymentMethodId?: string; paymentMethod?: "cash" | "transfer" | "seller" | "custom"; deliveryMethodId?: string };
export type QuoteInputLine = CheckoutItemInput & { lineId?: string };
export type QuoteStore = Pick<Store, "id" | "slug" | "checkoutSettings" | "deliveryMethods" | "acceptCashPayments" | "acceptTransferPayments" | "paymentAccountHolder" | "paymentProvider" | "paymentAlias" | "paymentCbu" | "taxRatePercent" | "showPricesWithoutTax">;

function secret() {
  const value = process.env.CHECKOUT_QUOTE_SECRET || process.env.TRACKING_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 24) throw new Error("Checkout quote signing secret is missing");
  return value;
}
function signature(payload: string) { return createHmac("sha256", secret()).update(`checkout-quote:v1:${payload}`).digest("base64url"); }
export function signQuote(fingerprint: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ fingerprint, expiresAt: now + 600000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyQuote(token: string, fingerprint: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 2) throw new CheckoutError("INVALID_QUOTE", "La cotización no es válida. Actualizá el carrito.", 400);
  const expected = Buffer.from(signature(parts[0]));
  const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new CheckoutError("INVALID_QUOTE", "La cotización no es válida. Actualizá el carrito.", 400);
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()); }
  catch { throw new CheckoutError("INVALID_QUOTE", "La cotización no es válida.", 400); }
  if (!Number.isFinite(payload?.expiresAt) || payload.expiresAt <= now) throw new CheckoutError("QUOTE_EXPIRED", "Actualizamos tu pedido. Revisá el resumen y volvé a confirmar.");
  if (payload.fingerprint !== fingerprint) throw new CheckoutError("QUOTE_CHANGED", "Cambió tu pedido. Revisá el resumen y volvé a confirmar.");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
export function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
export function canonicalItems(items: CheckoutItemInput[]) {
  const merged = new Map<string, CheckoutItemInput>();
  for (const item of items) {
    const selectedOptionIds = [...item.selectedOptionIds].sort();
    const key = JSON.stringify([item.productId, selectedOptionIds]);
    merged.set(key, { productId: item.productId, selectedOptionIds, quantity: item.quantity + (merged.get(key)?.quantity ?? 0) });
  }
  return [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item);
}
export function requestFingerprint(input: { items: CheckoutItemInput[]; idempotencyKey: string; quoteToken: string; [key: string]: unknown }) {
  const data = Object.fromEntries(Object.entries(input).filter(([key]) => !["quoteToken", "idempotencyKey", "items"].includes(key)));
  return fingerprint({ ...data, items: canonicalItems(input.items) });
}

export function historicalTotals(productSubtotal: number, checkout: Record<string, unknown>) {
  const originalSubtotal = typeof checkout.productSubtotal === "number" ? checkout.productSubtotal : 0;
  const originalDiscount = typeof checkout.discount === "number" ? checkout.discount : 0;
  const discountPercent = typeof checkout.discountPercent === "number" ? checkout.discountPercent : originalSubtotal > 0 ? originalDiscount / originalSubtotal * 100 : 0;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new CheckoutError("INVALID_AMOUNT", "Revisá las condiciones originales del pedido.");
  const shipping = checkout.shipping === null ? null : typeof checkout.shipping === "number" ? checkedMoney(checkout.shipping) : 0;
  const discount = checkedMoney(Math.round(productSubtotal * discountPercent / 100));
  const total = checkedMoney(productSubtotal - discount + (shipping ?? 0));
  const taxRatePercent = typeof checkout.taxRatePercent === "number" ? checkout.taxRatePercent : 21;
  const preTaxTotal = typeof checkout.preTaxTotal === "number" ? checkedMoney(Math.round(total / (1 + taxRatePercent / 100))) : null;
  return { productSubtotal, discountPercent, discount, shipping, total, preTaxTotal, taxAmount: preTaxTotal === null ? null : total - preTaxTotal };
}

export async function buildCheckoutQuote(tx: Pick<Prisma.TransactionClient, "product">, store: QuoteStore, lines: QuoteInputLine[], selection: QuoteSelection) {
  const settingsResult = checkoutSettingsSchema.safeParse(store.checkoutSettings);
  const deliveryResult = strictDeliveryMethods(store.deliveryMethods).safeParse(store.deliveryMethods);
  if (!settingsResult.success || !deliveryResult.success || !Number.isInteger(store.taxRatePercent) || store.taxRatePercent < 0 || store.taxRatePercent > 100) throw new CheckoutError("INVALID_COMMERCE_SETTINGS", "La tienda debe revisar su configuración de compra.");
  const settings = settingsResult.data;
  const products = await tx.product.findMany({ where: { storeId: store.id, id: { in: [...new Set(lines.map(item => item.productId))] } }, include: { optionGroups: { include: { options: true }, orderBy: { sortOrder: "asc" } } } });
  const byId = new Map(products.map(product => [product.id, product]));
  const rebuilt: Array<Omit<ReturnType<typeof resolveCheckoutItem>, "stock">> = [];
  const items: Array<{ lineId: string; lineIndex: number; productId: string; productName: string; imageUrl: string | null; quantity: number; selectedOptionIds: string[]; optionLabels: string[]; unitPrice: number; availableQuantity: number | null }> = [];
  const issueDetails: Array<{ lineId: string | null; lineIndex?: number; code: string; message: string; availableQuantity?: number | null }> = [];
  const demand = new Map<string, number>();
  for (const [lineIndex, line] of lines.entries()) {
    try {
      const resolved = resolveCheckoutItem(byId.get(line.productId), line);
      const key = demandKey(resolved);
      const quantity = (demand.get(key) ?? 0) + line.quantity;
      demand.set(key, quantity);
      const { stock, ...item } = resolved;
      const availableQuantity = stock === null ? null : Math.max(0, stock - quantity + line.quantity);
      items.push({ lineId: line.lineId ?? "", lineIndex, productId: item.productId, productName: item.productName, imageUrl: item.imageUrl, quantity: item.quantity, selectedOptionIds: line.selectedOptionIds, optionLabels: item.options.map(option => `${option.groupName}: ${option.optionName}`), unitPrice: item.unitPrice, availableQuantity });
      rebuilt.push(item);
      if (quantity > 99) issueDetails.push({ lineId: line.lineId ?? null, lineIndex, code: "INVALID_QUANTITY", message: `El máximo por combinación de ${item.productName} es 99 unidades.`, availableQuantity: Math.min(99, availableQuantity ?? 99) });
      else if (stock !== null && quantity > stock) issueDetails.push({ lineId: line.lineId ?? null, lineIndex, code: "INSUFFICIENT_STOCK", message: `No hay suficiente stock de ${item.productName}.`, availableQuantity });
    } catch (error) {
      if (!(error instanceof CheckoutError)) throw error;
      issueDetails.push({ lineId: line.lineId ?? null, lineIndex, code: error.code, message: error.message });
    }
  }
  const productSubtotal = checkedMoney(rebuilt.reduce((sum, item) => sum + item.subtotal, 0));
  const paymentMethods = normalizePaymentMethods(store).filter(method => method.enabled);
  const payment = resolvePaymentMethod(store, selection);
  const deliveryMethods = deliveryResult.data.filter(method => method.enabled && (method.type === "pickup" || !method.amountLimitEnabled || (method.minAmount === null || productSubtotal >= method.minAmount) && (method.maxAmount === null || productSubtotal <= method.maxAmount)));
  const delivery = deliveryMethods.find(method => method.id === selection.deliveryMethodId);
  const addIssue = (code: string, message: string) => issueDetails.push({ lineId: null, code, message });
  if ((selection.paymentMethodId || selection.paymentMethod) && !payment) addIssue("PAYMENT_UNAVAILABLE", "Elegí un método de pago vigente.");
  if (selection.deliveryMethodId && !delivery) addIssue("DELIVERY_UNAVAILABLE", "Elegí una forma de entrega vigente.");
  if (settings.minimumAmount !== null && productSubtotal < settings.minimumAmount) addIssue("MINIMUM_AMOUNT", "No se alcanzó el mínimo de compra.");
  const allFreeShipping = lines.length > 0 && lines.every(line => byId.get(line.productId)?.freeShipping);
  const shipping = delivery ? delivery.type === "pickup" || allFreeShipping || delivery.freeShippingEnabled && delivery.freeAbove !== null && productSubtotal >= delivery.freeAbove ? 0 : delivery.price : null;
  const discountPercent = payment?.discountPercent ?? 0;
  const discount = checkedMoney(Math.round(productSubtotal * discountPercent / 100));
  const total = checkedMoney(productSubtotal - discount + (shipping ?? 0));
  const preTaxTotal = store.showPricesWithoutTax ? checkedMoney(Math.round(total / (1 + store.taxRatePercent / 100))) : null;
  const totals = { productSubtotal, shipping, discountPercent, discount, total, preTaxTotal, taxAmount: preTaxTotal === null ? null : total - preTaxTotal, taxRatePercent: store.taxRatePercent };
  const deliveryOptions = deliveryMethods.map(method => ({ ...method, quotedPrice: method.type === "pickup" || allFreeShipping || method.freeShippingEnabled && method.freeAbove !== null && productSubtotal >= method.freeAbove ? 0 : method.price }));
  const valid = lines.length > 0 && issueDetails.length === 0;
  const complete = valid && Boolean(payment && delivery);
  const quoteFingerprint = fingerprint({ storeId: store.id, items: rebuilt.map(item => ({ ...item, options: [...item.options].sort((a, b) => a.groupName.localeCompare(b.groupName)) })).sort((a, b) => JSON.stringify([a.productId, a.variantKey]).localeCompare(JSON.stringify([b.productId, b.variantKey]))), inputItems: canonicalItems(lines), totals, payment: payment ? paymentMethodSnapshot(payment) : null, delivery, settings });
  const quote = { items, issueDetails, issues: issueDetails.map(issue => issue.message), valid, complete, totals, paymentMethods, deliveryMethods: deliveryOptions, settings, quoteToken: complete ? signQuote(quoteFingerprint) : null };
  return { quote, quoteFingerprint, rebuilt: { items: rebuilt, total: productSubtotal }, payment, delivery, settings };
}
