import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentUserId, getMerchantStore } from "@/lib/merchant";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const store = await getMerchantStore();
  if (store) {
    redirect("/gestion");
  }

  return (
    <main className="container-page flex min-h-screen items-center justify-center py-12">
      <section className="panel w-full max-w-2xl p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Cuenta incompleta</p>
        <h1 className="mt-3 text-3xl font-black">Tu tienda todavía no fue asignada</h1>
        <p className="mt-2 text-muted">Las tiendas se crean desde el panel de superadmin. Contactá al administrador para completar el alta.</p>
        <Link className="btn-secondary mt-8" href="/api/auth/signout?callbackUrl=/">Cerrar sesión</Link>
      </section>
    </main>
  );
}
