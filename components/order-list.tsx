"use client";
/* eslint-disable @next/next/no-img-element -- Order snapshots can reference merchant-hosted images. */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { AdminDialog, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { formatMoney } from "@/lib/money";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { type AdminOrder } from "@/lib/admin-orders";

import { PaymentBadge, DeliveryBadge } from "@/components/order-status-badge";
import { OrderFilters } from "@/components/order-filters";
import { useOrderRead } from "@/components/order-read-provider";
import { AdminActionMenu } from "@/components/admin-action-menu";
import { notifyError, notifyWarning } from "@/lib/internal-notifications";

export function OrderList({ orders, page, pageSize, total }: { orders: AdminOrder[]; page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const { readIds } = useOrderRead();
  const isUnread = (order: AdminOrder) => !order.readAt && !readIds.has(order.id);
  const params = useSearchParams();
  const [filters, setFilters] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const back = "/gestion/pedidos" + (params.size ? "?" + params.toString() : "");

  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.set("page", "1");
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    router.push("/gestion/pedidos?" + next.toString(), { scroll: false });
  }

  async function act(order: AdminOrder, patch: Record<string, string | boolean>) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, expectedUpdatedAt: order.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.notificationWarning) notifyWarning(result.notificationWarning);
      router.refresh();
    } catch (failure) { notifyError(failure instanceof Error ? failure.message : "No se pudo actualizar la venta."); }
    finally { setBusy(null); }
  }

  const detail = (order: AdminOrder) => `/gestion/pedidos/${order.id}?back=${encodeURIComponent(back)}`;
  const itemCount = (order: AdminOrder) => order.items.reduce((count, item) => count + item.quantity, 0);

  return <>
    <AdminPageHeader title="Ventas" description="Gestioná los pagos y las entregas de tu negocio."/>
    <section className="panel overflow-visible">
      <div className="admin-toolbar"><form className="admin-search" onSubmit={event => { event.preventDefault(); navigate({ q: String(new FormData(event.currentTarget).get("q") ?? "") }); }}><Search size={18}/><input className="field" name="q" aria-label="Buscar ventas" placeholder="Número, cliente, teléfono o email" defaultValue={params.get("q") ?? ""}/></form><button type="button" className="admin-icon-button" aria-label="Filtrar ventas" onClick={() => setFilters(true)}><SlidersHorizontal size={20}/></button></div>


      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Venta</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3">Total</th><th className="p-3">Productos</th><th className="p-3">Estado del pago</th><th className="p-3">Estado del envío</th><th className="p-3">Acciones</th></tr></thead><tbody>{orders.map(order => <FragmentOrderRow key={order.id} order={order} unread={isUnread(order)} detail={detail(order)} expanded={expanded.includes(order.id)} busy={busy === order.id} onToggle={() => setExpanded(current => current.includes(order.id) ? current.filter(id => id !== order.id) : [...current, order.id])} onAction={patch => void act(order, patch)}/>)}</tbody></table></div>

      <div className="order-mobile-list md:hidden">{orders.map(order => <Link className={`order-mobile-row${isUnread(order) ? " is-unread" : ""}`} key={order.id} href={detail(order)}>
        <span className="order-mobile-code"><strong>#{order.code}</strong>{isUnread(order) && <span className="order-unread-indicator">Sin leer</span>}</span>
        <time dateTime={order.createdAt}>{new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt))}</time>
        <span className="order-mobile-customer">{order.customerName}</span><strong className="order-mobile-total">{formatMoney(order.total)}</strong>
        <span className="order-mobile-count">{itemCount(order)} {itemCount(order) === 1 ? "producto" : "productos"}</span>
        <span className="order-mobile-states"><PaymentBadge status={order.paymentStatus}/><DeliveryBadge status={order.fulfillmentStatus}/></span>
      </Link>)}</div>
      {!orders.length && <div className="admin-empty"><ShoppingBag size={36}/><h2>No hay ventas para mostrar</h2><p>Las compras confirmadas de tu tienda aparecerán acá.</p></div>}
      <AdminPagination page={page} pageSize={pageSize} total={total} onChange={(nextPage, size) => navigate({ page: String(nextPage), pageSize: String(size) })}/>
    </section>
    <AdminDialog open={filters} fullScreenMobile title="Filtrar ventas" onClose={() => setFilters(false)} footer={<button className="btn-primary" form="order-filters" type="submit">Aplicar filtros</button>}><OrderFilters query={params.toString()} onApply={values => { navigate(values); setFilters(false); }}/></AdminDialog>
  </>;
}

