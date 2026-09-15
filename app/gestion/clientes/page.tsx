import { CustomerDirectory } from "@/components/customer-directory";
import { aggregateCustomers, validCustomerOrderStatuses } from "@/lib/customer-summary";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  const store = await getMerchantStore();
  if (!store) return null;

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, status: { in: [...validCustomerOrderStatuses] } },
    select: { code: true, customerName: true, customerPhone: true, total: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  const customers = aggregateCustomers(orders);

  return (
    <div className="space-y-6">
      <header className="panel hidden p-6 sm:block">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Clientes</p>
        <h1 className="mt-2 text-3xl font-black">Clientes de {store.name}</h1>
        <p className="mt-2 text-muted">Historial simple construido automáticamente con tus pedidos.</p>
      </header>
      <CustomerDirectory customers={customers} />
    </div>
  );
}
