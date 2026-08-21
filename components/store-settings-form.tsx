"use client";

import { Copy, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  businessDayKeys,
  businessDayLabels,
  emptyBusinessHours,
  formatArgentineLocalPhone,
  normalizeBusinessHours,
  type BusinessDayKey,
  type BusinessHours,
  type BusinessHoursRange
} from "@/lib/store-settings";
import { slugify } from "@/lib/slug";

type StoreSettings = {
  name: string;
  slug: string;
  description: string | null;
  whatsappPhone: string;
  businessType: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  address: string | null;
  template: string;
  theme: unknown;
  paymentAccountHolder: string | null;
  paymentProvider: string | null;
  paymentAlias: string | null;
  paymentCbu: string | null;
  restrictBySchedule: boolean;
  businessHours: unknown;
  mobileProductColumns: number;
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

function getBusinessHours(value: unknown) {
  try {
    return normalizeBusinessHours(value);
  } catch {
    return emptyBusinessHours();
  }
}

function getMobileColumnsValue(value: number) {
  return value === 2 ? 2 : 1;
}

function columnPreviewClass(columns: 1 | 2) {
  return columns === 2 ? "grid-cols-2" : "grid-cols-1";
}

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function StoreSettingsForm({ store }: { store: StoreSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState(store.name);
  const [logoUrl, setLogoUrl] = useState(store.logoUrl ?? "");
  const [whatsappLocal, setWhatsappLocal] = useState(() => formatArgentineLocalPhone(store.whatsappPhone));
  const [restrictBySchedule, setRestrictBySchedule] = useState(store.restrictBySchedule);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(() => getBusinessHours(store.businessHours));
  const [mobileProductColumns, setMobileProductColumns] = useState<1 | 2>(() => getMobileColumnsValue(store.mobileProductColumns));
  const previewSlug = slugify(storeName) || store.slug;
  const publicStoreUrl = `${getAppBaseUrl()}/${previewSlug}`;

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

  function updateRange(day: BusinessDayKey, index: number, patch: Partial<BusinessHoursRange>) {
    setBusinessHours((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: current.days[day].map((range, rangeIndex) => (rangeIndex === index ? { ...range, ...patch } : range))
      }
    }));
  }

  function addRange(day: BusinessDayKey) {
    setBusinessHours((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: [...current.days[day], { open: "09:00", close: "13:00" }]
      }
    }));
  }

  function removeRange(day: BusinessDayKey, index: number) {
    setBusinessHours((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: current.days[day].filter((_, rangeIndex) => rangeIndex !== index)
      }
    }));
  }

  function copyRangesToAllDays(day: BusinessDayKey) {
    setBusinessHours((current) => {
      const sourceRanges = current.days[day].map((range) => ({ ...range }));
      return {
        ...current,
        days: businessDayKeys.reduce<BusinessHours["days"]>((days, currentDay) => {
          days[currentDay] = sourceRanges.map((range) => ({ ...range }));
          return days;
        }, { ...current.days })
      };
    });
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
        name: storeName,
        description: form.get("description"),
        whatsappPhone: whatsappLocal,
        businessType: form.get("businessType"),
        logoUrl,
        address: form.get("address"),
        template: form.get("template"),
        primary: form.get("primary"),
        accent: form.get("accent"),
        paymentAccountHolder: form.get("paymentAccountHolder"),
        paymentProvider: form.get("paymentProvider"),
        paymentAlias: form.get("paymentAlias"),
        paymentCbu: form.get("paymentCbu"),
        restrictBySchedule,
        businessHours,
        mobileProductColumns
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
    <form onSubmit={onSubmit} className="grid gap-5">
      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Datos</p>
          <h2 className="mt-1 text-2xl font-black">Información pública</h2>
        </div>
        <input className="field" name="name" value={storeName} placeholder="Nombre" required onChange={(event) => setStoreName(event.target.value)} />
        <label className="grid gap-2 text-sm font-bold">
          URL pública
          <input className="field bg-surface text-muted" value={publicStoreUrl} disabled readOnly />
        </label>
        <textarea className="field min-h-24" name="description" defaultValue={store.description ?? ""} placeholder="Descripción" />
        <div className="grid gap-4 sm:grid-cols-2">
          <select className="field" name="businessType" defaultValue={store.businessType}>
            <option value="FOOD">Comida</option>
            <option value="RETAIL">Retail</option>
            <option value="SERVICES">Servicios</option>
            <option value="MIXED">Multirubro</option>
          </select>
          <input className="field" name="address" defaultValue={store.address ?? ""} placeholder="Dirección o zona" />
        </div>
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Contacto</p>
          <h2 className="mt-1 text-2xl font-black">WhatsApp</h2>
        </div>
        <label className="grid gap-2 text-sm font-bold">
          Número de WhatsApp
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black text-ink">
              +54
            </span>
            <input
              className="field !pl-20"
              inputMode="numeric"
              maxLength={12}
              placeholder="381 456-7890"
              required
              value={whatsappLocal}
              onChange={(event) => setWhatsappLocal(formatArgentineLocalPhone(event.target.value))}
              onBlur={() => setWhatsappLocal((current) => formatArgentineLocalPhone(current))}
            />
          </div>
        </label>
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Pagos</p>
          <h2 className="mt-1 text-2xl font-black">Datos de transferencia</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="field" name="paymentAccountHolder" defaultValue={store.paymentAccountHolder ?? ""} placeholder="Titular de la cuenta" />
          <input className="field" name="paymentProvider" defaultValue={store.paymentProvider ?? ""} placeholder="Banco / billetera virtual" />
          <input className="field" name="paymentAlias" defaultValue={store.paymentAlias ?? ""} placeholder="Alias" />
          <input className="field" name="paymentCbu" defaultValue={store.paymentCbu ?? ""} placeholder="CBU" inputMode="numeric" />
        </div>
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Diseño</p>
          <h2 className="mt-1 text-2xl font-black">Diseño público</h2>
        </div>
        <fieldset className="grid gap-3">
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
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Marca</p>
          <h2 className="mt-1 text-2xl font-black">Logo y colores</h2>
        </div>
        <label className="btn-secondary w-fit">
          <ImagePlus size={17} /> Subir logo
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                uploadLogo(file).catch((err) => setError(err.message));
              }
            }}
          />
        </label>
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
      </section>

      <section className="panel grid gap-4 p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p>
            <h2 className="mt-1 text-2xl font-black">Atención</h2>
          </div>
          <label className="flex items-center gap-3 text-sm font-black">
            <input type="checkbox" checked={restrictBySchedule} onChange={(event) => setRestrictBySchedule(event.target.checked)} />
            Restringir tienda por horario
          </label>
        </div>
        <div className="grid gap-3">
          {businessDayKeys.map((day) => (
            <article key={day} className="grid gap-3 rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black">{businessDayLabels[day]}</p>
                <div className="flex flex-wrap gap-2">
                  {businessHours.days[day].length ? (
                    <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => copyRangesToAllDays(day)}>
                      <Copy size={15} /> Copiar a todos
                    </button>
                  ) : null}
                  <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => addRange(day)}>
                    <Plus size={15} /> Rango
                  </button>
                </div>
              </div>
              {businessHours.days[day].length ? (
                <div className="grid gap-2">
                  {businessHours.days[day].map((range, index) => (
                    <div key={`${day}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input className="field !py-2" type="time" value={range.open} onChange={(event) => updateRange(day, index, { open: event.target.value })} />
                      <input className="field !py-2" type="time" value={range.close} onChange={(event) => updateRange(day, index, { close: event.target.value })} />
                      <button className="rounded-xl border border-line px-3 text-red-600" type="button" onClick={() => removeRange(day, index)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface p-3 text-sm font-bold text-muted">Cerrado</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mobile</p>
          <h2 className="mt-1 text-2xl font-black">Vista en celulares</h2>
          <p className="mt-1 text-muted">Elegí cuántos productos se muestran por fila.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((columns) => (
            <button
              key={columns}
              className={`rounded-2xl border p-4 text-left ${mobileProductColumns === columns ? "border-brand bg-green-50" : "border-line bg-white"}`}
              type="button"
              onClick={() => setMobileProductColumns(columns as 1 | 2)}
            >
              <p className="text-center font-black">{columns} {columns === 1 ? "columna" : "columnas"}</p>
              <div className="mx-auto mt-3 w-36 rounded-[26px] border-4 border-slate-200 bg-white p-3">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
                <div className={`grid ${columnPreviewClass(columns as 1 | 2)} gap-2`}>
                  {Array.from({ length: columns }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-line p-2">
                      <div className="aspect-square rounded-lg bg-green-100" />
                      <div className="mt-2 h-2 rounded-full bg-ink" />
                      <div className="mt-1 h-2 w-2/3 rounded-full bg-slate-300" />
                      <div className="mt-2 h-3 rounded-full bg-brand" />
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button className="btn-primary" disabled={loading}>
        {loading ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}
