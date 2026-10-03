import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Viewport } from "next";

import { AdminNav } from "@/components/admin-nav";
import { getMerchantContext, getCurrentUserId } from "@/lib/merchant";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";
import "./admin.css";
import "./commerce.css";
import "./loading.css";
import { AdminLoading } from "@/components/admin-loading";
import { prisma } from "@/lib/prisma";
import { OrderReadProvider } from "@/components/order-read-provider";
import { InternalToaster } from "@/components/internal-toaster";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function GestionLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="gestion-shell"><main className="admin-loading-entry"><AdminLoading/></main></div>}><AuthenticatedGestionShell>{children}</AuthenticatedGestionShell></Suspense>;
}

async function AuthenticatedGestionShell({ children }: { children: React.ReactNode }) {
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
