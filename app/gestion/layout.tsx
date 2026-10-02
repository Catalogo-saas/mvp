import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin-nav";
import { getMerchantContext, getCurrentUserId } from "@/lib/merchant";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";
import "./admin.css";
import "./commerce.css";
import { prisma } from "@/lib/prisma";
import { OrderReadProvider } from "@/components/order-read-provider";
import { InternalToaster } from "@/components/internal-toaster";

export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const context = await getMerchantContext();
  if (!context) {
    redirect("/onboarding");
  }
  const { store, role } = context;

  const unreadCount = await prisma.order.count({ where: { storeId: store.id, readAt: null } });
  return (
    <UnsavedChangesProvider>
      <InternalToaster />
      <OrderReadProvider initialCount={unreadCount}>
      <div className="gestion-shell">
        <AdminNav storeSlug={store.slug} storeName={store.name} role={role} />
        <main className="admin-content">{children}</main>
      </div>
      </OrderReadProvider>
    </UnsavedChangesProvider>
  );
}
