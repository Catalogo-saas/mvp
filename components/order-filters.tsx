"use client";
import { useState } from "react";
import { fulfillmentLabels, paymentLabels } from "@/lib/admin-orders";

export function OrderFilters({ query, onApply }: { query: string; onApply: (values: Record<string, string>) => void }) {
  const defaults = { sale: "open", payment: "", fulfillment: "", from: "", to: "", min: "", max: "" };
  const [values, setValues] = useState<Record<string, string>>(() => {
    const params = new URLSearchParams(query);
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? (key === "sale" && params.get("archived") === "1" ? "archived" : value)]));
  });
  return <form id="order-filters" className="admin-form-grid" onSubmit={event => { event.preventDefault(); onApply({ ...values, archived: "" }); }}>
    <label>Estado de la venta<select className="field" value={values.sale} onChange={event => setValues({ ...values, sale: event.target.value })}>{[["all", "Todas las ventas"], ["open", "Abiertas (sin archivar ni canceladas)"], ["unread", "No leídos"], ["archived", "Archivadas"], ["cancelled", "Canceladas"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Estado del pago<select className="field" value={values.payment} onChange={event => setValues({ ...values, payment: event.target.value })}><option value="">Todos</option>{Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Estado de la entrega<select className="field" value={values.fulfillment} onChange={event => setValues({ ...values, fulfillment: event.target.value })}><option value="">Todos</option>{Object.entries(fulfillmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <div className="order-filter-pair">{([["from", "Desde"], ["to", "Hasta"]] as const).map(([key, label]) => <label key={key}>{label}<input className="field" type="date" min={key === "to" ? values.from : undefined} max={key === "from" ? values.to : undefined} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}/></label>)}</div>
    <div className="order-filter-pair">{([["min", "Importe mínimo"], ["max", "Importe máximo"]] as const).map(([key, label]) => <label key={key}>{label}<input className="field" type="number" min={key === "max" ? values.min || 0 : 0} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}/></label>)}</div>
    <button type="button" className="btn-secondary" onClick={() => setValues(defaults)}>Reiniciar filtros</button>
  </form>;
}
