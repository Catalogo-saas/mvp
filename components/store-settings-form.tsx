"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowDown, ArrowUp, Check, Copy, Download, ExternalLink, ImagePlus, Monitor, Pencil, Plus, Smartphone, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { getDefaultCategoryTitle, normalizeStoreTemplate, storeTemplateLabels, storeTemplates, templateOriginalColors, type StoreTemplate } from "@/lib/catalog";
import { mapWithConcurrency, uploadImageDirect, validateSelectedImage } from "@/lib/image-upload-client";
import type { ImageReference, ImageUploadScope } from "@/lib/image-upload-contract";
import {
  normalizePublicPageConfig,
  publicSectionLabels,
  type PublicPageConfig,
  type PublicSectionId
} from "@/lib/public-page-config";
import {
  businessDayKeys,
  businessDayLabels,
  emptyBusinessHours,
  formatArgentineLocalPhone,
  formatArgentineInteger,
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
  showFeatured: boolean;
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
  publicPageConfig: unknown;
};

type CategorySetting = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  _count: { products: number };
};

type ImageDraft = { id: string; url: string; file?: File };

const socialNetworkFields = [
  { key: "instagram", label: "Instagram", iconSrc: "/social/instagram.svg" },
  { key: "tiktok", label: "TikTok", iconSrc: "/social/tiktok.svg" },
  { key: "facebook", label: "Facebook", iconSrc: "/social/facebook.svg" }
] as const;

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
        aria-label={label}
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

