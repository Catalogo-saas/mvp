"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerVerifyButton({ storeSlug, token }: { storeSlug: string; token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    const response = await fetch(`/api/customer/${storeSlug}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok) { setMessage(result?.error ?? "No se pudo verificar el correo."); return; }
    router.push(`/${storeSlug}/perfil/acceso`);
  }
  return <div className="mt-6"><button type="button" onClick={() => void verify()} disabled={busy} className="btn-primary w-full">{busy ? "Verificando..." : "Verificar mi correo"}</button>{message ? <p className="mt-3 text-sm text-red-700" role="alert">{message}</p> : null}</div>;
}
