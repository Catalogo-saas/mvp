"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatArgentineLocalPhone } from "@/lib/store-settings";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [whatsappLocal, setWhatsappLocal] = useState("");

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
        whatsappPhone: whatsappLocal,
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
      <label className="grid gap-2 text-sm font-bold">
        WhatsApp
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black text-ink">
            +54
          </span>
          <input
            className="field !pl-20"
            inputMode="numeric"
            maxLength={12}
            placeholder="123 456-7890"
            required
            value={whatsappLocal}
            onChange={(event) => setWhatsappLocal(formatArgentineLocalPhone(event.target.value))}
          />
        </div>
      </label>
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