function StorePreview({
  device,
  storeName,
  logoUrl,
  heroTitle,
  heroSubtitle,
  heroImage,
  primary,
  config
}: {
  device: "mobile" | "desktop";
  storeName: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage?: string;
  primary: string;
  config: PublicPageConfig;
}) {
  return (
    <div className={`mx-auto overflow-hidden border-[6px] border-slate-900 bg-white shadow-xl ${device === "mobile" ? "w-[250px] rounded-[32px]" : "w-full max-w-[680px] rounded-[20px]"}`}>
      {config.announcement.enabled && config.announcement.text ? <div className="truncate px-3 py-2 text-center text-[8px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: primary }}>{config.announcement.text}</div> : null}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-[9px] font-black">
          {logoUrl ? <img src={logoUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <i className="grid h-6 w-6 place-items-center rounded-full text-[8px] not-italic text-white" style={{ backgroundColor: primary }}>{storeName.slice(0, 1)}</i>}
          <span className="truncate">{storeName || "Mi tienda"}</span>
        </span>
        <span className="rounded-full bg-slate-900 px-2 py-1 text-[7px] font-black text-white">Carrito · 0</span>
      </div>
      <div className={`grid ${device === "desktop" ? "grid-cols-2" : "grid-cols-1"}`}>
        {heroImage ? <img src={heroImage} alt="" className={`w-full object-cover ${device === "mobile" ? "h-36" : "h-48"}`} /> : <div className="h-36 bg-slate-100" />}
        <div className="order-first p-4">
          <p className="text-[7px] font-black uppercase tracking-wider" style={{ color: primary }}>Nueva colección</p>
          <p className="mt-2 text-lg font-black leading-tight">{heroTitle || storeName || "Tu marca"}</p>
          <p className="mt-2 line-clamp-2 text-[8px] leading-4 text-slate-500">{heroSubtitle || "Una tienda propia, clara y lista para compartir."}</p>
          <span className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[7px] font-black text-white" style={{ backgroundColor: primary }}>Ver productos</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {Array.from({ length: 3 }).map((_, index) => <span key={index} className="block"><i className="block aspect-[4/5] bg-slate-100" /><b className="mt-1 block h-1.5 rounded bg-slate-800" /><i className="mt-1 block h-1 w-2/3 rounded bg-slate-200" /></span>)}
      </div>
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
  const [showFeatured, setShowFeatured] = useState(store.showFeatured);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(store.freeShippingEnabled);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(formatArgentineInteger(store.freeShippingThreshold || 35000));
  const [acceptTransferPayments, setAcceptTransferPayments] = useState(store.acceptTransferPayments);
  const [paymentAccountHolder, setPaymentAccountHolder] = useState(store.paymentAccountHolder ?? "");
  const [paymentProvider, setPaymentProvider] = useState(store.paymentProvider ?? "");
  const [paymentAlias, setPaymentAlias] = useState(store.paymentAlias ?? "");
  const [paymentCbu, setPaymentCbu] = useState(store.paymentCbu ?? "");
  const [businessHoursText, setBusinessHoursText] = useState(store.businessHoursText ?? "");
  const [restrictBySchedule, setRestrictBySchedule] = useState(store.restrictBySchedule);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(() => getBusinessHours(store.businessHours));
  const [mobileProductColumns, setMobileProductColumns] = useState<1 | 2>(() => getMobileColumnsValue(store.mobileProductColumns));
  const [template, setTemplate] = useState<StoreTemplate>(() => normalizeStoreTemplate(store.template));
  const [publicPageConfig, setPublicPageConfig] = useState<PublicPageConfig>(() => normalizePublicPageConfig(store.publicPageConfig));
  const [activeSection, setActiveSection] = useState<"brand" | "page" | "sales" | "hours">("brand");
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [categories, setCategories] = useState(initialCategories);
  const [categoryFiles, setCategoryFiles] = useState<Record<string, File>>({});
  const [categoryPreviews, setCategoryPreviews] = useState<Record<string, string>>({});
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [publicUrlCopied, setPublicUrlCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [formRevision, setFormRevision] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useLockBodyScroll(hoursModalOpen);

  const publicStoreUrl = `${getAppBaseUrl()}/${store.slug}`;
  const normalizedTemplate = normalizeStoreTemplate(template);
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
        showFeatured,
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
        template,
        publicPageConfig,
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
      publicPageConfig,
      paymentAccountHolder,
      paymentAlias,
      paymentCbu,
      paymentProvider,
      restrictBySchedule,
      selectedLogoFile,
      showCategories,
      showFeatured,
      storeName,
      template,
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
    const validationError = validateSelectedImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
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

  function downloadStoreQr() {
    const qr = document.getElementById("storefront-qr");
    if (!(qr instanceof SVGElement)) {
      setError("No se pudo preparar el QR.");
      return;
    }
    const source = new XMLSerializer().serializeToString(qr);
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `qr-${store.slug}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }

  function updatePageConfig(updater: (current: PublicPageConfig) => PublicPageConfig) {
    setPublicPageConfig((current) => updater(current));
    setFormRevision((current) => current + 1);
  }

  function movePublicSection(section: PublicSectionId, direction: -1 | 1) {
    updatePageConfig((current) => {
      const index = current.sections.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...current, sections };
    });
  }

  function togglePublicSectionVisibility(section: PublicSectionId) {
    if (section === "featured") {
      setShowFeatured((current) => !current);
      return;
    }
    if (section === "categories") {
      setShowCategories((current) => !current);
      return;
    }
    if (section === "info") {
      updatePageConfig((current) => ({ ...current, info: { ...current.info, enabled: !current.info.enabled } }));
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaveStatus("Optimizando imágenes...");

    const uploadTasks: Array<{ id: string; scope: ImageUploadScope; file: File }> = [];
    if (selectedLogoFile) uploadTasks.push({ id: "logo", scope: "logos", file: selectedLogoFile });
    heroImages.forEach((image) => {
      if (image.file) uploadTasks.push({ id: `hero:${image.id}`, scope: "hero", file: image.file });
    });
    Object.entries(categoryFiles).forEach(([categoryId, file]) => {
      uploadTasks.push({ id: `category:${categoryId}`, scope: "categories", file });
    });

    const uploadedReferences = new Map<string, ImageReference>();
    let completedUploads = 0;
    try {
      const results = await mapWithConcurrency(uploadTasks, 3, async (task) => {
        const reference = await uploadImageDirect(task.scope, task.file);
        completedUploads += 1;
        setSaveStatus(`Subiendo imágenes ${completedUploads}/${uploadTasks.length}...`);
        return { id: task.id, reference };
      });
      results.forEach(({ id, reference }) => uploadedReferences.set(id, reference));
    } catch (uploadError) {
      setLoading(false);
      setSaveStatus("");
      setError(uploadError instanceof Error ? uploadError.message : "No se pudieron subir las imágenes.");
      return;
    }

    const logo: ImageReference | null = selectedLogoFile
      ? uploadedReferences.get("logo") ?? null
      : logoUrl
        ? { kind: "stored", url: logoUrl }
        : null;
    const heroImageReferences = heroImages.map((image) =>
      image.file
        ? uploadedReferences.get(`hero:${image.id}`)!
        : ({ kind: "stored", url: image.url } as const)
    );
    const categoryImages = Object.keys(categoryFiles).map((categoryId) => ({
      categoryId,
      image: uploadedReferences.get(`category:${categoryId}`)!
    }));

    setSaveStatus("Guardando configuración...");
    const payload = {
      name: storeName,
      description,
      address,
      whatsappPhone: whatsappLocal,
      heroTitle,
      heroSubtitle,
      logo,
      heroImages: heroImageReferences,
      categoryImages,
      primary,
      accent,
      useTemplateColors,
      template,
      publicPageConfig,
      showCategories,
      showFeatured,
      freeShippingEnabled,
      freeShippingThreshold: digitsOnly(freeShippingThreshold) || "0",
      acceptTransferPayments,
      paymentAccountHolder,
      paymentProvider,
      paymentAlias,
      paymentCbu,
      businessHoursText,
      restrictBySchedule,
      businessHours,
      mobileProductColumns
    };

    const response = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    setSaveStatus("");
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
    setPublicPageConfig(normalizePublicPageConfig(data.store.publicPageConfig));
    resetDirtyBaselineRef.current = true;
    setFormRevision((current) => current + 1);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={() => setFormRevision((current) => current + 1)} className="grid gap-5 pb-28">
      <nav className="panel sticky top-4 z-30 grid grid-cols-4 gap-1 p-1.5" aria-label="Secciones de configuración">
        {([
          ["brand", "Marca"],
          ["page", "Página"],
          ["sales", "Venta"],
          ["hours", "Horario"]
        ] as const).map(([value, label]) => (
          <button key={value} className={`rounded-2xl px-2 py-3 text-xs font-black sm:text-sm ${activeSection === value ? "bg-brand text-white" : "text-muted hover:bg-surface"}`} type="button" onClick={() => setActiveSection(value)}>{label}</button>
        ))}
      </nav>

      <section className={`${activeSection === "brand" ? "grid" : "hidden"} panel gap-5 bg-[#fff8fb] p-5 sm:p-6`}>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Identidad</p>
          <h2 className="mt-1 text-2xl font-black">Así se ve tu marca</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-3 self-start">
            <LogoPreview logoUrl={visibleLogoUrl} storeName={storeName} pending={Boolean(selectedLogoFile)} />
            <label className="btn-secondary h-12 w-full !py-0">
              <ImagePlus size={17} /> {visibleLogoUrl ? "Cambiar logo" : "Subir logo"}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                const validationError = file ? validateSelectedImage(file) : null;
                if (validationError) {
                  setError(validationError);
                  return;
                }
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
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 sm:col-span-2"><QRCodeSVG id="storefront-qr" value={publicStoreUrl} size={88} level="M" /><div><p className="font-black">Compartí tu catálogo</p><p className="mt-1 text-sm font-semibold text-muted">Usalo en mostrador, packaging y redes.</p><div className="mt-2 flex flex-wrap gap-3"><button className="inline-flex items-center gap-1 text-sm font-black text-brand" type="button" onClick={downloadStoreQr}><Download size={15} /> Descargar QR</button><button className="text-sm font-black text-brand" type="button" onClick={() => void copyPublicStoreUrl()}>Copiar enlace</button></div></div></div>
            {originalColors ? <div className="grid gap-3 rounded-3xl border border-line bg-white p-4 sm:col-span-2"><Switch checked={useTemplateColors} onChange={setUseTemplateColors} label="Usar colores originales de la plantilla" description={`Aplica la paleta original de ${storeTemplateLabels[normalizedTemplate]} sin borrar tus colores personalizados.`} />{useTemplateColors ? <div className="flex flex-wrap gap-3 text-xs font-bold text-muted"><span className="flex items-center gap-2"><i className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: originalColors.primary }} />Principal · {originalColors.primary}</span><span className="flex items-center gap-2"><i className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: originalColors.accent }} />Secundario · {originalColors.accent}</span></div> : null}</div> : null}
            <label className="grid gap-2 text-sm font-bold">Color principal<input className="field h-14 disabled:cursor-not-allowed disabled:opacity-45" name="primary" type="color" value={primary} disabled={Boolean(originalColors && useTemplateColors)} onChange={(event) => setPrimary(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-bold">Color secundario<input className="field h-14 disabled:cursor-not-allowed disabled:opacity-45" name="accent" type="color" value={accent} disabled={Boolean(originalColors && useTemplateColors)} onChange={(event) => setAccent(event.target.value)} /></label>
          </div>
        </div>
        <label className="grid gap-2 text-sm font-bold"><span>WhatsApp de pedidos</span><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black">+54</span><input className="field !pl-[3.25rem]" inputMode="numeric" maxLength={12} value={whatsappLocal} onChange={(event) => setWhatsappLocal(formatArgentineLocalPhone(event.target.value))} onBlur={() => setWhatsappLocal(formatArgentineLocalPhone(whatsappLocal))} required /></div></label>
      </section>

      <section className={`${activeSection === "page" ? "grid" : "hidden"} panel gap-5 bg-[#f8f5ff] p-5 sm:p-6`}>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Página pública</p>
          <h2 className="mt-1 text-2xl font-black">Tu portada y catálogo</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Elegí un estilo y completá solamente las secciones que ayuden a vender con claridad.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid content-start gap-4">
            <label className="grid gap-2 text-sm font-bold">Estilo visual
              <select className="field" value={template} onChange={(event) => setTemplate(event.target.value as StoreTemplate)}>
                <optgroup label="Versátil"><option value="ecommerce">Ecommerce</option></optgroup>
                <optgroup label="Moda y belleza"><option value="premium-minimal">Minimal</option><option value="boutique-soft">Boutique</option><option value="beauty-pop">Colorida</option></optgroup>
                <optgroup label="Infantil">{storeTemplates.filter((value) => value.startsWith("baby-")).map((value) => <option key={value} value={value}>{storeTemplateLabels[value]}</option>)}</optgroup>
                <optgroup label="Otros"><option value="food">Comida</option></optgroup>
              </select>
            </label>
          </div>
          <div className="rounded-3xl border border-line bg-[#e8efec] p-4">
            <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-black">Vista previa</p><div className="flex rounded-full bg-white p-1"><button className={`rounded-full p-2 ${previewDevice === "mobile" ? "bg-ink text-white" : "text-muted"}`} type="button" onClick={() => setPreviewDevice("mobile")} aria-label="Vista móvil"><Smartphone size={15} /></button><button className={`rounded-full p-2 ${previewDevice === "desktop" ? "bg-ink text-white" : "text-muted"}`} type="button" onClick={() => setPreviewDevice("desktop")} aria-label="Vista de escritorio"><Monitor size={15} /></button></div></div>
            <StorePreview device={previewDevice} storeName={storeName} logoUrl={visibleLogoUrl} heroTitle={heroTitle} heroSubtitle={heroSubtitle} heroImage={heroImages[0]?.url} primary={originalColors && useTemplateColors ? originalColors.primary : primary} config={publicPageConfig} />
            <a className="mt-4 flex items-center justify-center gap-2 text-sm font-black text-brand" href={publicStoreUrl} target="_blank" rel="noreferrer">Abrir tienda actual <ExternalLink size={15} /></a>
          </div>
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
                    <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => replaceHeroImage(index, event.currentTarget.files?.[0])} />
                  </label>
                </div>
              );
            })}
          </div>
          {heroFileCount ? <p className="text-xs font-bold text-muted">{heroFileCount} imagen(es) nuevas pendientes de guardar.</p> : null}
        </div>
        <Switch checked={showCategories} onChange={setShowCategories} label="Mostrar categorías" description="Muestra accesos rápidos a las categorías en la tienda pública." />
        {showCategories ? <>
          <label className="grid gap-2 text-sm font-bold">Título de la sección de categorías<input className="field" value={publicPageConfig.categoriesTitle} onChange={(event) => updatePageConfig((current) => ({ ...current, categoriesTitle: event.target.value }))} placeholder={getDefaultCategoryTitle(template)} /><span className="text-xs font-semibold text-muted">Si lo dejás vacío, se usa “{getDefaultCategoryTitle(template)}”.</span></label>
          <div className="grid gap-3 rounded-3xl border border-line bg-white p-4">
            <div><p className="font-black">Imágenes de categorías</p><p className="mt-1 text-sm font-semibold text-muted">Personalizá las tarjetas de categorías de tu ecommerce.</p></div>
            {categories.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">{categories.map((category) => {
              const preview = categoryPreviews[category.id] || category.imageUrl;
              return <article key={category.id} className="grid min-w-0 gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[90px_1fr] sm:items-center"><div className="aspect-square min-w-0 overflow-hidden rounded-xl bg-surface">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-xs font-bold text-muted">Sin imagen</div>}</div><div className="min-w-0"><p className="truncate font-black">{category.name}</p><p className="truncate text-sm text-muted">{category._count.products} producto(s)</p><label className="btn-secondary mt-2 w-full !px-2 !py-2 text-sm"><ImagePlus size={15} /> Agregar<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; const validationError = validateSelectedImage(file); if (validationError) { setError(validationError); return; } if (categoryPreviews[category.id]) URL.revokeObjectURL(categoryPreviews[category.id]); setCategoryFiles((current) => ({ ...current, [category.id]: file })); setCategoryPreviews((current) => ({ ...current, [category.id]: URL.createObjectURL(file) })); setError(""); }} /></label></div></article>;
            })}</div> : <p className="rounded-2xl bg-surface p-4 text-sm font-bold text-muted">Creá categorías desde Productos para poder personalizarlas.</p>}
          </div>
        </> : null}
        <Switch checked={showFeatured} onChange={setShowFeatured} label="Productos destacados" description="Muestra una selección especial de productos en la tienda pública." />
        {showFeatured ? <label className="grid gap-2 text-sm font-bold">Título de productos destacados<input className="field" value={publicPageConfig.featuredTitle} onChange={(event) => updatePageConfig((current) => ({ ...current, featuredTitle: event.target.value }))} /></label> : null}
        <section className="grid gap-4 rounded-3xl border border-line bg-white p-4">
          <div><p className="font-black">Orden de las secciones</p><p className="mt-1 text-sm font-semibold text-muted">Elegí qué aparece primero entre destacados, categorías, productos e información útil.</p></div>
          <div className="grid gap-2">
            {publicPageConfig.sections.map((section, index, sections) => {
              const enabled = section === "featured" ? showFeatured : section === "categories" ? showCategories : section === "info" ? publicPageConfig.info.enabled : true;
              const hasVisibilityToggle = section === "featured" || section === "categories" || section === "info";
              return <div key={section} className="flex items-center gap-3 rounded-2xl border border-line p-3"><span className="min-w-0 flex-1 text-sm font-black">{publicSectionLabels[section]}</span>{hasVisibilityToggle ? <button className={`rounded-full px-3 py-1.5 text-xs font-black ${enabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`} type="button" onClick={() => togglePublicSectionVisibility(section)}>{enabled ? "Visible" : "Oculta"}</button> : null}<button className="rounded-xl border border-line p-2 disabled:opacity-30" type="button" disabled={index === 0} onClick={() => movePublicSection(section, -1)} aria-label={`Subir ${publicSectionLabels[section]}`}><ArrowUp size={14} /></button><button className="rounded-xl border border-line p-2 disabled:opacity-30" type="button" disabled={index === sections.length - 1} onClick={() => movePublicSection(section, 1)} aria-label={`Bajar ${publicSectionLabels[section]}`}><ArrowDown size={14} /></button></div>;
            })}
          </div>
        </section>
        <section className="grid gap-4 rounded-3xl border border-line bg-white p-4">
          <Switch checked={publicPageConfig.announcement.enabled} onChange={(enabled) => updatePageConfig((current) => ({ ...current, announcement: { ...current.announcement, enabled } }))} label="Barra de anuncio" description="Mostrá una novedad breve arriba de la tienda." />
          {publicPageConfig.announcement.enabled ? <label className="grid gap-2 text-sm font-bold">Mensaje<input className="field" value={publicPageConfig.announcement.text} maxLength={120} onChange={(event) => updatePageConfig((current) => ({ ...current, announcement: { ...current.announcement, text: event.target.value } }))} placeholder="Nueva colección disponible" /></label> : null}
        </section>
        <section className="grid gap-4 rounded-3xl border border-line bg-white p-4">
          <Switch checked={publicPageConfig.info.enabled} onChange={(enabled) => updatePageConfig((current) => ({ ...current, info: { ...current.info, enabled } }))} label="Información para comprar con confianza" description="Respondé dudas frecuentes sin sumar pasos al checkout." />
          {publicPageConfig.info.enabled ? <div className="grid gap-4"><label className="grid gap-2 text-sm font-bold">Envíos<textarea className="field min-h-20" value={publicPageConfig.info.shipping} onChange={(event) => updatePageConfig((current) => ({ ...current, info: { ...current.info, shipping: event.target.value } }))} /></label><label className="grid gap-2 text-sm font-bold">Cambios y devoluciones<textarea className="field min-h-20" value={publicPageConfig.info.returns} onChange={(event) => updatePageConfig((current) => ({ ...current, info: { ...current.info, returns: event.target.value } }))} /></label><label className="grid gap-2 text-sm font-bold">Guía de talles general<textarea className="field min-h-20" value={publicPageConfig.info.sizeGuide} onChange={(event) => updatePageConfig((current) => ({ ...current, info: { ...current.info, sizeGuide: event.target.value } }))} /></label></div> : null}
        </section>
        <section className="grid gap-4 rounded-3xl border border-line bg-white p-4">
          <div><p className="font-black">Redes sociales</p><p className="mt-1 text-sm font-semibold text-muted">Pegá enlaces completos; se mostrarán en el pie de página.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">{socialNetworkFields.map(({ key, label, iconSrc }) => <label key={key} className="grid gap-2 text-sm font-bold"><span className="flex items-center gap-2"><img src={iconSrc} alt="" aria-hidden="true" className="h-5 w-5 shrink-0" />{label}</span><input className="field" type="url" value={publicPageConfig.socials[key]} onChange={(event) => updatePageConfig((current) => ({ ...current, socials: { ...current.socials, [key]: event.target.value } }))} placeholder={`https://${key}.com/...`} /></label>)}</div>
        </section>
      </section>

      <section className={`${activeSection === "sales" ? "grid" : "hidden"} panel gap-4 p-5 sm:p-6`}>
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Envíos</p><h2 className="mt-1 text-2xl font-black">Envío gratis</h2></div>
        <Switch checked={freeShippingEnabled} onChange={setFreeShippingEnabled} label="Ofrecer envío gratis" description="Muestra el progreso hacia el envío gratis en el carrito." />
        {freeShippingEnabled ? <label className="grid gap-2 text-sm font-bold">Monto mínimo<input className="field" inputMode="numeric" value={freeShippingThreshold} onChange={(event) => setFreeShippingThreshold(formatArgentineInteger(event.target.value))} placeholder="35.000" /></label> : null}
      </section>

      <section className={`${activeSection === "sales" ? "grid" : "hidden"} panel gap-4 p-5 sm:p-6`}>
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Pagos</p><h2 className="mt-1 text-2xl font-black">Transferencias</h2></div>
        <Switch checked={acceptTransferPayments} onChange={setAcceptTransferPayments} label="Aceptar pagos por transferencia" description="Al activarlo, también se mostrará como opción en el checkout público." />
        {acceptTransferPayments ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Titular<input className="field" value={paymentAccountHolder} onChange={(event) => setPaymentAccountHolder(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Banco o billetera<input className="field" value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Alias<input className="field" value={paymentAlias} onChange={(event) => setPaymentAlias(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">CBU / CVU<input className="field" inputMode="numeric" value={paymentCbu} onChange={(event) => setPaymentCbu(event.target.value)} /></label></div> : null}
      </section>

      <section className={`${activeSection === "hours" ? "grid" : "hidden"} panel gap-4 p-5 sm:p-6`}>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Horario</p><h2 className="mt-1 text-2xl font-black">Atención</h2></div><div className="flex flex-wrap gap-3"><Switch checked={restrictBySchedule} onChange={setRestrictBySchedule} label="Restringir tienda por horario" /><button className="btn-secondary !px-4 !py-2 text-sm" type="button" onClick={() => setHoursModalOpen(true)}><Pencil size={15} /> Editar días</button></div></div>
        <label className="grid gap-2 text-sm font-bold">Horario de atención<input className="field" value={businessHoursText} onChange={(event) => setBusinessHoursText(event.target.value)} placeholder="Lunes a viernes de 9 a 18 hs · Sábados de 9 a 13 hs" /></label>
        <div className={`grid gap-2 rounded-3xl border border-line p-4 ${restrictBySchedule ? "bg-white" : "bg-surface"}`}><p className="text-sm font-black">{restrictBySchedule ? "Horarios que bloquean la tienda" : "Restricción desactivada"}</p><p className="text-sm text-muted">{restrictBySchedule ? "La tienda permitirá pedidos solamente dentro de estos rangos." : "El texto manual se seguirá mostrando públicamente."}</p>{restrictBySchedule ? <div className="grid gap-2 sm:grid-cols-2">{businessDayKeys.map((day) => <div key={day} className="rounded-2xl border border-line bg-white p-3"><p className="font-black">{businessDayLabels[day]}</p><p className="mt-1 text-sm text-muted">{formatBusinessRanges(businessHours.days[day])}</p></div>)}</div> : null}</div>
      </section>

      <section className={`${activeSection === "page" ? "grid" : "hidden"} panel gap-4 bg-[#f8fafc] p-5 sm:p-6`}>
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

      <div className="fixed inset-x-4 bottom-4 z-40 grid gap-2 lg:bottom-6 lg:left-[calc((100vw-min(1120px,calc(100vw-32px)))/2+284px)] lg:right-[calc((100vw-min(1120px,calc(100vw-32px)))/2)]">{error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-lg">{error}</p> : null}<button className="btn-primary w-full shadow-2xl shadow-green-900/20" disabled={loading}>{loading ? saveStatus || "Guardando..." : "Guardar configuración"}</button></div>
    </form>
  );
}
