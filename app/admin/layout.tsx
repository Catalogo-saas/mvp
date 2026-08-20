import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin-nav";
import { getCurrentUserId, getMerchantStore } from "@/lib/merchant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const store = await getMerchantStore();
  if (!store) {
    redirect("/onboarding");
  }

  return (
    <main className="container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr]">
      <AdminNav storeSlug={store.slug} />
      <section>{children}</section>
    </main>
  );
}
