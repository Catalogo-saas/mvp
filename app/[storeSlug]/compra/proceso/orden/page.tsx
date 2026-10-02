import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { hashTrackingToken } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";
import { ReceiptUpload } from "@/components/receipt-upload";

export const metadata: Metadata = { title: "Estado de tu pedido", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ hash?: string | string[] }>;
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function OrderStatusPage({ params, searchParams }: Props) {
  const { storeSlug } = await params;
  const { hash } = await searchParams;
  if (typeof hash !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(hash)) notFound();

  const order = await prisma.order.findFirst({
    where: { trackingTokenHash: hashTrackingToken(hash), store: { slug: storeSlug, owner: { status: "ACTIVE" } } },
    include: { store: { select: { name: true, slug: true, owner: { select: { email: true } } } }, items: true, events: { orderBy: { createdAt: "asc" } } }
  });
  if (!order) notFound();

  const checkout = order.checkout && typeof order.checkout === "object" && !Array.isArray(order.checkout) ? order.checkout as Record<string, unknown> : {};
  const paymentLabel = order.paymentStatus === "CONFIRMED" ? "Pago confirmado" : order.paymentStatus === "CANCELLED" ? "Pago cancelado" : "Por confirmar pago";
  const fulfillmentLabel = order.fulfillmentStatus === "DELIVERED" ? "Entregado" : order.fulfillmentStatus === "SHIPPED" ? "Enviado" : order.fulfillmentStatus === "PACKED" ? "Pedido empaquetado" : order.fulfillmentStatus === "CANCELLED" ? "Pedido cancelado" : "Por empaquetar";
  const headline = order.status === "CANCELLED" ? "Pedido cancelado" : order.fulfillmentStatus === "DELIVERED" ? "Entregado" : order.paymentStatus === "CONFIRMED" ? "Pago confirmado" : "Pago pendiente";

  return (
    <main className="min-h-dvh bg-[#fafafa] text-slate-900">
      <div className="mx-auto max-w-3xl bg-white px-4 pb-12 sm:min-h-dvh sm:px-8">
        <header className="border-b border-slate-200 py-5">
          <Link href={`/${storeSlug}`} className="text-2xl font-bold tracking-tight">{order.store.name}</Link>
        </header>
        <details className="border-b border-slate-200 py-4">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
            <span>Mostrar detalles del pedido</span><strong>{formatMoney(order.total)}</strong>
          </summary>
          <div className="mt-4 space-y-3 text-sm">
            {order.items.map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.productName} × {item.quantity}</span><span>{formatMoney(item.subtotal)}</span></div>)}
            {typeof checkout.discount === "number" && checkout.discount > 0 ? <div className="flex justify-between"><span>Descuento</span><span>-{formatMoney(checkout.discount)}</span></div> : null}
            {typeof checkout.shipping === "number" ? <div className="flex justify-between"><span>Entrega</span><span>{formatMoney(checkout.shipping)}</span></div> : <p>Entrega: costo a convenir</p>}
            {typeof checkout.preTaxTotal === "number" ? <><div className="flex justify-between"><span>Sin impuestos</span><span>{formatMoney(checkout.preTaxTotal)}</span></div><div className="flex justify-between"><span>Impuestos</span><span>{formatMoney(Number(checkout.taxAmount) || 0)}</span></div></> : null}
          </div>
        </details>

        <section className="mt-6 rounded-xl border border-slate-200 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pedido #{order.code}</p>
          <h1 className="mt-2 text-2xl font-bold">{headline}</h1>
          <p className="mt-2 text-sm text-slate-500">Realizado el {formatBuenosAiresDate(order.createdAt)}</p>
        </section>

        <section aria-label="Cronología del pedido" className="mt-5 rounded-xl border border-slate-200 p-5 sm:p-7">
          <ol className="space-y-5 border-l-2 border-green-500 pl-5">
            {order.events.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-green-600" /><p className="font-semibold">{event.label}</p><time className="text-xs text-slate-500">{formatBuenosAiresDate(event.createdAt)}</time></li>)}
          </ol>
          <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2"><p><strong>Pago:</strong> {paymentLabel}</p><p><strong>Preparación y entrega:</strong> {fulfillmentLabel}</p></div>
        </section>

        <section className="mt-5 grid gap-5 rounded-xl border border-slate-200 p-5 text-sm sm:grid-cols-2 sm:p-7">
          <h2 className="text-xl font-bold sm:col-span-2">Información del pedido</h2>
          <div><h3 className="font-semibold">Método de entrega</h3><p className="mt-1 text-slate-600">{order.fulfillment}</p>{textValue(checkout.deliveryAddress) ? <p className="mt-1 whitespace-pre-wrap text-slate-600">{textValue(checkout.deliveryAddress)}</p> : null}<p className="text-slate-600">{[checkout.postalCode, checkout.city, checkout.province, checkout.country].filter((item) => typeof item === "string").join(", ")}</p></div>
          <div><h3 className="font-semibold">Método de pago</h3><p className="mt-1 text-slate-600">{textValue(checkout.paymentName) ?? (checkout.paymentMethod === "transfer" ? "Transferencia" : "Efectivo")}</p>{textValue(checkout.paymentInstructions) ? <p className="mt-1 whitespace-pre-wrap text-slate-600">{textValue(checkout.paymentInstructions)}</p> : null}</div>
          <div><h3 className="font-semibold">Destinatario</h3><p className="mt-1 text-slate-600">{order.customerName}</p>{order.customerPhone ? <p className="text-slate-600">{order.customerPhone}</p> : null}{textValue(checkout.dni) ? <p className="text-slate-600">DNI/CUIT/CUIL: {textValue(checkout.dni)}</p> : null}</div>
          <div><h3 className="font-semibold">Contacto y facturación</h3>{order.customerEmail ? <p className="mt-1 break-all text-slate-600">{order.customerEmail}</p> : null}{textValue(checkout.billingAddress) ? <p className="mt-1 whitespace-pre-wrap text-slate-600">{textValue(checkout.billingAddress)}</p> : null}</div>
        </section>
        {checkout.requestReceipt === true && order.paymentStatus === "PENDING" ? <ReceiptUpload token={hash} hasReceipt={Boolean(order.receiptKey)}/> : null}
        <section className="mt-5 rounded-xl border border-slate-200 p-5 text-sm sm:p-7"><h2 className="text-lg font-bold">Consultá todas tus compras</h2><p className="mt-2 text-slate-600">Creá una cuenta o ingresá con el mismo correo de este pedido para verlo también en «Mis compras».</p><Link className="mt-3 inline-block font-semibold underline" href={`/${storeSlug}/perfil/acceso`}>Ingresar o registrarme</Link></section>
        <Link href={`/${storeSlug}`} className="mt-6 block rounded-lg bg-slate-950 px-5 py-3 text-center font-semibold text-white">Seguir comprando</Link>
        <p className="mt-5 text-center text-sm">¿Necesitás ayuda? <a className="underline" href={`mailto:${order.store.owner.email}`}>Contactanos</a></p>
      </div>
    </main>
  );
}
