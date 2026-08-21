import { formatMoney } from "@/lib/money";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { OrderManager } from "@/components/order-manager";

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
  const serializedOrders = orders.map((order) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    notes: order.notes,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      subtotal: item.subtotal
    }))
  }));

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

      <OrderManager orders={serializedOrders} />
    </div>
  );
}
