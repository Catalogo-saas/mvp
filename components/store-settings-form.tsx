"use client";

import { Check, Copy, Download, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
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
import { createStoreQrPdfBlob, generateQrMatrix, type QrMatrix } from "@/lib/public-qr";

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

function formatBusinessRanges(ranges: BusinessHoursRange[]) {
  if (!ranges.length) {
    return "Cerrado";
  }
  return ranges
    .map((range) => {
      const overnight = range.close < range.open;
      return `${range.open} a ${range.close}${overnight ? " del día siguiente" : ""}`;
    })
    .join(" · ");
}

function QrPreview({ matrix }: { matrix: QrMatrix }) {
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;

  return (
    <svg className="h-full w-full rounded-2xl bg-white p-3" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR de la página pública">
      <rect width={size} height={size} fill="white" />
      {matrix.map((row, y) =>
        row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" fill="#111827" /> : null))
      )}
    </svg>
  );
}

function getPdfLogoUrl(currentLogoUrl: string, savedLogoUrl: string | null) {
  if (!currentLogoUrl) {
    return undefined;
  }
  if (currentLogoUrl === savedLogoUrl) {
    return `/api/admin/logo-proxy?url=${encodeURIComponent(currentLogoUrl)}`;
  }
  return currentLogoUrl;
}

function getStoreInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("No se pudo copiar la URL.");
  }
}

function LogoPreview({ logoUrl, storeName, isPending }: { logoUrl: string; storeName: string; isPending: boolean }) {
  return (
    <div className="grid h-full min-h-[260px] place-items-center rounded-3xl border border-line bg-white p-5">
      <div className="grid aspect-square w-32 place-items-center overflow-hidden rounded-[28px] border border-line bg-green-50 sm:w-36">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={logoUrl} alt={`Logo de ${storeName}`} />
        ) : (
          <span className="text-4xl font-black text-brand">{getStoreInitials(storeName) || "LOGO"}</span>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-muted">
        {isPending ? "Nuevo logo seleccionado" : logoUrl ? "Logo actual" : "Sin logo cargado"}
      </p>
    </div>
  );
}

