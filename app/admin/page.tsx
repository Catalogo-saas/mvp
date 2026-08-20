import { formatMoney } from "@/lib/money";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
      <header className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Backoffice</p>
        <h1 className="mt-2 text-3xl font-black">Pedidos de {store.name}</h1>
        <p className="mt-2 text-muted">Los pedidos se guardan antes de abrir WhatsApp.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Pedidos</p>
          <p className="mt-2 text-3xl font-black">{orders.length}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Total reciente</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(totalRevenue)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Estado</p>
          <p className="mt-2 text-3xl font-black">MVP</p>
        </article>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-black">Últimos pedidos</h2>
        </div>
        <div className="divide-y divide-line">
          {orders.length === 0 ? (
            <p className="p-5 text-muted">Todavía no hay pedidos.</p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className="p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <p className="font-black">#{order.code} · {order.customerName}</p>
                    <p className="text-sm text-muted">{order.customerPhone} · {order.fulfillment}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-black">{formatMoney(order.total)}</p>
                    <p className="text-sm font-bold text-green-700">{order.status}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}x {item.productName} — {formatMoney(item.subtotal)}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
