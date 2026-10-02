"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye, Package, Pencil, Printer, Truck, X } from "lucide-react";
import { AdminActionMenu } from "@/components/admin-action-menu";
import { OrderManager, printOrder } from "@/components/order-manager";
import { PaymentBadge, DeliveryBadge } from "@/components/order-status-badge";
import { useOrderRead } from "@/components/order-read-provider";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/internal-notifications";
import { formatMoney } from "@/lib/money";
import { formatBuenosAiresDate } from "@/lib/date-format";
import type { AdminOrder } from "@/lib/admin-orders";

function InfoFields({ fields }: { fields: Array<[string, unknown]> }) {
  return <dl className="order-checkout-fields">{fields.filter(([, value]) => typeof value === "string" && value.trim()).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>;
}
export function OrderDetail({ order, back, previousId, nextId }: { order: AdminOrder; back: string; previousId: string | null; nextId: string | null }) {
  const router = useRouter();
  const { confirm } = useUnsavedChanges();
  const { markRead } = useOrderRead();
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState(false);
  const reading = useRef(false);
  const read = useRef(Boolean(order.readAt));
  const cancelled = order.status === "CANCELLED";
  const checkout = order.checkout && typeof order.checkout === "object" && !Array.isArray(order.checkout) ? order.checkout as Record<string, unknown> : {};
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  const number = (key: string) => typeof checkout[key] === "number" && Number.isFinite(checkout[key]) ? checkout[key] as number : null;
  const productSubtotal = number("productSubtotal") ?? order.items.reduce((total, item) => total + item.subtotal, 0);
  const discountAmount = number("discount") ?? 0;
  const discountPercent = productSubtotal > 0 && discountAmount > 0 ? Math.round(discountAmount / productSubtotal * 100) : null;
  const discountMethod = checkout.paymentMethod === "cash" ? "efectivo" : checkout.paymentMethod === "transfer" ? "transferencia" : checkout.paymentMethod === "seller" ? "acordado con el vendedor" : checkout.paymentMethod === "custom" ? "personalizado" : null;
  const paymentMethod = typeof checkout.paymentName === "string" && checkout.paymentName.trim() ? checkout.paymentName : checkout.paymentMethod === "transfer" ? "Transferencia o depósito bancario" : checkout.paymentMethod === "cash" ? "Efectivo" : checkout.paymentMethod === "seller" ? "Acordar con el vendedor" : checkout.paymentMethod === "custom" ? "Personalizado" : "Método de pago no informado";
  const detailUrl = (id: string) => "/gestion/pedidos/" + id + "?back=" + encodeURIComponent(back);

  const recordRead = useCallback(async () => {
    if (document.visibilityState !== "visible" || read.current || reading.current) return;
    reading.current = true;
    try { await markRead(order.id); read.current = true; setReadError(false); }
    catch { setReadError(true); }
    finally { reading.current = false; }
  }, [markRead, order.id]);
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void recordRead(); });
    const visible = () => void recordRead();
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; document.removeEventListener("visibilitychange", visible); };
  }, [recordRead]);

  async function update(patch: Record<string, string | boolean>) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/orders/" + order.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, expectedUpdatedAt: order.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.notificationWarning) notifyWarning(result.notificationWarning);
      else notifySuccess("Venta actualizada.");
      router.refresh();
    } catch (failure) { notifyError(failure instanceof Error ? failure.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }
  return <div className="order-detail-page">
    <header className="order-detail-header">
      <Link href={back} className="btn-secondary order-return"><ArrowLeft size={17}/>Regresar a las ventas</Link>
      <div className="order-detail-actions"><button type="button" className="btn-secondary" onClick={() => printOrder(order)}><Printer size={17}/>Imprimir pedido</button>
        <OrderManager key={order.updatedAt} orders={[order]} editorOnly editTarget={order} renderTrigger={(edit, editing) => <AdminActionMenu label="Más opciones de la venta" text="Más opciones" disabled={busy || editing} items={[
          { label: "Editar venta", icon: Pencil, onSelect: edit },
          { label: order.archivedAt ? "Restaurar venta" : "Archivar venta", icon: Archive, onSelect: () => void update({ archived: !Boolean(order.archivedAt) }) },
          ...(!cancelled ? [{ label: "Cancelar venta", icon: X, danger: true, onSelect: () => { void confirm({ title: "Cancelar venta", message: "¿Cancelar esta venta? Se devolverá el stock reservado.", confirmLabel: "Cancelar venta", destructive: true }).then(accepted => { if (accepted) void update({ status: "CANCELLED" }); }); } }] : [])
        ]}/>}/>
      </div>
      <div className="order-detail-title"><h1>Detalle de la venta #{order.code}</h1><div className="order-neighbors">{previousId ? <Link href={detailUrl(previousId)} className="admin-icon-button" aria-label="Venta anterior"><ChevronLeft size={20}/></Link> : <button type="button" className="admin-icon-button" disabled aria-label="Venta anterior"><ChevronLeft size={20}/></button>}{nextId ? <Link href={detailUrl(nextId)} className="admin-icon-button" aria-label="Venta siguiente"><ChevronRight size={20}/></Link> : <button type="button" className="admin-icon-button" disabled aria-label="Venta siguiente"><ChevronRight size={20}/></button>}</div></div>
      <p className="order-detail-date"><CalendarDays size={18}/><time dateTime={order.createdAt}>{formatBuenosAiresDate(order.createdAt)}</time><span>{order.source === "STOREFRONT" ? "Tienda online" : "Venta manual"}</span></p>
    </header>
    {readError && <div className="admin-notice is-error" role="alert">No se pudo marcar la venta como leída. <button type="button" className="underline" onClick={() => void recordRead()}>Reintentar</button></div>}
    <div className="order-detail-layout">
      <section className="admin-card order-payment"><header className="order-card-heading"><h2>Pago</h2><PaymentBadge status={order.paymentStatus}/></header><p>{paymentMethod}</p>
        {order.receiptKey && <a className="admin-inline-link" href={"/api/admin/orders/" + order.id + "/receipt"} target="_blank" rel="noreferrer"><Eye size={18}/>Ver comprobante de pago</a>}
        {!cancelled && order.paymentStatus !== "CONFIRMED" && <button type="button" className="btn-primary" disabled={busy} onClick={() => { void confirm({ title: "Confirmar pago", message: "¿Confirmar que recibiste el pago de esta venta?", confirmLabel: "Confirmar pago" }).then(accepted => { if (accepted) void update({ paymentStatus: "CONFIRMED" }); }); }}>Confirmar pago</button>}
      </section>
      <section className="admin-card order-delivery"><header className="order-card-heading"><h2>Envío</h2><DeliveryBadge status={order.fulfillmentStatus}/></header><p>{order.fulfillment}</p><div className="order-delivery-actions">
        {!cancelled && order.fulfillmentStatus === "PENDING" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void update({ fulfillmentStatus: "PACKED" })}><Package size={17}/>Marcar como empaquetado</button>}
        {!cancelled && order.fulfillmentStatus === "PACKED" && <button type="button" className="btn-primary" disabled={busy} onClick={() => void update({ fulfillmentStatus: "SHIPPED" })}><Truck size={17}/>Notificar envío</button>}
        {!cancelled && order.fulfillmentStatus !== "DELIVERED" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { void confirm({ title: "Marcar como entregado", message: "¿Marcar esta venta como entregada? El estado del pago no cambiará.", confirmLabel: "Marcar como entregado" }).then(accepted => { if (accepted) void update({ fulfillmentStatus: "DELIVERED" }); }); }}>Marcar como entregado</button>}
      </div></section>
      <section className="admin-card order-purchase"><h2>Detalle de la compra</h2><p>Total de productos comprados: <strong>{count} {count === 1 ? "unidad" : "unidades"}</strong></p>
        <div className="order-items">{order.items.map(item => <div key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" className="order-item-image"/> : <span className="order-item-image order-item-placeholder"><Package size={24}/></span>}<div><strong>{item.productName}</strong><small>{Array.isArray(item.options) ? item.options.map(option => typeof option === "object" && option && "optionName" in option ? String(option.optionName) : "").filter(Boolean).join(" / ") : ""}</small><small>{item.quantity} × {formatMoney(item.unitPrice)}</small></div><b>{formatMoney(item.subtotal)}</b></div>)}</div>
        <dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatMoney(productSubtotal)}</dd></div>{discountAmount > 0 && <div><dt>{discountPercent !== null && discountMethod ? `Descuento (${discountPercent}% ${discountMethod})` : "Descuento"}</dt><dd>−{formatMoney(discountAmount)}</dd></div>}{number("shipping") !== null && <div><dt>Envío</dt><dd>{number("shipping") === 0 ? "Gratis" : formatMoney(Number(checkout.shipping))}</dd></div>}<div className="order-grand-total"><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div></dl>
      </section>
      {order.notes && <section className="admin-card order-customer-notes"><h2>Notas del cliente</h2><p className="whitespace-pre-wrap">{order.notes}</p></section>}
      <section className="admin-card order-customer-data"><h2>Datos del cliente</h2><strong>{order.customerName}</strong>{order.customerPhone && <p>{order.customerPhone}</p>}{order.customerPhone.replace(/\D/g, "") && <a className="admin-inline-link" href={"https://wa.me/" + order.customerPhone.replace(/\D/g, "")} target="_blank" rel="noreferrer">Escribir por WhatsApp<ExternalLink size={15}/></a>}{order.customerEmail && <a className="admin-inline-link order-email" href={"mailto:" + order.customerEmail}>{order.customerEmail}</a>}</section>
      <section className="admin-card order-shipping-data">
        <h2>{checkout.pickupDetails ? "Datos de retiro" : "Datos de envío"}</h2><p>{order.customerName}</p>
        {checkout.pickupDetails
          ? <InfoFields fields={[["Sucursal", checkout.pickupDetails], ["País", checkout.country]]} />
          : <InfoFields fields={[["Dirección", checkout.deliveryAddress], ["Código postal", checkout.postalCode], ["Provincia", checkout.province], ["Ciudad", checkout.city], ["País", checkout.country]]} />}
        {!checkout.deliveryAddress && !checkout.pickupDetails && <p>{order.fulfillment}</p>}
      </section>
      <section className="admin-card order-billing-data"><h2>Datos de facturación</h2><InfoFields fields={[["Nombre", order.customerName], ["DNI / CUIT", checkout.dni], ["Dirección", checkout.billingAddress]]}/>{!checkout.dni && !checkout.billingAddress && <p>No se solicitaron datos de facturación.</p>}</section>
      {order.trackingPath && <section className="admin-card order-tracking"><h2>Página de seguimiento</h2><p>Compartí esta página con tu cliente para que pueda seguir la compra.</p><div className="order-tracking-actions"><button type="button" className="btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(new URL(order.trackingPath!, window.location.origin).href); notifySuccess("Enlace de seguimiento copiado."); } catch { notifyError("No se pudo copiar el enlace."); } }}><Copy size={17}/>Copiar link</button><a className="btn-secondary" href={order.trackingPath} target="_blank" rel="noreferrer"><ExternalLink size={17}/>Ver página</a></div></section>}
      <section className="admin-card order-history"><h2>Historial de la orden</h2><ol className="order-timeline"><li><span>Venta creada</span><time>{formatBuenosAiresDate(order.createdAt)}</time></li>{order.events.map(event => <li key={event.id}><span>{event.label}</span><time>{formatBuenosAiresDate(event.createdAt)}</time></li>)}</ol></section>
    </div>
  </div>;
}