export function StoreSettingsForm({ store }: { store: StoreSettings }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshotRef = useRef<string | null>(null);
  const resetDirtyBaselineRef = useRef(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [publicUrlCopied, setPublicUrlCopied] = useState(false);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  useLockBodyScroll(hoursModalOpen);
  const [storeName, setStoreName] = useState(store.name);
  const [savedSlug, setSavedSlug] = useState(store.slug);
  const [address, setAddress] = useState(store.address ?? "");
  const [logoUrl, setLogoUrl] = useState(store.logoUrl ?? "");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [whatsappLocal, setWhatsappLocal] = useState(() => formatArgentineLocalPhone(store.whatsappPhone));
  const [restrictBySchedule, setRestrictBySchedule] = useState(store.restrictBySchedule);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(() => getBusinessHours(store.businessHours));
  const [mobileProductColumns, setMobileProductColumns] = useState<1 | 2>(() => getMobileColumnsValue(store.mobileProductColumns));
  const [formRevision, setFormRevision] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const publicStoreUrl = `${getAppBaseUrl()}/${savedSlug}`;
  const publicQr = useMemo(() => generateQrMatrix(publicStoreUrl), [publicStoreUrl]);
  const visibleLogoUrl = logoPreviewUrl || logoUrl;

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const value = (name: string) => {
      const fieldValue = formData.get(name);
      return typeof fieldValue === "string" ? fieldValue : "";
    };
    const currentSnapshot = JSON.stringify({
      name: storeName,
      description: value("description"),
      businessType: value("businessType"),
      address,
      whatsappLocal,
      paymentAccountHolder: value("paymentAccountHolder"),
      paymentProvider: value("paymentProvider"),
      paymentAlias: value("paymentAlias"),
      paymentCbu: value("paymentCbu"),
      restrictBySchedule,
      businessHours,
      template: value("template"),
      primary: value("primary"),
      accent: value("accent"),
      mobileProductColumns,
      logoUrl,
      selectedLogoFile: selectedLogoFile
        ? { name: selectedLogoFile.name, size: selectedLogoFile.size, lastModified: selectedLogoFile.lastModified, type: selectedLogoFile.type }
        : null
    });

    if (resetDirtyBaselineRef.current || initialSnapshotRef.current === null) {
      initialSnapshotRef.current = currentSnapshot;
      resetDirtyBaselineRef.current = false;
      setIsDirty(false);
      return;
    }

    setIsDirty(initialSnapshotRef.current !== currentSnapshot);
  }, [address, businessHours, formRevision, logoUrl, mobileProductColumns, restrictBySchedule, selectedLogoFile, storeName, whatsappLocal]);

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
    return () => setHasUnsavedChanges(false);
  }, [isDirty, setHasUnsavedChanges]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  useEffect(() => {
    if (!publicUrlCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setPublicUrlCopied(false), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [publicUrlCopied]);

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

  async function downloadQrPdf() {
    setQrLoading(true);
    setError("");
    try {
      const blob = await createStoreQrPdfBlob({
        url: publicStoreUrl,
        name: storeName,
        address,
        logoUrl: getPdfLogoUrl(logoUrl, store.logoUrl)
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${savedSlug || "tienda"}-qr.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el PDF.");
    } finally {
      setQrLoading(false);
    }
  }

  async function copyPublicStoreUrl() {
    setError("");
    try {
      await copyTextToClipboard(publicStoreUrl);
      setPublicUrlCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo copiar la URL.");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("name", storeName);
    form.set("whatsappPhone", whatsappLocal);
    form.set("address", address);
    form.set("logoUrl", logoUrl);
    form.set("restrictBySchedule", String(restrictBySchedule));
    form.set("businessHours", JSON.stringify(businessHours));
    form.set("mobileProductColumns", String(mobileProductColumns));
    if (selectedLogoFile) {
      form.set("logoFile", selectedLogoFile);
    }

    const response = await fetch("/api/admin/store", {
      method: "PATCH",
      body: form
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar la tienda.");
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (typeof data?.store?.slug === "string") {
      setSavedSlug(data.store.slug);
    }
    if (typeof data?.store?.logoUrl === "string" || data?.store?.logoUrl === null) {
      setLogoUrl(data.store.logoUrl ?? "");
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      setLogoPreviewUrl("");
      setSelectedLogoFile(null);
    }
    resetDirtyBaselineRef.current = true;
    setFormRevision((current) => current + 1);
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={() => setFormRevision((current) => current + 1)}
      className="grid gap-5 pb-28 md:pb-24"
    >
      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Datos</p>
          <h2 className="mt-1 text-2xl font-black">Información pública</h2>
        </div>
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid min-h-[28rem] grid-rows-[auto_1fr_auto] gap-4 rounded-3xl border border-line bg-surface p-4">
              <div>
                <p className="text-sm font-black">Logo del negocio</p>
                <p className="mt-1 text-sm text-muted">Se muestra en la tienda y en el PDF del QR.</p>
              </div>
              <LogoPreview logoUrl={visibleLogoUrl} storeName={storeName} isPending={Boolean(selectedLogoFile)} />
              <div>
                <label className="btn-secondary w-full">
                  <ImagePlus size={17} /> {visibleLogoUrl ? "Cambiar logo" : "Subir logo"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (logoPreviewUrl) {
                        URL.revokeObjectURL(logoPreviewUrl);
                      }
                      if (file) {
                        setError("");
                        setLogoPreviewUrl(URL.createObjectURL(file));
                        setSelectedLogoFile(file);
                      } else {
                        setLogoPreviewUrl("");
                        setSelectedLogoFile(null);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid min-h-[28rem] grid-rows-[auto_1fr_auto] gap-4 rounded-3xl border border-line bg-surface p-4">
              <div>
                <p className="text-sm font-black">QR público</p>
                <p className="mt-1 text-sm text-muted">Para imprimir o compartir en mostrador.</p>
              </div>
              <div className="grid min-h-[260px] place-items-center rounded-3xl border border-line bg-white p-5">
                <div className="aspect-square w-full max-w-56">
                  <QrPreview matrix={publicQr} />
                </div>
              </div>
              <button className="btn-secondary w-full" type="button" onClick={downloadQrPdf} disabled={qrLoading}>
                <Download size={17} /> {qrLoading ? "Generando PDF..." : "Descargar PDF"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Nombre del negocio
              <input className="field" name="name" value={storeName} placeholder="Tienda Norte" required onChange={(event) => setStoreName(event.target.value)} />
            </label>
            <div className="grid gap-2 text-sm font-bold">
              <span>URL pública</span>
              <div className="relative">
                <input className="field bg-surface pr-14 text-muted" value={publicStoreUrl} disabled readOnly aria-label="URL pública" />
                <button
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-brand hover:text-brand"
                  type="button"
                  onClick={copyPublicStoreUrl}
                  aria-label="Copiar URL pública"
                  title={publicUrlCopied ? "URL copiada" : "Copiar URL pública"}
                >
                  {publicUrlCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <label className="grid gap-2 text-sm font-bold">
            Descripción
            <textarea className="field min-h-24" name="description" defaultValue={store.description ?? ""} placeholder="Contá qué vende o qué servicios ofrece tu negocio" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Tipo de negocio
              <select className="field" name="businessType" defaultValue={store.businessType}>
                <option value="FOOD">Comida</option>
                <option value="RETAIL">Retail</option>
                <option value="SERVICES">Servicios</option>
                <option value="MIXED">Multirubro</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Dirección
              <input className="field" name="address" value={address} placeholder="San Miguel de Tucumán, Centro" onChange={(event) => setAddress(event.target.value)} />
            </label>
          </div>
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
              name="whatsappPhone"
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
          <label className="grid gap-2 text-sm font-bold">
            Titular de la cuenta
            <input className="field" name="paymentAccountHolder" defaultValue={store.paymentAccountHolder ?? ""} placeholder="Nombre y apellido o razón social" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Banco / billetera virtual
            <input className="field" name="paymentProvider" defaultValue={store.paymentProvider ?? ""} placeholder="Mercado Pago, Banco Nación" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Alias
            <input className="field" name="paymentAlias" defaultValue={store.paymentAlias ?? ""} placeholder="alias.de.pago" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            CBU / CVU
            <input className="field" name="paymentCbu" defaultValue={store.paymentCbu ?? ""} placeholder="Número de CBU o CVU" inputMode="numeric" />
          </label>
        </div>
      </section>

      <section className="panel grid gap-4 p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p>
            <h2 className="mt-1 text-2xl font-black">Atención</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm font-black">
              <input type="checkbox" checked={restrictBySchedule} onChange={(event) => setRestrictBySchedule(event.target.checked)} />
              Restringir tienda por horario
            </label>
            <button className="btn-secondary !px-4 !py-2 text-sm" type="button" onClick={() => setHoursModalOpen(true)}>
              <Pencil size={15} /> Editar horarios
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          {businessDayKeys.map((day) => (
            <article key={day} className="flex flex-col justify-between gap-2 rounded-2xl border border-line bg-white p-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-black">{businessDayLabels[day]}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{formatBusinessRanges(businessHours.days[day])}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel grid gap-4 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Diseño</p>
          <h2 className="mt-1 text-2xl font-black">Diseño público</h2>
        </div>
        <fieldset className="grid gap-3">
          <legend className="sr-only">Plantilla del sitio público</legend>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Color principal
            <input className="field mt-2 h-14" name="primary" type="color" defaultValue={getThemeValue(store.theme, "primary", "#16a34a")} />
          </label>
          <label className="text-sm font-bold">
            Color secundario
            <input className="field mt-2 h-14" name="accent" type="color" defaultValue={getThemeValue(store.theme, "accent", "#f97316")} />
          </label>
        </div>
        <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4">
          <div>
            <p className="font-black">Vista en celulares</p>
            <p className="mt-1 text-sm font-semibold text-muted">Elegí cuántos productos se muestran por fila.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2].map((columns) => (
              <button
                key={columns}
                className={`rounded-2xl border bg-white p-4 text-left ${mobileProductColumns === columns ? "border-brand bg-green-50" : "border-line"}`}
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
        </div>
      </section>

      {hoursModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-hidden bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Editar horarios de atención">
          <div className="panel grid h-[100dvh] min-h-[100dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden !rounded-none p-4 sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:!rounded-[24px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p>
                <h3 className="mt-1 text-2xl font-black">Editar atención</h3>
                <p className="mt-1 text-sm text-muted">Agregá rangos por día. Podés cerrar al día siguiente, por ejemplo 17:00 a 01:00.</p>
              </div>
              <button className="shrink-0 rounded-full border border-line p-2 text-muted" type="button" onClick={() => setHoursModalOpen(false)} aria-label="Cerrar modal de horarios">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto overscroll-contain pb-6 pr-1">
              {businessDayKeys.map((day) => (
                <article key={day} className="grid gap-3 rounded-2xl border border-line bg-white p-3">
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
                        <div key={`${day}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2">
                          <label className="grid min-w-0 gap-1 text-xs font-bold text-muted">
                            Apertura
                            <input className="field min-w-0 !px-2 !py-2 text-center" type="time" value={range.open} onChange={(event) => updateRange(day, index, { open: event.target.value })} />
                          </label>
                          <label className="grid min-w-0 gap-1 text-xs font-bold text-muted">
                            Cierre
                            <input className="field min-w-0 !px-2 !py-2 text-center" type="time" value={range.close} onChange={(event) => updateRange(day, index, { close: event.target.value })} />
                          </label>
                          <button className="grid h-11 w-11 place-items-center rounded-xl border border-line text-red-600" type="button" onClick={() => removeRange(day, index)} aria-label={`Eliminar rango de ${businessDayLabels[day]}`}>
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

            <div className="-mx-4 -mb-4 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <button className="btn-primary w-full" type="button" onClick={() => setHoursModalOpen(false)}>
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-4 bottom-4 z-40 grid gap-2 lg:bottom-6 lg:left-[calc((100vw-min(1120px,calc(100vw-32px)))/2+284px)] lg:right-[calc((100vw-min(1120px,calc(100vw-32px)))/2)]">
        {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-lg">{error}</p> : null}
        <button className="btn-primary w-full shadow-2xl shadow-green-900/20" disabled={loading}>
          {loading ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}
