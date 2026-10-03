"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CreditCard, Mail, MapPin } from "lucide-react";
import { useStorefrontCart } from "./storefront-cart";
import { useCheckoutQuote, type CheckoutQuote } from "./use-checkout-quote";
import { StorefrontQuantityValue } from "./storefront-quantity-value";
import { StorefrontTransferDetails } from "./storefront-transfer-details";
import { storefrontAppearance } from "./storefront-appearance";
import { normalizeCheckoutSettings, normalizeDeliveryMethods, normalizePaymentMethods } from "@/lib/commerce-settings";
import { argentinaProvinces } from "@/lib/argentina-provinces";
import { formatMoney } from "@/lib/money";
import styles from "./storefront-checkout-page.module.css";

type CheckoutStore = {
  name: string; slug: string; logoUrl: string | null; template: string; theme: unknown; designConfig: unknown;
  acceptCashPayments: boolean; acceptTransferPayments: boolean; whatsappOrdersEnabled: boolean;
  checkoutSettings: unknown; deliveryMethods: unknown; freeShippingProductIds: string[];
  showPricesWithoutTax: boolean; taxRatePercent: number; paymentAlias: string | null;
  paymentAccountHolder: string | null; paymentProvider: string | null; paymentCbu: string | null;
};
type Data = { customerEmail: string; customerName: string; customerPhone: string; dni: string; deliveryAddress: string; province: string; city: string; postalCode: string; billingAddress: string; deliveryMethodId: string; paymentMethodId: string; notes: string };

