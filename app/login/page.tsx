import Link from "next/link";

import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return (
    <main className="container-page flex min-h-screen items-center justify-center py-12">
      <section className="panel w-full max-w-md p-8">
        <Link href="/" className="text-lg font-black">
          Landing<span className="text-brand">SaaS</span>
        </Link>
        <h1 className="mt-8 text-3xl font-black">Ingresar</h1>
        <p className="mt-2 text-muted">Accedé al backoffice de tu tienda.</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-bold text-brand">
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
