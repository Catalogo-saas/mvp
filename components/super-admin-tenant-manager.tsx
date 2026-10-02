"use client";

import { signOut } from "next-auth/react";
import { Building2, ExternalLink, LogOut, Pencil, Plus, Search, ShieldCheck, Store, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { publicStoreTemplates, storeTemplateLabels, type StoreTemplate } from "@/lib/catalog";
const storeTemplates = publicStoreTemplates;
import { formatArgentineLocalPhone } from "@/lib/store-settings";
import type { TenantSummary } from "@/lib/tenant-admin";
import { notifyError, notifySuccess } from "@/lib/internal-notifications";

type FormState = {
  ownerName: string;
  email: string;
  password: string;
  storeName: string;
  slug: string;
  whatsappPhone: string;
  businessType: "FOOD" | "RETAIL" | "SERVICES" | "MIXED";
  template: StoreTemplate;
  status: "ACTIVE" | "SUSPENDED";
  isPublished: boolean;
};

const businessLabels = { FOOD: "Comida", RETAIL: "Retail", SERVICES: "Servicios", MIXED: "Multirubro" } as const;
const emptyForm: FormState = {
  ownerName: "",
  email: "",
  password: "",
  storeName: "",
  slug: "",
  whatsappPhone: "",
  businessType: "MIXED",
  template: "roma",
  status: "ACTIVE",
  isPublished: false
};

function tenantForm(tenant: TenantSummary): FormState {
  return {
    ownerName: tenant.ownerName,
    email: tenant.email,
    password: "",
    storeName: tenant.storeName,
    slug: tenant.slug,
    whatsappPhone: formatArgentineLocalPhone(tenant.whatsappPhone),
    businessType: tenant.businessType,
    template: tenant.template,
    status: tenant.status,
    isPublished: tenant.isPublished
  };
}

export function SuperAdminTenantManager({ initialTenants }: { initialTenants: TenantSummary[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [editing, setEditing] = useState<TenantSummary | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantSummary | null>(null);
  const [confirmationSlug, setConfirmationSlug] = useState("");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  useLockBodyScroll(modalOpen);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  const filtered = useMemo(() => tenants.filter((tenant) => {
    const text = `${tenant.storeName} ${tenant.ownerName} ${tenant.email} ${tenant.slug}`.toLowerCase();
    return text.includes(query.trim().toLowerCase())
      && (statusFilter === "all" || tenant.status === statusFilter)
      && (businessFilter === "all" || tenant.businessType === businessFilter)
      && (templateFilter === "all" || tenant.template === templateFilter);
  }), [tenants, query, statusFilter, businessFilter, templateFilter]);

  const activeCount = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const publishedCount = tenants.filter((tenant) => tenant.status === "ACTIVE" && tenant.isPublished).length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(tenant: TenantSummary) {
    setEditing(tenant);
    setForm(tenantForm(tenant));
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  }

  async function saveTenant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/superadmin/tenants/${editing.id}` : "/api/superadmin/tenants", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, template: publicStoreTemplates.includes(form.template as (typeof publicStoreTemplates)[number]) ? form.template : "roma", isPublished: editing ? form.isPublished : false })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.tenant) {
        notifyError(data?.error ?? "No se pudo guardar el tenant.");
        return;
      }
      setTenants((current) => editing
        ? current.map((tenant) => tenant.id === data.tenant.id ? data.tenant : tenant)
        : [data.tenant, ...current]);
      setModalOpen(false);
      setEditing(null);
      notifySuccess(editing ? "Tenant actualizado." : "Tenant creado.");
    } catch {
      notifyError("No hay conexión. No se pudo guardar el tenant.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTenantStatus(tenant: TenantSummary) {
    const nextStatus = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setBusyId(tenant.id);
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tenantForm(tenant), status: nextStatus })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.tenant) {
        notifyError(data?.error ?? "No se pudo cambiar el estado.");
        return;
      }
      setTenants((current) => current.map((item) => item.id === tenant.id ? data.tenant : item));
      notifySuccess(nextStatus === "ACTIVE" ? "Tenant activado." : "Tenant dado de baja.");
    } catch {
      notifyError("No hay conexión. No se pudo cambiar el estado.");
    } finally {
      setBusyId(null);
    }
  }

  function requestDeleteTenant(tenant: TenantSummary) {
    setConfirmationSlug("");
    setDeleteTarget(tenant);
  }

  async function deleteTenant(tenant: TenantSummary, confirmation: string) {
    setBusyId(tenant.id);
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        notifyError(data?.error ?? "No se pudo borrar el tenant.");
        return;
      }
      setTenants((current) => current.filter((item) => item.id !== tenant.id));
      setDeleteTarget(null);
      setConfirmationSlug("");
      notifySuccess("Tenant eliminado.");
    } catch {
      notifyError("No hay conexión. No se pudo borrar el tenant.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container-page min-h-screen py-6 md:py-10">
      <header className="panel flex flex-wrap items-center justify-between gap-4 p-5 md:p-7">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><ShieldCheck /></span>
          <div><p className="text-sm font-black uppercase tracking-[0.18em] text-brand">Administración maestra</p><h1 className="text-2xl font-black md:text-3xl">Tenants</h1></div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" type="button" onClick={openCreate}><Plus size={18} /> Nuevo tenant</button>
          <button className="btn-secondary !px-4" type="button" onClick={() => void signOut({ callbackUrl: "/" })} aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <article className="panel p-5"><p className="text-sm font-bold text-muted">Tenants totales</p><p className="mt-2 text-3xl font-black">{tenants.length}</p></article>
        <article className="panel p-5"><p className="text-sm font-bold text-muted">Cuentas activas</p><p className="mt-2 text-3xl font-black">{activeCount}</p></article>
        <article className="panel p-5"><p className="text-sm font-bold text-muted">Tiendas visibles</p><p className="mt-2 text-3xl font-black">{publishedCount}</p></article>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_repeat(3,180px)]">
          <label className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} /><input className="field !pl-11" placeholder="Buscar tienda, titular o email" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option><option value="ACTIVE">Activos</option><option value="SUSPENDED">Dados de baja</option></select>
          <select className="field" value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}><option value="all">Todos los rubros</option>{Object.entries(businessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select className="field" value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}><option value="all">Todas las plantillas</option>{storeTemplates.map((template) => <option key={template} value={template}>{storeTemplateLabels[template]}</option>)}</select>
        </div>
        <div className="grid gap-3 bg-surface p-3">
          {filtered.length ? filtered.map((tenant) => (
            <article key={tenant.id} className="grid gap-4 rounded-3xl border border-line bg-white p-5 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(130px,.55fr))_auto] lg:items-center">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-black">{tenant.storeName}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-black ${tenant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{tenant.status === "ACTIVE" ? "Activo" : "De baja"}</span>{!tenant.isPublished ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">No publicada</span> : null}</div><p className="mt-1 truncate text-sm font-semibold text-muted">{tenant.ownerName} · {tenant.email}</p><p className="mt-1 text-sm text-muted">/{tenant.slug}</p></div>
              <div><p className="text-xs font-black uppercase tracking-wider text-muted">Rubro</p><p className="mt-1 font-bold">{businessLabels[tenant.businessType]}</p></div>
              <div><p className="text-xs font-black uppercase tracking-wider text-muted">Plantilla</p><p className="mt-1 font-bold">{storeTemplateLabels[tenant.template]}</p></div>
              <div><p className="text-xs font-black uppercase tracking-wider text-muted">Actividad</p><p className="mt-1 font-bold">{tenant.productsCount} prod. · {tenant.ordersCount} ped.</p></div>
              <div className="flex flex-wrap gap-2 lg:justify-end">{tenant.status === "ACTIVE" && tenant.isPublished ? <a className="grid h-10 w-10 place-items-center rounded-xl border border-line" href={`/${tenant.slug}`} target="_blank" rel="noreferrer" aria-label="Ver tienda"><ExternalLink size={16} /></a> : null}<button className="grid h-10 w-10 place-items-center rounded-xl border border-line" type="button" onClick={() => openEdit(tenant)} aria-label="Editar tenant"><Pencil size={16} /></button><button className="rounded-xl border border-line px-3 text-sm font-black" type="button" disabled={busyId === tenant.id} onClick={() => void toggleTenantStatus(tenant)}>{tenant.status === "ACTIVE" ? "Dar de baja" : "Reactivar"}</button><button className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 text-red-600" type="button" disabled={busyId === tenant.id} onClick={() => requestDeleteTenant(tenant)} aria-label="Borrar tenant"><Trash2 size={16} /></button></div>
            </article>
          )) : <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-muted"><Building2 className="mx-auto mb-3" />No hay tenants para estos filtros.</div>}
        </div>
      </section>

      {modalOpen ? <div className="fixed inset-0 z-[100] flex items-end bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={editing ? "Editar tenant" : "Crear tenant"}><form className="grid max-h-[96dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6" onSubmit={saveTenant}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.18em] text-brand">Tenant</p><h2 className="mt-1 text-2xl font-black">{editing ? "Editar cuenta y tienda" : "Crear cuenta y tienda"}</h2></div><button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={closeModal} aria-label="Cerrar"><X size={19} /></button></div><div className="grid gap-4 overflow-y-auto pr-1 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Titular<input className="field" required value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></label><label className="grid gap-2 text-sm font-bold">Email<input className="field" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="grid gap-2 text-sm font-bold sm:col-span-2">{editing ? "Nueva contraseña (opcional)" : "Contraseña definitiva"}<input className="field" type="password" minLength={8} required={!editing} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo 8 caracteres" /></label><label className="grid gap-2 text-sm font-bold">Nombre de la tienda<input className="field" required value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label><label className="grid gap-2 text-sm font-bold">URL pública<input className="field" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="mi-tienda" /></label><label className="grid gap-2 text-sm font-bold">WhatsApp<input className="field" required value={form.whatsappPhone} onChange={(event) => setForm({ ...form, whatsappPhone: formatArgentineLocalPhone(event.target.value) })} placeholder="11 2345-6789" /></label><label className="grid gap-2 text-sm font-bold">Rubro<select className="field" value={form.businessType} onChange={(event) => setForm({ ...form, businessType: event.target.value as FormState["businessType"] })}>{Object.entries(businessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-2 text-sm font-bold">Plantilla<select className="field" value={form.template} onChange={(event) => setForm({ ...form, template: event.target.value as FormState["template"] })}>{storeTemplates.map((template) => <option key={template} value={template}>{storeTemplateLabels[template]}</option>)}</select></label><label className="grid gap-2 text-sm font-bold">Estado<select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FormState["status"] })}><option value="ACTIVE">Activo</option><option value="SUSPENDED">Dado de baja</option></select></label><label className="flex items-center gap-3 rounded-2xl border border-line p-4 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /> Publicar la tienda</label></div><div className="-mx-5 -mb-5 grid gap-2 border-t border-line bg-white px-5 pb-5 pt-4 sm:-mx-6 sm:-mb-6 sm:grid-cols-2 sm:px-6 sm:pb-6"><button className="btn-secondary" type="button" onClick={closeModal}>Cancelar</button><button className="btn-primary" type="submit" disabled={saving}><Store size={18} />{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear tenant"}</button></div></form></div> : null}
      <dialog ref={deleteDialogRef} className="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none rounded-3xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50" onCancel={(event) => { event.preventDefault(); setDeleteTarget(null); setConfirmationSlug(""); }} aria-labelledby="tenant-delete-title" aria-describedby="tenant-delete-description">
        {deleteTarget && <form className="grid gap-5 p-6" onSubmit={(event) => { event.preventDefault(); if (confirmationSlug === deleteTarget.slug) void deleteTenant(deleteTarget, confirmationSlug); }}>
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Acción irreversible</p><h2 id="tenant-delete-title" className="mt-2 text-xl font-black">Eliminar {deleteTarget.storeName}</h2><p id="tenant-delete-description" className="mt-2 text-sm text-muted">Se eliminarán todos los datos de esta tienda. Escribí <strong>{deleteTarget.slug}</strong> para confirmar.</p></div>
          <label className="grid gap-2 text-sm font-bold">Slug de la tienda<input className="field" autoFocus autoComplete="off" value={confirmationSlug} onChange={(event) => setConfirmationSlug(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2"><button className="btn-secondary" type="button" disabled={busyId === deleteTarget.id} onClick={() => { setDeleteTarget(null); setConfirmationSlug(""); }}>Cancelar</button><button className="btn-primary bg-red-700 hover:bg-red-800" type="submit" disabled={busyId === deleteTarget.id || confirmationSlug !== deleteTarget.slug}>{busyId === deleteTarget.id ? "Eliminando…" : "Eliminar tenant"}</button></div>
        </form>}
      </dialog>
    </main>
  );
}
