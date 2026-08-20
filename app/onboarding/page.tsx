import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { getCurrentUserId, getMerchantStore } from "@/lib/merchant";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const store = await getMerchantStore();
  if (store) {
    redirect("/admin");
  }

  return (
    <main className="container-page flex min-h-screen items-center justify-center py-12">
      <section className="panel w-full max-w-2xl p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Onboarding</p>
        <h1 className="mt-3 text-3xl font-black">Configurá tu tienda</h1>
        <p className="mt-2 text-muted">Estos datos se usan para publicar el catálogo y generar pedidos por WhatsApp.</p>
        <div className="mt-8">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
