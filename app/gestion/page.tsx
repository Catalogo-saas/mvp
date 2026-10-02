import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";

import { getMerchantStore } from "@/lib/merchant";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Search = Promise<{ period?: string; from?: string; to?: string }>;

function datePart(date: Date) { return date.toISOString().slice(0, 10); }
function startOfArgentinaDay(value: string) { return new Date(`${value}T03:00:00.000Z`); }

export default async function StatisticsPage({ searchParams }: { searchParams: Search }) {
  const store = await getMerchantStore();
  if (!store) return null;
  const query = await searchParams;
  const period = ["7", "30", "90", "custom"].includes(query.period ?? "") ? query.period! : "30";
  const now = new Date();
  const today = datePart(new Date(now.getTime() - 3 * 60 * 60 * 1000));
  const fallbackFrom = datePart(new Date(now.getTime() - (Number(period) || 30) * 86400000));
  const from = period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") ? query.from! : fallbackFrom;
  const to = period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? query.to! : today;
  const fromDate = startOfArgentinaDay(from);
  const toDate = new Date(startOfArgentinaDay(to).getTime() + 86400000);
  const [orders, visits] = await Promise.all([
    prisma.order.findMany({
      where: { storeId: store.id, paymentStatus: "CONFIRMED", status: { not: "CANCELLED" }, createdAt: { gte: fromDate, lt: toDate } },
      select: { total: true, createdAt: true }
    }),
    prisma.storefrontEvent.findMany({
      where: { storeId: store.id, type: "STOREFRONT_VIEW", createdAt: { gte: fromDate, lt: toDate } },
      select: { id: true, sessionId: true }
    })
  ]);
  const [pendingPayments, pendingShipments, productCount] = await Promise.all([
    prisma.order.count({where:{storeId:store.id,paymentStatus:"PENDING",status:{not:"CANCELLED"}}}),
    prisma.order.count({where:{storeId:store.id,fulfillmentStatus:{in:["PENDING","PACKED"]},status:{not:"CANCELLED"}}}),
    prisma.product.count({where:{storeId:store.id}})
  ]);
  const gross = orders.reduce((sum, order) => sum + order.total, 0);
  const sessions = new Set(visits.map((event) => event.sessionId || event.id)).size;
  const byDate = new Map<string, number>();
  orders.forEach((order) => { const day = datePart(new Date(order.createdAt.getTime() - 3 * 60 * 60 * 1000)); byDate.set(day, (byDate.get(day) ?? 0) + order.total); });
  const chart = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...chart.map(([, value]) => value));

  return <div className="space-y-6 pb-20 lg:pb-0">
    <AdminPageHeader title="Inicio" description={`Así está tu negocio, ${store.name}.`} action={<Link className="btn-secondary" href={`/${store.slug}`} target="_blank">Ver mi tienda ↗</Link>}/>
    <section className="grid gap-3 sm:grid-cols-3">{[[pendingPayments,"Pagos pendientes","/gestion/pedidos?payment=PENDING"],[pendingShipments,"Entregas por preparar","/gestion/pedidos?fulfillment=PENDING"],[productCount,"Productos en tu catálogo","/gestion/productos"]].map(([count,label,href])=><Link className="admin-card flex items-center justify-between gap-3" href={String(href)} key={label}><div><p className="text-sm">{label}</p><strong className="block mt-2 text-2xl">{count}</strong></div><span className="text-brand">↗</span></Link>)}</section>
    <h2 className="text-lg font-semibold pt-2">Rendimiento de tu tienda</h2>
    <nav className="flex gap-2 overflow-x-auto" aria-label="Período de estadísticas">{[7, 30, 90].map((days) => <Link key={days} href={`?period=${days}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${period === String(days) ? "bg-slate-950 text-white" : "bg-white"}`}>Últimos {days} días</Link>)}</nav>
    <form action="/gestion" className="panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="period" value="custom" /><label className="grid gap-1 text-sm font-semibold">Desde<input type="date" name="from" className="field" defaultValue={from} required /></label><label className="grid gap-1 text-sm font-semibold">Hasta<input type="date" name="to" className="field" defaultValue={to} required /></label><button className="btn-secondary self-end" type="submit">Aplicar rango</button></form>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Ventas", String(orders.length)], ["Importe bruto", formatMoney(gross)], ["Ticket promedio", formatMoney(orders.length ? Math.round(gross / orders.length) : 0)], ["Visitas unicas", String(sessions)]
    ].map(([label, value]) => <article key={label} className="panel p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 break-words text-2xl font-bold">{value}</p></article>)}</section>
    <section className="panel p-5 sm:p-7"><h2 className="text-xl font-bold">Ventas por día</h2>{chart.length ? <div className="mt-5 grid gap-3">{chart.map(([day, value]) => <div key={day} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-xs sm:text-sm"><time>{day.slice(5)}</time><div className="h-7 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-brand" style={{ width: `${Math.max(3, value / max * 100)}%` }} /></div><strong>{formatMoney(value)}</strong></div>)}</div> : <p className="mt-5 text-sm text-muted">Todavía no hay ventas confirmadas en este período.</p>}</section>
  </div>;
}
