import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth-forms";
import { getAuthenticatedUser } from "@/lib/merchant";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect("/panel");
  }
  const { error } = await searchParams;

  return (
    <main className="container-page flex min-h-screen items-center justify-center py-12">
      <section className="panel w-full max-w-md p-8">
        <Link href="/" className="text-lg font-black">
          Landing<span className="text-brand">SaaS</span>
        </Link>
        <h1 className="mt-8 text-3xl font-black">Ingresar</h1>
        <p className="mt-2 text-muted">Accedé al backoffice de tu tienda.</p>
        <div className="mt-8">
          {error === "inactive" ? <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">La cuenta está dada de baja. Contactá al administrador.</p> : null}
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
