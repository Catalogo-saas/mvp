"use client";

import { Banknote, Handshake, Landmark, MapPin, PackageCheck, Plus, Save, Settings2, Store, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminPageHeader } from "@/components/admin-ui";
import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { createPaymentMethod, normalizeCheckoutSettings, normalizeDeliveryMethods, normalizePaymentMethods, type PaymentMethod, type PaymentMethodType } from "@/lib/commerce-settings";
import { notifyError, notifySuccess } from "@/lib/internal-notifications";

type StoreInput = {
  name: string; description: string | null; whatsappPhone: string; restrictBySchedule: boolean; businessHours: unknown; slug: string; address: string | null; businessHoursText: string | null;
  acceptCashPayments: boolean; acceptTransferPayments: boolean; whatsappOrdersEnabled: boolean;
  checkoutSettings: unknown; deliveryMethods: unknown;
  paymentAccountHolder: string | null; paymentProvider: string | null; paymentAlias: string | null; paymentCbu: string | null;
  taxRatePercent: number; showPricesWithoutTax: boolean; isPublished: boolean;
};

export type SettingsSection = "general" | "pagos" | "whatsapp" | "compra" | "entregas";
type DeliveryMethod = ReturnType<typeof normalizeDeliveryMethods>[number];
const paymentTypes = [
  { type: "cash", label: "Efectivo", Icon: Banknote },
  { type: "transfer", label: "Transferencia o depósito bancario", Icon: Landmark },
  { type: "seller", label: "Acordar con el vendedor", Icon: Handshake },
  { type: "custom", label: "Personalizado", Icon: Settings2 }
] as const;
function formatCurrency(value: string | number | null) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 9);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function CurrencyInput({ value, onChange, className }: { value: number | null; onChange: (value: number | null) => void; className: string }) {
  const displayValue = formatCurrency(value);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const digitCountBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
    const digits = input.value.replace(/\D/g, "").slice(0, 9);
    const formatted = formatCurrency(digits);
    onChange(digits ? Number(digits) : null);
    requestAnimationFrame(() => {
      let position = 0;
      let digitsSeen = 0;
      while (position < formatted.length && digitsSeen < digitCountBeforeCaret) {
        if (/\d/.test(formatted[position])) digitsSeen += 1;
        position += 1;
      }
      input.setSelectionRange(position, position);
    });
  }

  return <span className="currency-field"><span aria-hidden="true">$</span><input className={className} type="text" inputMode="numeric" autoComplete="off" value={displayValue} onChange={handleChange}/></span>;
}

const sections: Array<{ key: SettingsSection; label: string }> = [
  { key: "general", label: "General" }, { key: "pagos", label: "Métodos de pago" },
  { key: "whatsapp", label: "Pedidos por WhatsApp" }, { key: "compra", label: "Proceso de compra" },
  { key: "entregas", label: "Envíos y entregas" }
];

