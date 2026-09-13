import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { OrderManager } from "@/components/order-manager";

export default async function GestionOrdersPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  const serializedOrders = orders.map((order) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    source: order.source,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    notes: order.notes,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      options: item.options,
      subtotal: item.subtotal
    }))
  }));

  return (
    <div className="space-y-6">
      <header className="panel hidden p-6 md:block">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pedidos</p>
        <h1 className="mt-2 text-3xl font-black">Pedidos de {store.name}</h1>
        <p className="mt-2 text-muted">Los pedidos se guardan antes de abrir WhatsApp.</p>
      </header>

      <OrderManager orders={serializedOrders} />
    </div>
  );
}
