"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        slug: form.get("slug"),
        whatsappPhone: form.get("whatsappPhone"),
        businessType: form.get("businessType")
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo crear la tienda.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input className="field" name="name" placeholder="Nombre del negocio" required />
      <input className="field" name="slug" placeholder="slug-de-la-tienda" required />
      <input className="field" name="whatsappPhone" placeholder="WhatsApp con código de país, ej: 5491123456789" required />
      <select className="field" name="businessType" defaultValue="MIXED">
        <option value="FOOD">Comida</option>
        <option value="RETAIL">Retail</option>
        <option value="SERVICES">Servicios</option>
        <option value="MIXED">Multirubro</option>
      </select>
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button className="btn-primary" disabled={loading}>
        {loading ? "Creando tienda..." : "Crear tienda"}
      </button>
    </form>
  );
}