export function CommerceSettingsForm({ store, section: active, methodId }: { store: StoreInput; section: SettingsSection; methodId?: string }) {
  const router = useRouter();
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [draft, setDraft] = useState({
    name: store.name, description: store.description ?? "", whatsappPhone: store.whatsappPhone,
    paymentMethods: normalizePaymentMethods(store),
    whatsappOrdersEnabled: store.whatsappOrdersEnabled,
    checkoutSettings: normalizeCheckoutSettings(store.checkoutSettings),
    deliveryMethods: normalizeDeliveryMethods(store.deliveryMethods),
    address: store.address ?? "",
    businessHoursText: store.businessHoursText ?? "",
    taxRatePercent: store.taxRatePercent,
    showPricesWithoutTax: store.showPricesWithoutTax,
    isPublished: store.isPublished
  });
  const [saved, setSaved] = useState(() => JSON.stringify(draft));
  const dirty = saved !== JSON.stringify(draft);
  useDirtyForm(dirty);
  const [saving, setSaving] = useState(false);
  const { confirm, setHasUnsavedChanges } = useUnsavedChanges();
  const update = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));
  const checkout = (patch: Partial<typeof draft.checkoutSettings>) => update({ checkoutSettings: { ...draft.checkoutSettings, ...patch } });
  const field = "field w-full";
  const updateDelivery = (id: string, patch: Partial<(typeof draft.deliveryMethods)[number]>) => update({ deliveryMethods: draft.deliveryMethods.map(method => method.id === id ? { ...method, ...patch } : method) });
  async function addDelivery(type: "custom" | "pickup") {
    const method: DeliveryMethod = { id: crypto.randomUUID(), type, name: type === "pickup" ? "Retiro en sucursal" : "Entrega personalizada", description: "", price: type === "pickup" ? 0 : null, enabled: type !== "pickup", pickupDetails: "", amountLimitEnabled: false, freeShippingEnabled: false, deliveryTimeEnabled: false, freeAbove: null, minAmount: null, maxAmount: null, coverage: "Argentina", estimatedTime: "", minDays: null, maxDays: null };
    const deliveryMethods = [...draft.deliveryMethods, method];
    setSaving(true);
    try {
      const response = await fetch("/api/admin/commerce-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryMethods }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "No se pudo agregar la forma de entrega.");
      notifySuccess("Forma de entrega agregada.");
      window.location.assign(`/gestion/configuracion/entregas/${method.id}`);
    } catch (error) { notifyError(error instanceof Error ? error.message : "No hay conexión. Intentá nuevamente."); }
    finally { setSaving(false); }
  }
  async function removeDelivery(id: string) {
    if (!window.confirm("¿Eliminar esta forma de entrega?")) return;
    const deliveryMethods = draft.deliveryMethods.filter(method => method.id !== id);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/commerce-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryMethods }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "No se pudo eliminar la forma de entrega.");
      notifySuccess("Forma de entrega eliminada.");
      window.location.assign("/gestion/configuracion/entregas");
    } catch (error) { notifyError(error instanceof Error ? error.message : "No hay conexión. Intentá nuevamente."); }
    finally { setSaving(false); }
  }

  async function save() {
    setSaving(true);
    const keys: Record<SettingsSection, Array<keyof typeof draft>> = {general:["name","description","address","businessHoursText","taxRatePercent","showPricesWithoutTax","isPublished"],pagos:[],whatsapp:["whatsappPhone","whatsappOrdersEnabled"],compra:[],entregas:["deliveryMethods"]};
    const payload: Record<string,unknown> = Object.fromEntries(keys[active].map(key=>[key,draft[key]]));
    const paymentSettingKeys = ["paymentMethods","cashName","transferName","cashDescription","transferDescription","cashDiscountPercent","transferDiscountPercent","cashInstructions","transferInstructions","requestTransferReceipt","acceptSellerPayment","sellerName","sellerDescription","sellerInstructions","sellerDiscountPercent","acceptCustomPayment","customName","customDescription","customInstructions","customDiscountPercent"];
    if(active==="pagos")payload.checkoutSettings={paymentMethods:draft.paymentMethods};
    if(active==="compra"){payload.checkoutSettings=Object.fromEntries(Object.entries(draft.checkoutSettings).filter(([key])=>!paymentSettingKeys.includes(key)));}
    try {
      const response = await fetch("/api/admin/commerce-settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if(response.ok) { setSaved(JSON.stringify(draft)); notifySuccess("Configuración guardada."); }
      else notifyError(result?.error ?? "No se pudo guardar.");
    } catch { notifyError("No hay conexión. Intentá nuevamente."); }
    finally { setSaving(false); }
  }

  const selectedDelivery = draft.deliveryMethods.find(method => method.id === methodId);
  const selectedPayment = draft.paymentMethods.find(method => method.id === methodId);
  const updatePayment = (id: string, patch: Partial<PaymentMethod>) => update({
    paymentMethods: draft.paymentMethods.map(method => method.id === id ? { ...method, ...patch } : method)
  });

  async function persistPaymentMethods(paymentMethods: PaymentMethod[], destination: string, message: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/commerce-settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSettings: { paymentMethods } })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "No se pudieron guardar las formas de pago.");
      setHasUnsavedChanges(false);
      notifySuccess(message);
      router.push(destination);
      router.refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "No hay conexión. Intentá nuevamente.");
    } finally { setSaving(false); }
  }

  async function addPayment(type: PaymentMethodType) {
    if (saving || draft.paymentMethods.length >= 20) return;
    const method = createPaymentMethod(type, crypto.randomUUID());
    await persistPaymentMethods([...draft.paymentMethods, method], `/gestion/configuracion/pagos/${method.id}`, "Forma de pago agregada.");
  }

  async function removePayment(id: string) {
    if (!await confirm({ title: "Eliminar forma de pago", message: "¿Eliminar esta forma de pago? Los pedidos existentes conservarán sus datos.", confirmLabel: "Eliminar forma", destructive: true })) return;
    await persistPaymentMethods(draft.paymentMethods.filter(method => method.id !== id), "/gestion/configuracion/pagos", "Forma de pago eliminada.");
  }
  const currencyField = (value: number | null, onChange: (value: number | null) => void) => <CurrencyInput className={field} value={value} onChange={onChange}/>;
  const deliveryFields = (method: DeliveryMethod) => <>
    <label className="delivery-active"><input type="checkbox" checked={method.enabled} onChange={event => updateDelivery(method.id, { enabled: event.target.checked })}/> Ofrecer esta forma de entrega</label>
    {(method.enabled || method.type === "pickup") && (method.type === "pickup" ? <div className="delivery-method-fields"><label>Nombre<input className={field} maxLength={80} value={method.name} onChange={event => updateDelivery(method.id, { name: event.target.value })}/></label><label><span className="inline-flex items-center gap-2"><MapPin size={16}/>Dirección y horarios de atención</span><textarea className={field} rows={3} maxLength={300} value={method.pickupDetails} onChange={event => updateDelivery(method.id, { pickupDetails: event.target.value })} placeholder="Ej.: Av. Rivadavia 1234 · Lun a vie de 9 a 18 h"/></label></div> : <div className="delivery-method-fields">
      <label>Nombre<input className={field} maxLength={80} value={method.name} onChange={event => updateDelivery(method.id, { name: event.target.value })}/></label>
      <label>Descripción para tus clientes<textarea className={field} rows={2} maxLength={250} value={method.description} onChange={event => updateDelivery(method.id, { description: event.target.value })} placeholder="Ej.: Envío a domicilio por correo o mensajería"/></label>
      <label>Costo del envío<CurrencyInput className={field} value={method.price} onChange={value => updateDelivery(method.id, { price: value })}/><small className="font-normal text-muted">Dejalo vacío si querés coordinar el costo con tu cliente.</small></label>
      <fieldset className="delivery-extra"><label className="delivery-check"><input type="checkbox" checked={method.amountLimitEnabled} onChange={event => updateDelivery(method.id, { amountLimitEnabled: event.target.checked })}/><span><strong>Límites del monto de compra</strong><small>Ofrecé esta entrega solo cuando el total de productos esté dentro del rango indicado.</small></span></label>{method.amountLimitEnabled && <div className="delivery-range"><label>Monto mínimo{currencyField(method.minAmount, value => updateDelivery(method.id, { minAmount: value }))}</label><label>Monto máximo{currencyField(method.maxAmount, value => updateDelivery(method.id, { maxAmount: value }))}</label></div>}</fieldset>
      <fieldset className="delivery-extra"><label className="delivery-check"><input type="checkbox" checked={method.freeShippingEnabled} onChange={event => updateDelivery(method.id, { freeShippingEnabled: event.target.checked, freeAbove: event.target.checked ? method.freeAbove : null })}/><span><strong>Envío gratis a partir de un monto</strong><small>El envío no tendrá costo cuando la compra alcance el importe que definas.</small></span></label>{method.freeShippingEnabled && <label>Monto mínimo{currencyField(method.freeAbove, value => updateDelivery(method.id, { freeAbove: value }))}<small className="font-normal text-muted">Monto mínimo requerido de productos para acceder al envío gratis.</small></label>}</fieldset>
      <fieldset className="delivery-extra"><label className="delivery-check"><input type="checkbox" checked={method.deliveryTimeEnabled} onChange={event => updateDelivery(method.id, { deliveryTimeEnabled: event.target.checked, minDays: event.target.checked ? method.minDays ?? 1 : null, maxDays: event.target.checked ? method.maxDays ?? 3 : null })}/><span><strong>Informar tiempos de entrega</strong><small>Mostraremos a tus clientes el rango estimado de días hábiles.</small></span></label>{method.deliveryTimeEnabled && <div className="delivery-range"><label>Días hábiles mínimos<input className={field} type="number" min={1} max={365} value={method.minDays ?? 1} onChange={event => updateDelivery(method.id, { minDays: Number(event.target.value), estimatedTime: `${event.target.value} a ${method.maxDays ?? 3} días hábiles` })}/></label><label>Días hábiles máximos<input className={field} type="number" min={1} max={365} value={method.maxDays ?? 3} onChange={event => updateDelivery(method.id, { maxDays: Number(event.target.value), estimatedTime: `${method.minDays ?? 1} a ${event.target.value} días hábiles` })}/></label></div>}</fieldset>
    </div>)}
  </>;

  if (active === "entregas" && !methodId) return <div className="settings-detail"><AdminPageHeader title="Envíos y entregas" description="Elegí cómo pueden recibir sus compras." back="/gestion/configuracion"/><div className="delivery-settings-layout">
    <section className="delivery-list-section"><h2>Lista de métodos</h2>{draft.deliveryMethods.length ? <div className="delivery-method-list">{draft.deliveryMethods.map(method => <Link key={method.id} href={`/gestion/configuracion/entregas/${method.id}`} className="delivery-method-row"><span className="delivery-method-icon">{method.type === "pickup" ? <Store size={23}/> : <PackageCheck size={23}/>}</span><span className="delivery-method-summary"><strong>{method.name}</strong><small>{method.type === "pickup" ? method.pickupDetails || "Entrega en sucursal" : method.description || "Entrega personalizada"}</small></span><span className={`admin-badge ${method.enabled ? "success" : ""}`}>{method.enabled ? "Activa" : "Desactivada"}</span><span className="delivery-method-edit">Editar</span></Link>)}</div> : <p className="delivery-list-empty">Todavía no agregaste formas de entrega.</p>}</section>
    <section className="delivery-list-section delivery-add-section"><h2>Agregá una nueva forma de entrega</h2><div className="delivery-options-list"><button type="button" disabled={saving} onClick={() => void addDelivery("custom")}><span><PackageCheck size={25}/></span><span>Entrega personalizada</span><Plus size={21}/></button><button type="button" disabled={saving} onClick={() => void addDelivery("pickup")}><span><Store size={25}/></span><span>Entrega en sucursal</span><Plus size={21}/></button></div></section>
  </div></div>;

  if (active === "entregas" && methodId) return <div className="settings-detail"><AdminPageHeader title={selectedDelivery?.name ?? "Editar forma de entrega"} description="Configurá los detalles y condiciones de esta forma de entrega." back="/gestion/configuracion/entregas"/>{selectedDelivery ? <form onSubmit={event => { event.preventDefault(); void save(); }}><section className="delivery-edit-section"><h2>{selectedDelivery.type === "pickup" ? "Entrega en sucursal" : "Entrega personalizada"}</h2>{deliveryFields(selectedDelivery)}</section><div className="admin-save-bar"><span>{dirty ? "Tenés cambios sin guardar" : "Configuración al día"}</span><div><button type="button" className="btn-secondary" disabled={saving} onClick={() => void removeDelivery(selectedDelivery.id)}><Trash2 size={16}/>Eliminar forma</button><button className="btn-primary" disabled={saving || !dirty}><Save size={16}/>{saving ? "Guardando…" : "Guardar cambios"}</button></div></div></form> : <p className="delivery-list-empty">No encontramos esa forma de entrega. <Link href="/gestion/configuracion/entregas">Volver a la lista</Link></p>}</div>;

  if (active === "pagos" && !methodId) return <div className="settings-detail">
    <AdminPageHeader title="Métodos de pago" description="Elegí cómo pueden pagar sus compras." back="/gestion/configuracion"/>
    <div className="delivery-settings-layout">
      <section className="delivery-list-section">
        <h2>Lista de métodos</h2>
        {draft.paymentMethods.length ? <div className="delivery-method-list">{draft.paymentMethods.map(method => {
          const Icon = paymentTypes.find(option => option.type === method.type)!.Icon;
          return <Link key={method.id} href={`/gestion/configuracion/pagos/${encodeURIComponent(method.id)}`} className="delivery-method-row">
            <span className="delivery-method-icon"><Icon size={23}/></span>
            <span className="delivery-method-summary"><strong>{method.name}</strong><small>{method.description || paymentTypes.find(option => option.type === method.type)!.label}</small></span>
            <span className={`admin-badge ${method.enabled ? "success" : ""}`}>{method.enabled ? "Activa" : "Desactivada"}</span>
            <span className="delivery-method-edit">Editar</span>
          </Link>;
        })}</div> : <p className="delivery-list-empty">Todavía no agregaste formas de pago.</p>}
      </section>
      <section className="delivery-list-section delivery-add-section">
        <h2>Agregá una nueva forma de pago</h2>
        <div className="delivery-options-list">{paymentTypes.map(({ type, label, Icon }) => <button key={type} type="button" disabled={!ready || saving || draft.paymentMethods.length >= 20} onClick={() => void addPayment(type)}>
          <span><Icon size={25}/></span><span>{label}</span><Plus size={21}/>
        </button>)}</div>
        {draft.paymentMethods.length >= 20 && <p className="delivery-list-empty">Podés agregar hasta 20 formas de pago. Eliminá una para agregar otra.</p>}
      </section>
    </div>
  </div>;

  if (active === "pagos" && methodId) return <div className="settings-detail">
    <AdminPageHeader title={selectedPayment?.name ?? "Editar forma de pago"} description="Configurá los detalles y condiciones de esta forma de pago." back="/gestion/configuracion/pagos"/>
    {selectedPayment ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <section className="delivery-edit-section">
        <h2>{paymentTypes.find(option => option.type === selectedPayment.type)!.label}</h2>
        <label className="delivery-active"><input type="checkbox" checked={selectedPayment.enabled} onChange={event => updatePayment(selectedPayment.id, { enabled: event.target.checked })}/>Ofrecer esta forma de pago</label>
        <div className="delivery-method-fields">
          <label>Nombre del método<input className={field} required minLength={2} maxLength={80} value={selectedPayment.name} onChange={event => updatePayment(selectedPayment.id, { name: event.target.value })}/></label>
          <label>Descripción para tus clientes<textarea className={field} rows={2} maxLength={500} value={selectedPayment.description} onChange={event => updatePayment(selectedPayment.id, { description: event.target.value })}/></label>
          {selectedPayment.type === "transfer" && <div className="payment-account-fields">
            {([["accountHolder", "Titular"], ["provider", "Banco o billetera"], ["alias", "Alias"], ["cbu", "CBU/CVU"]] as const).map(([key, label]) => <label key={key}>{label}<input className={field} maxLength={key === "cbu" ? 30 : 120} value={selectedPayment[key]} onChange={event => updatePayment(selectedPayment.id, { [key]: event.target.value })}/></label>)}
          </div>}
          <label>Instrucciones para tu cliente<textarea className={field} rows={5} maxLength={1000} value={selectedPayment.instructions} onChange={event => updatePayment(selectedPayment.id, { instructions: event.target.value })}/></label>
          <label>Descuento (opcional)<span className="percent-field"><span aria-hidden="true">%</span><input className={field} type="number" min={0} max={100} step="any" value={selectedPayment.discountPercent} onChange={event => updatePayment(selectedPayment.id, { discountPercent: Number(event.target.value) })}/></span></label>
          {selectedPayment.type === "transfer" && <label className="delivery-active"><input type="checkbox" checked={selectedPayment.requestReceipt} onChange={event => updatePayment(selectedPayment.id, { requestReceipt: event.target.checked })}/>Solicitar comprobante de pago en la tienda</label>}
        </div>
      </section>
      <div className="admin-save-bar"><span>{dirty ? "Tenés cambios sin guardar" : "Configuración al día"}</span><div>
        <button type="button" className="btn-secondary" disabled={!ready || saving} onClick={() => void removePayment(selectedPayment.id)}><Trash2 size={16}/>Eliminar forma</button>
        <button className="btn-primary" disabled={!ready || saving || !dirty}><Save size={16}/>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div></div>
    </form> : <p className="delivery-list-empty">No encontramos esa forma de pago. <Link href="/gestion/configuracion/pagos">Volver a la lista</Link></p>}
  </div>;

  return <div className="settings-detail"><AdminPageHeader title={sections.find(s=>s.key===active)?.label ?? "Configuración"} description="Los cambios se aplican solo a esta sección." back="/gestion/configuracion"/><form onSubmit={event=>{event.preventDefault();void save();}}><section className="admin-card">
      {active === "general" ? <div className="grid gap-5">
        <label className="grid gap-1 text-sm font-semibold">Nombre de tu negocio<input className={field} required minLength={2} maxLength={90} value={draft.name} onChange={e=>update({name:e.target.value})}/><small className="font-normal text-muted">Tu enlace /{store.slug} no cambia al editar el nombre.</small></label><label className="grid gap-1 text-sm font-semibold">Descripción<textarea className={field} maxLength={500} value={draft.description} onChange={e=>update({description:e.target.value})}/></label>
        <label className="grid gap-1 text-sm font-semibold">Dirección de la tienda<input className={field} value={draft.address} onChange={(event) => update({ address: event.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Horario de atención<input className={field} value={draft.businessHoursText} onChange={(event) => update({ businessHoursText: event.target.value })} placeholder="Ej.: Lunes a viernes de 9 a 18 h" /></label>
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.showPricesWithoutTax} onChange={(event) => update({ showPricesWithoutTax: event.target.checked })} />Mostrar importes sin impuestos</label>
        {draft.showPricesWithoutTax ? <label className="grid gap-1 text-sm font-semibold">Tasa de impuesto (%)<input className={field} type="number" min={0} max={100} value={draft.taxRatePercent} onChange={(event) => update({ taxRatePercent: Number(event.target.value) })} /></label> : null}
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.isPublished} onChange={(event) => update({ isPublished: event.target.checked })} />Tienda publicada</label>
      </div> : null}
      {active === "whatsapp" ? <div className="grid gap-4"><label className="grid gap-2">Número de WhatsApp<input className={field} type="tel" required value={draft.whatsappPhone} onChange={e=>update({whatsappPhone:e.target.value})}/><small className="text-muted">Código de área y número, sin 0 ni 15. Argentina (+54).</small></label><label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={draft.whatsappOrdersEnabled} onChange={(event) => update({ whatsappOrdersEnabled: event.target.checked })} />Recibir pedidos directamente por WhatsApp</label>{draft.whatsappOrdersEnabled&&<p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">En este modo, el carrito abre WhatsApp sin crear una venta, enviar correos ni reservar stock. Revisá el número antes de activar este modo.</p>}</div> : null}
      {active === "compra" ? <div className="grid gap-4">
        {([ ["requirePhone", "Solicitar teléfono"], ["requireDni", "Solicitar DNI/CUIT/CUIL"], ["requireBilling", "Solicitar domicilio de facturación"], ["allowNotes", "Permitir notas para el vendedor"], ["showFreeShippingProgress", "Mostrar progreso de envío gratis"], ["showLowStock", "Mostrar avisos de bajo stock"] ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.checkoutSettings[key]} onChange={(event) => checkout({ [key]: event.target.checked })} />{label}</label>)}
        {draft.checkoutSettings.showLowStock ? <label className="grid gap-1 text-sm font-semibold">¿Cuántas unidades quedan para que aparezca el aviso de últimas unidades?<input className={field} type="number" min={1} value={draft.checkoutSettings.lowStockThreshold} onChange={(event) => checkout({ lowStockThreshold: Number(event.target.value) })} /></label> : null}
        <div className="grid gap-2 rounded-xl border p-4"><h2 className="text-lg font-bold">Monto mínimo de compra</h2><p className="text-sm text-muted">Definí un monto mínimo para que tus clientes puedan finalizar una compra. Se calcula sobre los productos, antes del descuento del medio de pago y sin envío.</p><label className="grid gap-1 text-sm font-semibold">¿Cuánto es lo mínimo que pueden gastar tus clientes?<CurrencyInput className={field} value={draft.checkoutSettings.minimumAmount} onChange={value => checkout({ minimumAmount: value })}/></label></div>
      </div> : null}
    </section><div className="admin-save-bar"><span>{dirty?"Tenés cambios sin guardar":"Configuración al día"}</span><div><button className="btn-primary" disabled={saving||!dirty}><Save size={16}/>{saving?"Guardando…":"Guardar cambios"}</button></div></div></form>
  </div>;
}
