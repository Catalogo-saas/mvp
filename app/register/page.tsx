import Link from "next/link";

import { RegisterForm } from "@/components/auth-forms";

export default function RegisterPage() {
  return (
    <main className="container-page flex min-h-screen items-center justify-center py-12">
      <section className="panel w-full max-w-md p-8">
        <Link href="/" className="text-lg font-black">
          Landing<span className="text-brand">SaaS</span>
        </Link>
        <h1 className="mt-8 text-3xl font-black">Crear cuenta</h1>
        <p className="mt-2 text-muted">Después vas a configurar tu tienda y WhatsApp.</p>
        <div className="mt-8">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-bold text-brand">
            Ingresar
          </Link>
        </p>
      </section>
    </main>
  );
}