export function StorefrontCheckoutPage({ store }: { store: CheckoutStore }) {
  const { cart, ready, changeCart, cartTotal } = useStorefrontCart(store.slug);
  const initialPayments = normalizePaymentMethods(store).filter(method => method.enabled);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>({ customerEmail: "", customerName: "", customerPhone: "", dni: "", deliveryAddress: "", province: "", city: "", postalCode: "", billingAddress: "", deliveryMethodId: "", paymentMethodId: initialPayments[0]?.id ?? "", notes: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recoveryChecking, setRecoveryChecking] = useState(true);
  const requestId = useRef(crypto.randomUUID());
  const verified = useCheckoutQuote(store.slug, cart, changeCart, ready && !store.whatsappOrdersEnabled, { paymentMethodId: data.paymentMethodId, deliveryMethodId: data.deliveryMethodId });
  const settings = verified.quote?.settings ?? normalizeCheckoutSettings(store.checkoutSettings);
  const paymentOptions = verified.quote?.paymentMethods ?? initialPayments;
  const methods = verified.quote?.deliveryMethods ?? normalizeDeliveryMethods(store.deliveryMethods).filter(method => method.enabled);
  const selectedMethod = methods.find(method => method.id === data.deliveryMethodId);
  const selectedPayment = paymentOptions.find(option => option.id === data.paymentMethodId);
  const deliveryCost = (id: string) => verified.quote ? verified.quote.deliveryMethods.find(method => method.id === id)?.quotedPrice : methods.find(method => method.id === id)?.price;
  const subtotal = verified.quote?.totals.productSubtotal ?? cartTotal;
  const shipping = verified.quote?.totals.shipping ?? null;
  const discountPercent = verified.quote?.totals.discountPercent ?? 0;
  const discount = verified.quote?.totals.discount ?? 0;
  const total = verified.quote?.totals.total ?? subtotal;
  const quoting = verified.verifying;
  const cartValid = verified.quote && !verified.quote.issueDetails.some(issue => !["PAYMENT_UNAVAILABLE", "DELIVERY_UNAVAILABLE"].includes(issue.code));
  const attemptKey = "storefront-checkout-attempt:" + store.slug;
  const set = (field: keyof Data, value: string) => { setData(current => ({ ...current, [field]: value, ...(field === "province" ? { deliveryMethodId: "" } : {}) })); setError(""); };
  const setDeliveryMethod = (id: string) => { const method = methods.find(item => item.id === id); setData(current => ({ ...current, deliveryMethodId: id, ...(method?.type === "pickup" ? { deliveryAddress: "", province: "", city: "", postalCode: "" } : {}) })); setError(""); };

  function finishOrder(result: { trackingPath: string }) {
    sessionStorage.removeItem(attemptKey);
    changeCart(() => []);
    window.location.assign(result.trackingPath);
  }
  async function sendAttempt(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.trackingPath) { finishOrder(result); return; }
      if (response.status >= 400 && response.status < 500) {
        sessionStorage.removeItem(attemptKey);
        requestId.current = crypto.randomUUID();
        setRecovery(false);
        if (result?.quote) verified.applyQuote(result.quote as CheckoutQuote);
      } else setRecovery(true);
      const explainedByQuote = result?.quote?.issueDetails?.some((issue: { message: string }) => issue.message === result.error);
      setError(explainedByQuote ? "" : result?.error || "No pudimos confirmar el resultado. Reintentá la misma compra.");
    } catch {
      setRecovery(true);
      setError("No pudimos confirmar el resultado. Reintentá la misma compra para evitar duplicados.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    // Reuse the exact persisted request, including its key and quote, after a lost response.
    async function recover() {
      await Promise.resolve();
      const raw = sessionStorage.getItem(attemptKey);
      if (!raw) { setRecoveryChecking(false); return; }
      let saved: Record<string, unknown>;
      try { saved = JSON.parse(raw); } catch { sessionStorage.removeItem(attemptKey); setRecoveryChecking(false); return; }
      if (saved.storeSlug !== store.slug || typeof saved.idempotencyKey !== "string" || !Array.isArray(saved.items)) { sessionStorage.removeItem(attemptKey); setRecoveryChecking(false); return; }
      setRecovery(true);
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw }).catch(() => null);
      const result = await response?.json().catch(() => null);
      if (response?.ok && result?.trackingPath) { finishOrder(result); return; }
      const restored = Object.fromEntries(Object.entries(saved).filter(([key, value]) => key in data && typeof value === "string"));
      setData(current => ({ ...current, ...restored }));
      setStep(2);
      if (response && response.status >= 400 && response.status < 500) {
        sessionStorage.removeItem(attemptKey);
        setRecovery(false);
        setError("Revisá el pedido y volvé a confirmar.");
      } else {
        setRecovery(true);
        setError("Hay una confirmación pendiente. Reintentá para recuperar su resultado.");
      }
      setRecoveryChecking(false);
    }
    void recover();
    // Recovery runs only when entering this store's checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || recovery || recoveryChecking || verified.blocking || !cartValid || !verified.quote) return;
    setError("");
    if (step < 2) {
      if (step === 1 && !selectedMethod) { setError("Elegí una forma de entrega disponible."); return; }
      setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return;
    }
    if (!selectedMethod || !selectedPayment || !verified.quote.complete) { setError("Elegí pago y entrega vigentes."); return; }
    const shown = verified.quote;
    setLoading(true);
    const fresh = await verified.refresh();
    setLoading(false);
    if (!fresh?.complete || !fresh.quoteToken) return;
    const terms = (quote: CheckoutQuote) => JSON.stringify({ totals: quote.totals, items: quote.items.map(item => [item.productId, item.quantity, item.selectedOptionIds, item.unitPrice]), payment: quote.paymentMethods.find(method => method.id === data.paymentMethodId), delivery: quote.deliveryMethods.find(method => method.id === data.deliveryMethodId), settings: quote.settings });
    if (terms(shown) !== terms(fresh)) { setError("Cambió tu pedido. Revisá el resumen y volvé a confirmar."); return; }
    const body = { ...data, storeSlug: store.slug, idempotencyKey: requestId.current, quoteToken: fresh.quoteToken, items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, selectedOptionIds: item.selectedOptionIds })) };
    sessionStorage.setItem(attemptKey, JSON.stringify(body));
    await sendAttempt(body);
  }

  return <div {...storefrontAppearance(store)}><main className={styles.page}><header className={styles.header}><Link href={`/${store.slug}`} className={styles.brand}>{store.logoUrl ? <img src={store.logoUrl} alt=""/> : null}{store.name}</Link><Link href={`/${store.slug}/productos`}>Seguir comprando</Link></header>
    <div className={styles.shell}><section className={styles.formSide}><Link className={styles.back} href={`/${store.slug}/productos`}><ArrowLeft size={16}/> Volver a la tienda</Link><h1>Finalizar compra</h1><ol className={styles.steps}><li aria-current={step===0?"step":undefined}><Mail size={17}/> Correo</li><li aria-current={step===1?"step":undefined}><MapPin size={17}/> Datos y entrega</li><li aria-current={step===2?"step":undefined}><CreditCard size={17}/> Pago</li></ol>
      {!ready ? <p>Cargando carrito...</p> : !cart.length ? <div className={styles.empty}><p>Tu carrito está vacío.</p><Link href={`/${store.slug}/productos`}>Ver productos</Link></div> : store.whatsappOrdersEnabled ? <div className={styles.empty}><p>Esta tienda recibe los pedidos por WhatsApp.</p><Link href={`/${store.slug}/productos`}>Volver a la tienda</Link></div> : <form onSubmit={submit} className={styles.form}>
        {step===0 && <section><h2>¿A qué correo enviamos tu pedido?</h2><p>Usaremos este email para enviarte el enlace de seguimiento.</p><label>Correo electrónico<input type="email" autoComplete="email" autoFocus required value={data.customerEmail} onChange={event => set("customerEmail",event.target.value)} placeholder="tu@email.com"/></label></section>}
        {step===1 && <section><h2>Datos de contacto y entrega</h2><div className={styles.fields}><label>Nombre y apellido<input required minLength={2} autoComplete="name" value={data.customerName} onChange={event=>set("customerName",event.target.value)}/></label><label>Teléfono<input type="tel" autoComplete="tel" required={settings.requirePhone} value={data.customerPhone} onChange={event=>set("customerPhone",event.target.value)}/></label>{settings.requireDni && <label>DNI/CUIT/CUIL<input required value={data.dni} onChange={event=>set("dni",event.target.value)}/></label>}</div>
          <fieldset className={styles.choices}><legend>Forma de entrega</legend>{methods.map(method=><label key={method.id}><input type="radio" name="delivery" required checked={data.deliveryMethodId===method.id} onChange={()=>setDeliveryMethod(method.id)}/><span><strong>{method.name}</strong><small>{method.type === "pickup" ? method.pickupDetails : method.description}</small><small>{method.type === "pickup" ? "Sin cargo" : deliveryCost(method.id) === 0 ? "Envío gratis" : deliveryCost(method.id) == null ? "Costo a convenir" : formatMoney(deliveryCost(method.id) ?? 0)}</small>{method.type === "custom" && method.deliveryTimeEnabled && method.minDays !== null && method.maxDays !== null && <small>Entrega estimada: {method.minDays}–{method.maxDays} días hábiles</small>}</span></label>)}{!methods.length && <p>No hay formas de entrega disponibles para este monto de compra.</p>}</fieldset>
          {selectedMethod?.type === "custom" && <div className={styles.fields}><label>Dirección de entrega<input required minLength={5} autoComplete="street-address" value={data.deliveryAddress} onChange={event=>set("deliveryAddress",event.target.value)}/></label><label>Ciudad o localidad<input required value={data.city} onChange={event=>set("city",event.target.value)}/></label><div className={styles.provinceRow}><label>Provincia<select required value={data.province} onChange={event=>set("province",event.target.value)}><option value="">Seleccioná una provincia</option>{argentinaProvinces.map(province=><option key={province} value={province}>{province}</option>)}</select></label><label>Código postal<input required autoComplete="postal-code" value={data.postalCode} onChange={event=>set("postalCode",event.target.value)}/></label></div></div>}
          {settings.requireBilling && <label>Dirección de facturación<input required value={data.billingAddress} onChange={event=>set("billingAddress",event.target.value)}/></label>}
        </section>}
        {step===2 && <section><h2>Medio de pago</h2><fieldset className={styles.choices}><legend>Elegí cómo pagar</legend>{paymentOptions.map(option=><label key={option.id}><input type="radio" name="payment" checked={data.paymentMethodId===option.id} onChange={()=>set("paymentMethodId",option.id)}/><span><strong>{option.name}</strong><small>{option.description}</small>{option.discountPercent>0 && <em>{option.discountPercent}% de descuento</em>}</span></label>)}{!paymentOptions.length && <p>Esta tienda todavía no ofrece métodos de pago.</p>}</fieldset>{selectedPayment?.type==="transfer" && <StorefrontTransferDetails key={JSON.stringify([selectedPayment.id, selectedPayment.alias, selectedPayment.cbu])} payment={selectedPayment}/>} {settings.allowNotes && <label>Notas del pedido (opcional)<textarea maxLength={500} rows={3} value={data.notes} onChange={event=>set("notes",event.target.value)}/></label>}</section>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {verified.quote?.issueDetails.map((issue, index) => <p className={styles.error} role="alert" key={index}>{issue.message}{issue.availableQuantity !== undefined && issue.availableQuantity !== null ? " Disponibles: " + issue.availableQuantity + "." : ""}</p>)}
        {verified.error && <p className={styles.error} role="alert">{verified.error} <button type="button" onClick={() => void verified.refresh()}>Reintentar verificación</button></p>}
        {recovery && <button type="button" disabled={loading} onClick={() => { const saved = sessionStorage.getItem(attemptKey); if (saved) void sendAttempt(JSON.parse(saved)); }}>{loading ? "Recuperando…" : "Reintentar confirmación"}</button>}<div className={styles.formActions}>{step>0 && <button type="button" className={styles.secondary} onClick={()=>setStep(step-1)}>Volver</button>}<button type="submit" className={styles.primary} disabled={loading || recovery || recoveryChecking || verified.blocking || !cartValid || step===2 && (!selectedMethod || !selectedPayment || !verified.quote?.complete)}>{step===2 ? <><Check size={18}/>{loading ? "Confirmando..." : "Confirmar pedido"}</> : "Continuar"}</button></div>
      </form>}</section>
      <aside className={styles.summary}><h2>Tu pedido</h2>{cart.map(item=><div className={styles.line} key={item.lineId}><span>{item.productName} × <StorefrontQuantityValue quantity={item.quantity} verifying={quoting} productName={item.productName}/><small>{item.optionLabels.join(" · ")}</small><span className={styles.lineActions}><button type="button" aria-label={`Quitar ${item.productName}`} disabled={loading || recovery} onClick={() => changeCart(current => current.filter(line => line.lineId !== item.lineId))}>Quitar</button>{verified.quote?.issueDetails.some(issue => issue.lineId === item.lineId && issue.availableQuantity !== undefined && issue.availableQuantity !== null && issue.availableQuantity > 0 && issue.availableQuantity < item.quantity) && <button type="button" disabled={loading || recovery} onClick={() => { const available = verified.quote?.issueDetails.find(issue => issue.lineId === item.lineId)?.availableQuantity; if (available) changeCart(current => current.map(line => line.lineId === item.lineId ? { ...line, quantity: available } : line)); }}>Usar cantidad disponible</button>}</span></span><strong>{formatMoney(item.unitPrice*item.quantity)}</strong></div>)}<div className={styles.line}><span>Subtotal</span><strong>{formatMoney(cartTotal)}</strong></div>{step===2 && selectedMethod && <><div className={styles.line}><span>Entrega</span><strong>{selectedMethod.type === "pickup" ? "Sin cargo" : shipping===null?"A convenir":shipping===0?"Gratis":formatMoney(shipping)}</strong></div>{discount>0 && <div className={styles.line}><span>Descuento ({discountPercent}%)</span><strong>−{formatMoney(discount)}</strong></div>}</>}<div className={styles.grandTotal}><span>Total{step<2?" sin envío":""}</span><strong>{formatMoney(step===2?total:subtotal)}</strong></div>{verified.quote?.totals.preTaxTotal !== null && verified.quote?.totals.preTaxTotal !== undefined && step===2 && <small>Subtotal sin impuestos: {formatMoney(verified.quote?.totals.preTaxTotal ?? 0)}</small>}</aside>
    </div></main></div>;
}
