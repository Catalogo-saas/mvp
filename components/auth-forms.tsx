"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./auth-forms.module.css";

function safeCallbackUrl(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "";
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const returnTo = safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl"));
    const callbackUrl = returnTo ? `/panel?returnTo=${encodeURIComponent(returnTo)}` : "/panel";

    try {
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.loginForm} aria-busy={loading}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="login-email">Email</label>
        <input
          className={styles.input}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="login-password">Contraseña</label>
        <input
          className={styles.input}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </div>

      {error ? <p className={styles.error} id="login-error" role="alert">{error}</p> : null}

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? <LoaderCircle className={styles.loadingIcon} size={18} aria-hidden="true" /> : null}
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
