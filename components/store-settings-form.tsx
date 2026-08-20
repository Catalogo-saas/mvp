"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StoreSettings = {
  name: string;
  description: string | null;
  whatsappPhone: string;
  businessType: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  address: string | null;
  template: string;
  theme: unknown;
};

function getThemeValue(theme: unknown, key: "primary" | "accent", fallback: string) {
  if (theme && typeof theme === "object" && key in theme) {
    const value = (theme as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return fallback;
}

function getTemplateValue(value: string) {
  return ["market", "quick-menu", "premium"].includes(value) ? value : "market";
}

export function StoreSettingsForm({ store }: { store: StoreSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(store.logoUrl ?? "");

  async function uploadLogo(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "logos");
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "No se pudo subir el logo");
    }
    setLogoUrl(data.url);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        whatsappPhone: form.get("whatsappPhone"),
        businessType: form.get("businessType"),
        logoUrl,
        heroTitle: form.get("heroTitle"),
        heroSubtitle: form.get("heroSubtitle"),
        address: form.get("address"),
        template: form.get("template"),
        primary: form.get("primary"),
        accent: form.get("accent")
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar la tienda.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel grid gap-4 p-6">
      <input className="field" name="name" defaultValue={store.name} placeholder="Nombre" required />
      <textarea className="field min-h-24" name="description" defaultValue={store.description ?? ""} placeholder="Descripción" />
      <input className="field" name="whatsappPhone" defaultValue={store.whatsappPhone} placeholder="WhatsApp" required />
      <select className="field" name="businessType" defaultValue={store.businessType}>
        <option value="FOOD">Comida</option>
        <option value="RETAIL">Retail</option>
        <option value="SERVICES">Servicios</option>
        <option value="MIXED">Multirubro</option>
      </select>
      <fieldset className="grid gap-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-black">Diseño público</legend>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3">
          <input name="template" type="radio" value="market" defaultChecked={getTemplateValue(store.template) === "market"} />
          <span>
            <span className="block font-black">Ecommerce promo</span>
            <span className="text-sm text-muted">Cards visuales, ofertas y precios promocionales destacados.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3">
          <input name="template" type="radio" value="quick-menu" defaultChecked={getTemplateValue(store.template) === "quick-menu"} />
          <span>
            <span className="block font-black">Menú rápido</span>
            <span className="text-sm text-muted">Lista compacta para sumar productos con menos pasos.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3">
          <input name="template" type="radio" value="premium" defaultChecked={getTemplateValue(store.template) === "premium"} />
          <span>
            <span className="block font-black">Retail premium</span>
            <span className="text-sm text-muted">Fotos grandes y una grilla más visual para productos.</span>
          </span>
        </label>
      </fieldset>
      <input className="field" name="heroTitle" defaultValue={store.heroTitle ?? ""} placeholder="Título principal" />
      <input className="field" name="heroSubtitle" defaultValue={store.heroSubtitle ?? ""} placeholder="Subtítulo" />
      <input className="field" name="address" defaultValue={store.address ?? ""} placeholder="Dirección o zona" />
      <input
        className="field"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            uploadLogo(file).catch((err) => setError(err.message));
          }
        }}
      />
      {logoUrl ? <p className="text-sm font-bold text-green-700">Logo configurado.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Color principal
          <input className="field mt-2 h-14" name="primary" type="color" defaultValue={getThemeValue(store.theme, "primary", "#16a34a")} />
        </label>
        <label className="text-sm font-bold">
          Color acento
          <input className="field mt-2 h-14" name="accent" type="color" defaultValue={getThemeValue(store.theme, "accent", "#f97316")} />
        </label>
      </div>
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button className="btn-primary" disabled={loading}>
        {loading ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}
