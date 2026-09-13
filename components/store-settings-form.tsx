"use client";

/* eslint-disable @next/next/no-img-element */

import { Check, Copy, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { normalizeStoreTemplate, storeTemplateLabels, templateOriginalColors } from "@/lib/catalog";
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

type StoreSettings = {
  name: string;
  slug: string;
  description: string | null;
  whatsappPhone: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrls: string[];
  address: string | null;
  theme: unknown;
  template: string;
  showCategories: boolean;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  acceptTransferPayments: boolean;
  paymentAccountHolder: string | null;
  paymentProvider: string | null;
  paymentAlias: string | null;
  paymentCbu: string | null;
  businessHoursText: string | null;
  restrictBySchedule: boolean;
  businessHours: unknown;
  mobileProductColumns: number;
};

type CategorySetting = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  _count: { products: number };
};

type ImageDraft = { id: string; url: string; file?: File };

function getThemeValue(theme: unknown, key: "primary" | "accent", fallback: string) {
  if (theme && typeof theme === "object" && key in theme) {
    const value = (theme as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return fallback;
}

function getUseTemplateColors(theme: unknown) {
  return Boolean(theme && typeof theme === "object" && "useTemplateColors" in theme && (theme as Record<string, unknown>).useTemplateColors === true);
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

function formatBusinessRanges(ranges: BusinessHoursRange[]) {
  if (!ranges.length) {
    return "Cerrado";
  }
  return ranges
    .map((range) => `${range.open} a ${range.close}${range.close < range.open ? " del día siguiente" : ""}`)
    .join(" · ");
}

function getStoreInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function uniqueId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function Switch({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-white p-4">
      <div>
        <p className="font-black">{label}</p>
        {description ? <p className="mt-1 text-sm font-semibold text-muted">{description}</p> : null}
      </div>
      <button
        className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? "bg-brand" : "bg-slate-300"}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function LogoPreview({ logoUrl, storeName, pending }: { logoUrl: string; storeName: string; pending: boolean }) {
  return (
    <div className="grid min-h-[230px] place-items-center rounded-3xl border border-line bg-white p-5">
      <div className="grid aspect-square w-32 place-items-center overflow-hidden rounded-[28px] border border-line bg-green-50 sm:w-36">
        {logoUrl ? (
          <img className="h-full w-full object-cover" src={logoUrl} alt={`Logo de ${storeName}`} />
        ) : (
          <span className="text-4xl font-black text-brand">{getStoreInitials(storeName) || "LOGO"}</span>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-muted">{pending ? "Nuevo logo seleccionado" : logoUrl ? "Logo actual" : "Sin logo cargado"}</p>
    </div>
  );
}

export function StoreSettingsForm({ store, categories: initialCategories }: { store: StoreSettings; categories: CategorySetting[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshotRef = useRef<string | null>(null);
  const resetDirtyBaselineRef = useRef(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const [storeName, setStoreName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? "");
  const [address, setAddress] = useState(store.address ?? "");
  const [whatsappLocal, setWhatsappLocal] = useState(() => formatArgentineLocalPhone(store.whatsappPhone));
  const [heroTitle, setHeroTitle] = useState(store.heroTitle ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(store.heroSubtitle ?? "");
  const [primary, setPrimary] = useState(getThemeValue(store.theme, "primary", "#16a34a"));
  const [accent, setAccent] = useState(getThemeValue(store.theme, "accent", "#f97316"));
  const [useTemplateColors, setUseTemplateColors] = useState(getUseTemplateColors(store.theme));
  const [logoUrl, setLogoUrl] = useState(store.logoUrl ?? "");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [heroImages, setHeroImages] = useState<ImageDraft[]>(() => store.heroImageUrls.map((url) => ({ id: url, url })));
  const [showCategories, setShowCategories] = useState(store.showCategories);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(store.freeShippingEnabled);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(String(store.freeShippingThreshold || 35000));
  const [acceptTransferPayments, setAcceptTransferPayments] = useState(store.acceptTransferPayments);
  const [paymentAccountHolder, setPaymentAccountHolder] = useState(store.paymentAccountHolder ?? "");
  const [paymentProvider, setPaymentProvider] = useState(store.paymentProvider ?? "");
  const [paymentAlias, setPaymentAlias] = useState(store.paymentAlias ?? "");
  const [paymentCbu, setPaymentCbu] = useState(store.paymentCbu ?? "");
  const [businessHoursText, setBusinessHoursText] = useState(store.businessHoursText ?? "");
  const [restrictBySchedule, setRestrictBySchedule] = useState(store.restrictBySchedule);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(() => getBusinessHours(store.businessHours));
  const [mobileProductColumns, setMobileProductColumns] = useState<1 | 2>(() => getMobileColumnsValue(store.mobileProductColumns));
  const [categories, setCategories] = useState(initialCategories);
  const [categoryFiles, setCategoryFiles] = useState<Record<string, File>>({});
  const [categoryPreviews, setCategoryPreviews] = useState<Record<string, string>>({});
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [publicUrlCopied, setPublicUrlCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formRevision, setFormRevision] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useLockBodyScroll(hoursModalOpen);

  const publicStoreUrl = `${getAppBaseUrl()}/${store.slug}`;
  const normalizedTemplate = normalizeStoreTemplate(store.template);
  const originalColors = templateOriginalColors[normalizedTemplate] ?? null;
  const visibleLogoUrl = logoPreviewUrl || logoUrl;
  const heroFileCount = heroImages.filter((image) => image.file).length;

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        storeName,
        description,
        address,
        whatsappLocal,
        heroTitle,
        heroSubtitle,
        primary,
        accent,
        useTemplateColors,
        logoUrl,
        heroImages: heroImages.map((image) => ({ url: image.url, file: image.file?.name ?? null })),
        showCategories,
        freeShippingEnabled,
        freeShippingThreshold,
        acceptTransferPayments,
        paymentAccountHolder,
        paymentProvider,
        paymentAlias,
        paymentCbu,
        businessHoursText,
        restrictBySchedule,
        businessHours,
        mobileProductColumns,
        categoryFiles: Object.fromEntries(
          Object.entries(categoryFiles).map(([categoryId, file]) => [categoryId, { name: file.name, size: file.size, lastModified: file.lastModified }])
        ),
        selectedLogoFile: selectedLogoFile ? { name: selectedLogoFile.name, size: selectedLogoFile.size, lastModified: selectedLogoFile.lastModified } : null
      }),
    [
      acceptTransferPayments,
      address,
      businessHours,
      businessHoursText,
      categoryFiles,
      description,
      freeShippingEnabled,
      freeShippingThreshold,
      heroImages,
      heroSubtitle,
      heroTitle,
      primary,
      accent,
      useTemplateColors,
      logoUrl,
      mobileProductColumns,
      paymentAccountHolder,
      paymentAlias,
      paymentCbu,
      paymentProvider,
      restrictBySchedule,
      selectedLogoFile,
      showCategories,
      storeName,
      whatsappLocal
    ]
  );

  useEffect(() => {
    if (resetDirtyBaselineRef.current || initialSnapshotRef.current === null) {
      initialSnapshotRef.current = snapshot;
      resetDirtyBaselineRef.current = false;
      setIsDirty(false);
      return;
    }
    setIsDirty(initialSnapshotRef.current !== snapshot);
  }, [snapshot, formRevision]);

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
    return () => setHasUnsavedChanges(false);
  }, [isDirty, setHasUnsavedChanges]);

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
    setBusinessHours((current) => ({ ...current, days: { ...current.days, [day]: [...current.days[day], { open: "09:00", close: "13:00" }] } }));
  }

  function removeRange(day: BusinessDayKey, index: number) {
    setBusinessHours((current) => ({ ...current, days: { ...current.days, [day]: current.days[day].filter((_, rangeIndex) => rangeIndex !== index) } }));
  }

  function copyRangesToAllDays(day: BusinessDayKey) {
    setBusinessHours((current) => {
      const sourceRanges = current.days[day].map((range) => ({ ...range }));
      const days = { ...current.days };
      businessDayKeys.forEach((currentDay) => {
        days[currentDay] = sourceRanges.map((range) => ({ ...range }));
      });
      return { ...current, days };
    });
  }

  function replaceHeroImage(index: number, file: File | undefined) {
    if (!file) return;
    setHeroImages((current) => {
      const next = [...current];
      const previous = next[index];
      if (previous?.file) URL.revokeObjectURL(previous.url);
      next[index] = { id: uniqueId(), url: URL.createObjectURL(file), file };
      return next.slice(0, 3);
    });
    setError("");
  }

  function removeHeroImage(index: number) {
    setHeroImages((current) => {
      const image = current[index];
      if (image?.file) URL.revokeObjectURL(image.url);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function copyPublicStoreUrl() {
    try {
      await navigator.clipboard.writeText(publicStoreUrl);
      setPublicUrlCopied(true);
    } catch {
      setError("No se pudo copiar la URL pública.");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.set("name", storeName);
    formData.set("description", description);
    formData.set("address", address);
    formData.set("whatsappPhone", whatsappLocal);
    formData.set("heroTitle", heroTitle);
    formData.set("heroSubtitle", heroSubtitle);
    formData.set("logoUrl", logoUrl);
    formData.set("heroImageUrls", JSON.stringify(heroImages.filter((image) => !image.file).map((image) => image.url)));
    formData.set("primary", primary);
    formData.set("accent", accent);
    formData.set("useTemplateColors", String(useTemplateColors));
    formData.set("showCategories", String(showCategories));
    formData.set("freeShippingEnabled", String(freeShippingEnabled));
    formData.set("freeShippingThreshold", digitsOnly(freeShippingThreshold) || "0");
    formData.set("acceptTransferPayments", String(acceptTransferPayments));
    formData.set("paymentAccountHolder", paymentAccountHolder);
    formData.set("paymentProvider", paymentProvider);
    formData.set("paymentAlias", paymentAlias);
    formData.set("paymentCbu", paymentCbu);
    formData.set("businessHoursText", businessHoursText);
    formData.set("restrictBySchedule", String(restrictBySchedule));
    formData.set("businessHours", JSON.stringify(businessHours));
    formData.set("mobileProductColumns", String(mobileProductColumns));
    formData.set("categoryFileIds", JSON.stringify(Object.keys(categoryFiles)));
    if (selectedLogoFile) formData.set("logoFile", selectedLogoFile);
    heroImages.forEach((image) => {
      if (image.file) formData.append("heroFiles", image.file);
    });
    Object.values(categoryFiles).forEach((file) => formData.append("categoryFiles", file));

    const response = await fetch("/api/admin/store", { method: "PATCH", body: formData });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo guardar la tienda.");
      return;
    }

    setLogoUrl(data.store.logoUrl ?? "");
    heroImages.forEach((image) => {
      if (image.file) URL.revokeObjectURL(image.url);
    });
    setHeroImages((data.store.heroImageUrls ?? []).map((url: string) => ({ id: url, url })));
    if (Array.isArray(data.categories)) setCategories(data.categories);
    Object.values(categoryPreviews).forEach((preview) => URL.revokeObjectURL(preview));
    setCategoryFiles({});
    setCategoryPreviews({});
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl("");
    setSelectedLogoFile(null);
    resetDirtyBaselineRef.current = true;
    setFormRevision((current) => current + 1);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={() => setFormRevision((current) => current + 1)} className="grid gap-5 pb-28">
      <section className="panel grid gap-5 bg-[#fff8fb] p-5 sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Identidad</p>
          <h2 className="mt-1 text-2xl font-black">Así se ve tu marca</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-3 self-start">
            <LogoPreview logoUrl={visibleLogoUrl} storeName={storeName} pending={Boolean(selectedLogoFile)} />
            <label className="btn-secondary h-12 w-full !py-0">
              <ImagePlus size={17} /> {visibleLogoUrl ? "Cambiar logo" : "Subir logo"}
              <input className="sr-only" type="file" accept="image/*" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
                if (file) {
                  setLogoPreviewUrl(URL.createObjectURL(file));
                  setSelectedLogoFile(file);
                }
              }} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">Nombre del negocio<input className="field" value={storeName} onChange={(event) => setStoreName(event.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-bold">Dirección<input className="field" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Dirección o zona" /></label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">Descripción<textarea className="field min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contá qué vende tu negocio" /></label>
            <div className="grid gap-2 text-sm font-bold sm:col-span-2"><span>URL pública</span><div className="relative"><input className="field bg-surface pr-12 text-muted" value={publicStoreUrl} disabled readOnly /><button className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-white" type="button" onClick={() => void copyPublicStoreUrl()} aria-label="Copiar URL pública">{publicUrlCopied ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
            {originalColors ? <div className="grid gap-3 rounded-3xl border border-line bg-white p-4 sm:col-span-2"><Switch checked={useTemplateColors} onChange={setUseTemplateColors} label="Usar colores originales de la plantilla" description={`Aplica la paleta original de ${storeTemplateLabels[normalizedTemplate]} sin borrar tus colores personalizados.`} />{useTemplateColors ? <div className="flex flex-wrap gap-3 text-xs font-bold text-muted"><span className="flex items-center gap-2"><i className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: originalColors.primary }} />Principal · {originalColors.primary}</span><span className="flex items-center gap-2"><i className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: originalColors.accent }} />Secundario · {originalColors.accent}</span></div> : null}</div> : null}
            <label className="grid gap-2 text-sm font-bold">Color principal<input className="field h-14 disabled:cursor-not-allowed disabled:opacity-45" name="primary" type="color" value={primary} disabled={Boolean(originalColors && useTemplateColors)} onChange={(event) => setPrimary(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-bold">Color secundario<input className="field h-14 disabled:cursor-not-allowed disabled:opacity-45" name="accent" type="color" value={accent} disabled={Boolean(originalColors && useTemplateColors)} onChange={(event) => setAccent(event.target.value)} /></label>
          </div>
        </div>
        <label className="grid gap-2 text-sm font-bold"><span>WhatsApp de pedidos</span><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black">+54</span><input className="field !pl-[3.25rem]" inputMode="numeric" maxLength={12} value={whatsappLocal} onChange={(event) => setWhatsappLocal(formatArgentineLocalPhone(event.target.value))} onBlur={() => setWhatsappLocal(formatArgentineLocalPhone(whatsappLocal))} required /></div></label>
      </section>

      <section className="panel grid gap-5 bg-[#f8f5ff] p-5 sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Página pública</p>
          <h2 className="mt-1 text-2xl font-black">Tu portada y catálogo</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Estos datos se utilizan en las dos plantillas públicas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Título principal<input className="field" value={heroTitle} onChange={(event) => setHeroTitle(event.target.value)} placeholder={store.name} /></label>
          <label className="grid gap-2 text-sm font-bold">Subtítulo<input className="field" value={heroSubtitle} onChange={(event) => setHeroSubtitle(event.target.value)} placeholder="Elegí tus productos y pedí por WhatsApp" /></label>
        </div>
        <div className="grid gap-4 rounded-3xl border border-line p-4">
          <div>
            <div className="flex items-center gap-2"><ImagePlus size={24} className="text-brand" /><p className="font-black">Imágenes del hero</p></div>
            <p className="mt-1 text-sm font-semibold text-muted">Podés cargar hasta tres imágenes. Se mostrarán en un carrusel automático.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => {
              const image = heroImages[index];
              return (
                <div key={index} className="grid gap-3">
                  <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-[#e6bfd0]">
                    {image ? <img src={image.url} alt={`Imagen del hero ${index + 1}`} className="h-full w-full object-cover" /> : <div className="text-center text-muted"><p className="font-black">Imagen {index + 1}</p><p className="font-black">Opcional</p></div>}
                    {image ? <button className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-red-600" type="button" onClick={() => removeHeroImage(index)} aria-label={`Eliminar imagen ${index + 1}`}><Trash2 size={15} /></button> : null}
                  </div>
                  <label className="btn-secondary w-full !px-3">
                    <ImagePlus size={17} /> {image ? "Cambiar" : "Agregar"}
                    <input className="sr-only" type="file" accept="image/*" onChange={(event) => replaceHeroImage(index, event.currentTarget.files?.[0])} />
                  </label>
                </div>
              );
            })}
          </div>
          {heroFileCount ? <p className="text-xs font-bold text-muted">{heroFileCount} imagen(es) nuevas pendientes de guardar.</p> : null}
        </div>
        <Switch checked={showCategories} onChange={setShowCategories} label="Mostrar categorías" description="Muestra accesos rápidos a las categorías en la tienda pública." />
        {showCategories ? <div className="grid gap-3 rounded-3xl border border-line bg-white p-4">
          <div><p className="font-black">Imágenes de categorías</p><p className="mt-1 text-sm font-semibold text-muted">Personalizá las tarjetas de categorías de tu ecommerce.</p></div>
          {categories.length ? categories.map((category) => {
            const preview = categoryPreviews[category.id] || category.imageUrl;
            return <article key={category.id} className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[90px_1fr] sm:items-center"><div className="aspect-square overflow-hidden rounded-xl bg-surface">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs font-bold text-muted">Sin imagen</div>}</div><div><p className="font-black">{category.name}</p><p className="text-sm text-muted">{category._count.products} producto(s)</p><label className="btn-secondary mt-2 !px-3 !py-2 text-sm"><ImagePlus size={15} /> Agregar<input className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; if (categoryPreviews[category.id]) URL.revokeObjectURL(categoryPreviews[category.id]); setCategoryFiles((current) => ({ ...current, [category.id]: file })); setCategoryPreviews((current) => ({ ...current, [category.id]: URL.createObjectURL(file) })); }} /></label></div></article>;
          }) : <p className="rounded-2xl bg-surface p-4 text-sm font-bold text-muted">Creá categorías desde Productos para poder personalizarlas.</p>}
        </div> : null}
      </section>

      <section className="panel grid gap-4 p-5 sm:p-6">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Envíos</p><h2 className="mt-1 text-2xl font-black">Envío gratis</h2></div>
        <Switch checked={freeShippingEnabled} onChange={setFreeShippingEnabled} label="Ofrecer envío gratis" description="Muestra el progreso hacia el envío gratis en el carrito." />
        {freeShippingEnabled ? <label className="grid gap-2 text-sm font-bold">Monto mínimo<input className="field" inputMode="numeric" value={freeShippingThreshold} onChange={(event) => setFreeShippingThreshold(digitsOnly(event.target.value))} placeholder="35.000" /></label> : null}
      </section>

      <section className="panel grid gap-4 p-5 sm:p-6">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Pagos</p><h2 className="mt-1 text-2xl font-black">Transferencias</h2></div>
        <Switch checked={acceptTransferPayments} onChange={setAcceptTransferPayments} label="Aceptar pagos por transferencia" description="Al activarlo, también se mostrará como opción en el checkout público." />
        {acceptTransferPayments ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Titular<input className="field" value={paymentAccountHolder} onChange={(event) => setPaymentAccountHolder(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Banco o billetera<input className="field" value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Alias<input className="field" value={paymentAlias} onChange={(event) => setPaymentAlias(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">CBU / CVU<input className="field" inputMode="numeric" value={paymentCbu} onChange={(event) => setPaymentCbu(event.target.value)} /></label></div> : null}
      </section>

      <section className="panel grid gap-4 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p><h2 className="mt-1 text-2xl font-black">Atención</h2></div><div className="flex flex-wrap gap-3"><Switch checked={restrictBySchedule} onChange={setRestrictBySchedule} label="Restringir tienda por horario" /><button className="btn-secondary !px-4 !py-2 text-sm" type="button" onClick={() => setHoursModalOpen(true)}><Pencil size={15} /> Editar días</button></div></div>
        <label className="grid gap-2 text-sm font-bold">Horario de atención<input className="field" value={businessHoursText} onChange={(event) => setBusinessHoursText(event.target.value)} placeholder="Lunes a viernes de 9 a 18 hs · Sábados de 9 a 13 hs" /></label>
        <div className={`grid gap-2 rounded-3xl border border-line p-4 ${restrictBySchedule ? "bg-white" : "bg-surface"}`}><p className="text-sm font-black">{restrictBySchedule ? "Horarios que bloquean la tienda" : "Restricción desactivada"}</p><p className="text-sm text-muted">{restrictBySchedule ? "La tienda permitirá pedidos solamente dentro de estos rangos." : "El texto manual se seguirá mostrando públicamente."}</p>{restrictBySchedule ? <div className="grid gap-2 sm:grid-cols-2">{businessDayKeys.map((day) => <div key={day} className="rounded-2xl border border-line bg-white p-3"><p className="font-black">{businessDayLabels[day]}</p><p className="mt-1 text-sm text-muted">{formatBusinessRanges(businessHours.days[day])}</p></div>)}</div> : null}</div>
      </section>

      <section className="panel grid gap-4 bg-[#f8fafc] p-5 sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Catálogo móvil</p>
          <h2 className="mt-1 text-2xl font-black">Vista en celulares</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Elegí cuántos productos se muestran por fila.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((columns) => (
            <button key={columns} className={`rounded-3xl border-2 bg-white p-4 text-left transition ${mobileProductColumns === columns ? "border-brand bg-green-50" : "border-line"}`} type="button" onClick={() => setMobileProductColumns(columns as 1 | 2)}>
              <p className="text-center text-xl font-black">{columns} {columns === 1 ? "columna" : "columnas"}</p>
              <div className="mx-auto mt-4 w-40 rounded-[30px] border-4 border-slate-200 bg-white p-3">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
                <div className={`grid ${columns === 2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
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

      {hoursModalOpen ? <div className="fixed inset-0 z-50 flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Editar horarios"><div className="panel grid h-[100dvh] min-h-[100dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden !rounded-none p-4 sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:!rounded-[24px] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p><h3 className="mt-1 text-2xl font-black">Editar atención</h3></div><button className="btn-secondary !h-10 !w-10 !p-0" type="button" onClick={() => setHoursModalOpen(false)}><X size={18} /></button></div><div className="grid gap-3 overflow-y-auto pb-6 pr-1">{businessDayKeys.map((day) => <article key={day} className="grid gap-3 rounded-2xl border border-line bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-black">{businessDayLabels[day]}</p><div className="flex flex-wrap gap-2">{businessHours.days[day].length ? <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => copyRangesToAllDays(day)}><Copy size={15} /> Copiar</button> : null}<button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => addRange(day)}><Plus size={15} /> Rango</button></div></div>{businessHours.days[day].length ? businessHours.days[day].map((range, index) => <div key={`${day}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2"><label className="grid gap-1 text-xs font-bold text-muted">Apertura<input className="field !px-2 !py-2 text-center" type="time" value={range.open} onChange={(event) => updateRange(day, index, { open: event.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-muted">Cierre<input className="field !px-2 !py-2 text-center" type="time" value={range.close} onChange={(event) => updateRange(day, index, { close: event.target.value })} /></label><button className="grid h-11 w-11 place-items-center rounded-xl border border-line text-red-600" type="button" onClick={() => removeRange(day, index)}><Trash2 size={15} /></button></div>) : <p className="rounded-xl bg-surface p-3 text-sm font-bold text-muted">Cerrado</p>}</article>)}</div><div className="-mx-4 -mb-4 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6"><button className="btn-primary w-full" type="button" onClick={() => setHoursModalOpen(false)}>Listo</button></div></div></div> : null}

      <div className="fixed inset-x-4 bottom-4 z-40 grid gap-2 lg:bottom-6 lg:left-[calc((100vw-min(1120px,calc(100vw-32px)))/2+284px)] lg:right-[calc((100vw-min(1120px,calc(100vw-32px)))/2)]">{error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-lg">{error}</p> : null}<button className="btn-primary w-full shadow-2xl shadow-green-900/20" disabled={loading}>{loading ? "Guardando..." : "Guardar configuración"}</button></div>
    </form>
  );
}
