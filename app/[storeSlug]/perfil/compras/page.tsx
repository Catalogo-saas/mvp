import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerLogout } from "@/components/customer-logout";
import { getStoreCustomer } from "@/lib/customer-auth";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createTrackingToken, trackingPath } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";

export default async function PurchasesPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const customer = await getStoreCustomer(storeSlug);
  if (!customer) redirect(`/${storeSlug}/perfil/acceso`);
  const orders = await prisma.order.findMany({ where: { storeId: customer.storeId, customerEmail: customer.email, source: "STOREFRONT" }, orderBy: { createdAt: "desc" }, select: { id: true, code: true, total: true, status: true, createdAt: true, trackingTokenHash: true } });
  return <main className="container-page min-h-dvh py-8"><div className="flex items-center justify-between gap-3"><Link href={`/${storeSlug}`} className="text-sm font-semibold text-brand">← Volver a la tienda</Link><CustomerLogout storeSlug={storeSlug} /></div><header className="mt-8"><h1 className="text-3xl font-bold">Mis compras</h1><p className="mt-2 text-sm text-muted">{customer.email}</p></header><div className="mt-6 grid gap-3">{orders.length ? orders.map((order) => <article className="panel flex flex-wrap items-center justify-between gap-3 p-5" key={order.id}><div><p className="font-bold">Pedido #{order.code}</p><p className="mt-1 text-sm text-muted">{formatBuenosAiresDate(order.createdAt)} · {order.status === "CANCELLED" ? "Cancelado" : order.status === "DELIVERED" ? "Entregado" : "En proceso"}</p></div><div className="text-right"><p className="font-bold">{formatMoney(order.total)}</p>{order.trackingTokenHash ? <Link className="mt-2 inline-block text-sm font-semibold text-brand underline" href={trackingPath(storeSlug, createTrackingToken(order.id, customer.storeId))}>Ver estado</Link> : null}</div></article>) : <p className="panel p-6 text-sm text-muted">Todavía no hay compras asociadas a este correo.</p>}</div></main>;
}
