import { AdminPageHeader } from "@/components/admin-ui";
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
      <AdminPageHeader title="Clientes" description="Contactos e historial de compras, en un solo lugar."/>
      <CustomerDirectory customers={customers} />
    </div>
  );
}
