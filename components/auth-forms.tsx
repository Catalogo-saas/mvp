"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function safeCallbackUrl(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/gestion";
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
    const callbackUrl = safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl"));
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
      callbackUrl
    });
    setLoading(false);

    if (result?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="password" type="password" placeholder="Contraseña" required />
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password")
    };

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo crear la cuenta.");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false
    });

    setLoading(false);
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input className="field" name="name" placeholder="Nombre" required />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="password" type="password" placeholder="Contraseña mínimo 8 caracteres" required minLength={8} />
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Creando..." : "Crear cuenta"}
      </button>
    </form>
  );
}