function FragmentOrderRow({ order, unread, detail, expanded, busy, onToggle, onAction }: { order: AdminOrder; unread: boolean; detail: string; expanded: boolean; busy: boolean; onToggle: () => void; onAction: (patch: Record<string, string | boolean>) => void }) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return <>
    <tr className={`order-table-row border-t border-line${unread ? " is-unread" : ""}`}><td className="p-3"><Link className="font-bold text-brand" href={detail}>#{order.code}</Link>{unread && <span className="order-unread-indicator">Sin leer</span>}</td><td className="p-3">{formatBuenosAiresDate(order.createdAt)}</td><td className="p-3">{order.customerName}</td><td className="p-3 font-semibold">{formatMoney(order.total)}</td><td className="p-3"><button className="inline-flex items-center gap-1 font-semibold text-brand" onClick={onToggle} aria-expanded={expanded}>Ver {count}<ChevronDown size={15} className={expanded ? "rotate-180" : ""}/></button></td><td className="p-3"><PaymentBadge status={order.paymentStatus}/></td><td className="p-3"><DeliveryBadge status={order.fulfillmentStatus}/><small className="mt-1 block text-muted">{order.fulfillment}</small></td><td className="p-3"><AdminActionMenu label={`Acciones de venta ${order.code}`} disabled={busy} items={[
      { label: "Ver más detalles", href: detail },
      ...(order.paymentStatus === "PENDING" ? [{ label: "Marcar como pago recibido", onSelect: () => onAction({ paymentStatus: "CONFIRMED" }) }] : []),
      ...(order.fulfillmentStatus === "PENDING" ? [{ label: "Marcar como empaquetada", onSelect: () => onAction({ fulfillmentStatus: "PACKED" }) }] : []),
      ...(order.fulfillmentStatus === "PACKED" ? [{ label: "Notificar envío", onSelect: () => onAction({ fulfillmentStatus: "SHIPPED" }) }] : []),
      ...(order.fulfillmentStatus !== "DELIVERED" && order.status !== "CANCELLED" ? [{ label: "Marcar como entregado", onSelect: () => onAction({ fulfillmentStatus: "DELIVERED" }) }] : []),
      { label: order.archivedAt ? "Restaurar" : "Archivar", onSelect: () => onAction({ archived: !Boolean(order.archivedAt) }) }
    ]}/></td></tr>
    {expanded && <tr className="bg-slate-50"><td colSpan={8} className="p-0"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Producto</th><th className="p-3">Cantidad</th><th className="p-3">Precio unitario</th><th className="p-3">Total</th></tr></thead><tbody>{order.items.map(item => <tr key={item.id} className="border-t border-line bg-white"><td className="flex items-center gap-3 p-3">{item.imageUrl ? <img className="h-14 w-14 rounded object-cover" src={item.imageUrl} alt=""/> : <span className="h-14 w-14 rounded bg-slate-100"/>}<span><strong className="block">{item.productName}</strong><small>{Array.isArray(item.options) ? item.options.map(option => typeof option === "object" && option && "optionName" in option ? String(option.optionName) : "").filter(Boolean).join(" · ") : ""}</small></span></td><td className="p-3">{item.quantity}</td><td className="p-3">{formatMoney(item.unitPrice)}</td><td className="p-3">{formatMoney(item.subtotal)}</td></tr>)}</tbody></table></td></tr>}
  </>;
}
