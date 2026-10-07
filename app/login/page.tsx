import type { Metadata } from "next";
import { Store } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth-forms";
import { getAuthenticatedUser } from "@/lib/merchant";

import styles from "./login.module.css";

export const metadata: Metadata = {
  title: { absolute: "Ingresar | Mi negocio" },
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect("/panel");
  }
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><Store size={22} strokeWidth={2.2} /></span>
          <span>Mi negocio</span>
        </div>

        <div className={styles.formHeading}>
          <h1 id="login-title">Ingresar</h1>
          <p>Accedé al backoffice de tu tienda.</p>
        </div>

        {error === "inactive" ? (
          <p className={styles.inactiveNotice} role="alert">
            La cuenta está dada de baja. Contactá al administrador.
          </p>
        ) : null}

        <LoginForm />
      </section>
    </main>
  );
}
