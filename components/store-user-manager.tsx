"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Pencil, Plus, Search, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { AdminDialog, AdminNotice, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { AdminActionMenu } from "@/components/admin-action-menu";
import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { notifySuccess } from "@/lib/internal-notifications";
import type { StoreUserList } from "@/lib/store-team";

type Member = StoreUserList["users"][number];
type FormState = { name: string; email: string; password: string; role: "ADMIN" | "OPERATOR"; status: "ACTIVE" | "SUSPENDED" };
const emptyForm: FormState = { name: "", email: "", password: "", role: "OPERATOR", status: "ACTIVE" };
const roleLabels = { ADMIN: "Administrador", OPERATOR: "Operador" };

export function StoreUserManager({ initialData, initialFilters }: { initialData: StoreUserList; initialFilters: { q?: string; role?: string; status?: string } }) {
  const router = useRouter();
  const { confirmNavigation } = useUnsavedChanges();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(initialFilters.q ?? "");
  const [q, setQ] = useState(search);
  const [role, setRole] = useState(["ADMIN", "OPERATOR"].includes(initialFilters.role ?? "") ? initialFilters.role! : "all");
  const [status, setStatus] = useState(["ACTIVE", "SUSPENDED"].includes(initialFilters.status ?? "") ? initialFilters.status! : "all");
  const [page, setPage] = useState(initialData.page);
  const [pageSize, setPageSize] = useState(initialData.pageSize);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baseline, setBaseline] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [suspending, setSuspending] = useState<Member | null>(null);
  const [confirmSaveSuspension, setConfirmSaveSuspension] = useState(false);
  useDirtyForm(open && JSON.stringify(form) !== JSON.stringify(baseline));

  useEffect(() => {
    const timer = setTimeout(() => { if (search !== q) { setQ(search); setPage(1); } }, 250);
    return () => clearTimeout(timer);
  }, [search, q]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ q, role, status, page: String(page), pageSize: String(pageSize) });
        const response = await fetch(`/api/admin/users?${params}`, { signal: controller.signal });
        if (response.status === 401 || response.status === 403) router.refresh();
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No pudimos cargar el equipo.");
        if (!controller.signal.aborted) { setData(body); setPage(body.page); }
      } catch (failure) {
        if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : "No pudimos cargar el equipo. Intentá nuevamente.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [q, role, status, page, pageSize, refresh, router]);

  function edit(member: Member | null) {
    const next: FormState = member ? { name: member.name ?? "", email: member.email, password: "", role: member.role, status: member.status } : { ...emptyForm };
    setEditing(member); setForm(next); setBaseline(next); setError(""); setFields({}); setOpen(true);
  }
  async function close() {
    if (!saving && await confirmNavigation()) setOpen(false);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing?.status === "ACTIVE" && form.status === "SUSPENDED") { setConfirmSaveSuspension(true); return; }
    await saveUser();
  }
  async function saveUser() {
    setSaving(true); setError(""); setFields({});
    try {
      const { status: nextStatus, ...createData } = form;
      const response = await fetch(editing ? `/api/admin/users/${editing.id}` : "/api/admin/users", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...createData, status: nextStatus } : createData)
      });
      const body = await response.json();
      if (!response.ok) { setFields(body.fields ?? {}); throw new Error(body.error ?? "No pudimos guardar el usuario."); }
      setConfirmSaveSuspension(false); setOpen(false); setRefresh(value => value + 1);
      notifySuccess(editing ? "Usuario actualizado." : "Usuario creado. Ya puede ingresar con su email y contraseña.");
    } catch (failure) { setConfirmSaveSuspension(false); setError(failure instanceof Error ? failure.message : "No pudimos guardar el usuario. Intentá nuevamente."); }
    finally { setSaving(false); }
  }
  async function changeStatus(member: Member) {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No pudimos cambiar el estado.");
      setSuspending(null); setRefresh(value => value + 1);
      notifySuccess(member.status === "ACTIVE" ? "Acceso suspendido." : "Usuario reactivado.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos cambiar el estado. Intentá nuevamente."); }
    finally { setSaving(false); }
  }
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setFields(current => ({ ...current, [key]: [] }));
  }

  return <div className="store-users space-y-6">
    <AdminPageHeader title="Usuarios" description="Organizá tu equipo y administrá sus accesos." action={<button className="btn-primary" onClick={() => edit(null)}><Plus size={18} />Nuevo usuario</button>} />
    <section className="users-owner" aria-label="Titular de la tienda">
      <span className="users-owner-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
      <div><h2>{data.owner.name || "Titular de la tienda"}</h2><p>{data.owner.email}</p></div>
      <span className="users-protected"><LockKeyhole size={14} aria-hidden="true" />Titular · Cuenta protegida</span>
    </section>
    <section className="users-directory" aria-label="Equipo de la tienda" aria-busy={loading}>
      <div className="users-toolbar">
        <label className="users-search"><span>Buscar usuarios</span><div><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></div></label>
        <label>Rol<select className="field" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}><option value="all">Todos los roles</option><option value="ADMIN">Administrador</option><option value="OPERATOR">Operador</option></select></label>
        <label>Estado<select className="field" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">Todos los estados</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option></select></label>
      </div>
      <div className="users-load-state" role="status">{loading ? "Cargando usuarios…" : `${data.total} ${data.total === 1 ? "usuario en el equipo" : "usuarios en el equipo"}`}</div>
      {loadError ? <div className="users-feedback"><AdminNotice error>{loadError}</AdminNotice><button className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Reintentar</button></div> : <>
        {data.users.length ? <div className="users-table-wrap"><table className="users-table"><thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Fecha de alta</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>
          {data.users.map(member => <tr key={member.id}>
            <td><strong>{member.name}</strong><span className="users-email">{member.email}</span></td>
            <td data-label="Rol">{roleLabels[member.role]}</td>
            <td data-label="Estado"><span className={`users-status ${member.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{member.status === "ACTIVE" ? "Activo" : "Suspendido"}</span></td>
            <td data-label="Fecha de alta"><time dateTime={member.createdAt}>{new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(member.createdAt))}</time></td>
            <td className="users-actions">{member.canEdit ? <AdminActionMenu label={`Acciones de ${member.name}`} disabled={saving || loading} items={[
              { label: "Editar usuario", icon: Pencil, onSelect: () => edit(member) },
              { label: member.status === "ACTIVE" ? "Suspender acceso" : "Reactivar acceso", icon: member.status === "ACTIVE" ? UserRoundX : UserRoundCheck, danger: member.status === "ACTIVE", onSelect: () => { setError(""); if (member.status === "ACTIVE") setSuspending(member); else void changeStatus(member); } }
            ]} /> : <span className="users-self">Tu cuenta</span>}</td>
          </tr>)}
        </tbody></table></div> : <div className="users-empty"><h2>{q || role !== "all" || status !== "all" ? "No encontramos usuarios" : "Tu equipo empieza acá"}</h2><p>{q || role !== "all" || status !== "all" ? "Probá otra búsqueda o cambiá los filtros." : "Agregá a las personas que te ayudan a gestionar la tienda."}</p>{!q && role === "all" && status === "all" && <button className="btn-secondary" onClick={() => edit(null)}>Agregar primer usuario</button>}</div>}
        <AdminPagination page={data.page} pageSize={pageSize} total={data.total} onChange={(next, size) => { setPage(next); setPageSize(size); }} />
      </>}
    </section>
    {!open && !suspending && error && <AdminNotice error>{error}</AdminNotice>}
    <AdminDialog open={open} onClose={() => { void close(); }} title={editing ? "Editar usuario" : "Nuevo usuario"} fullScreenMobile footer={<><button className="btn-secondary" disabled={saving} onClick={() => { void close(); }}>Cancelar</button><button className="btn-primary" type="submit" form="store-user-form" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear usuario"}</button></>}>
      <form id="store-user-form" className="users-form" onSubmit={save}>
        <AdminNotice error>{error}</AdminNotice>
        <fieldset className="users-form" disabled={saving}>
        <div className="users-form-field"><label htmlFor="user-name">Nombre</label><input id="user-name" className="field" autoComplete="name" required minLength={2} maxLength={80} value={form.name} onChange={event => update("name", event.target.value)} aria-invalid={!!fields.name?.length} aria-describedby={fields.name?.length ? "user-name-error" : undefined} />{fields.name?.length ? <span className="users-field-error" id="user-name-error">{fields.name.join(" ")}</span> : null}</div>
        <div className="users-form-field"><label htmlFor="user-email">Email</label><input id="user-email" className="field" type="email" autoComplete="email" required maxLength={180} value={form.email} onChange={event => update("email", event.target.value)} aria-invalid={!!fields.email?.length} aria-describedby={fields.email?.length ? "user-email-error" : undefined} />{fields.email?.length ? <span className="users-field-error" id="user-email-error">{fields.email.join(" ")}</span> : null}</div>
        <div className="users-form-field"><label htmlFor="user-password">{editing ? "Nueva contraseña (opcional)" : "Contraseña"}</label><input id="user-password" className="field" type="password" autoComplete="new-password" required={!editing} minLength={8} maxLength={72} value={form.password} onChange={event => update("password", event.target.value)} aria-invalid={!!fields.password?.length} aria-describedby="user-password-help user-password-error" /><span className="users-help" id="user-password-help">{editing ? "Dejala vacía para conservar la actual. Al cambiarla se cerrarán sus sesiones." : "Mínimo 8 caracteres. Compartí estas credenciales con la persona que va a ingresar."}</span><span className="users-field-error" id="user-password-error">{fields.password?.join(" ")}</span></div>
        <div className="users-form-field"><label htmlFor="user-role">Rol</label><select id="user-role" className="field" value={form.role} onChange={event => update("role", event.target.value as FormState["role"])} aria-describedby="user-role-help"><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select><span className="users-help" id="user-role-help">{form.role === "ADMIN" ? "Accede a todo el panel y administra otros usuarios. La cuenta del titular está protegida." : "Accede a Inicio, Ventas, Productos, Categorías y Clientes."}</span></div>
        {editing && <div className="users-form-field"><label htmlFor="user-status">Estado</label><select id="user-status" className="field" value={form.status} onChange={event => update("status", event.target.value as FormState["status"])} aria-describedby="user-status-help"><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option></select><span className="users-help" id="user-status-help">Suspender bloquea el acceso y cierra las sesiones anteriores.</span></div>}
        </fieldset>
      </form>
    </AdminDialog>
    <AdminDialog open={confirmSaveSuspension} onClose={() => { if (!saving) setConfirmSaveSuspension(false); }} title="Confirmar suspensión" centeredMobile footer={<><button className="btn-secondary" disabled={saving} onClick={() => setConfirmSaveSuspension(false)}>Cancelar</button><button className="btn-primary" disabled={saving} onClick={() => { void saveUser(); }}>{saving ? "Guardando…" : "Guardar y suspender"}</button></>}>
      <p>Al guardar se suspenderá el acceso de <strong>{editing?.name}</strong> y se cerrarán sus sesiones. Podrás reactivarlo desde el listado.</p>
    </AdminDialog>
    <AdminDialog open={!!suspending} onClose={() => { if (!saving) setSuspending(null); }} title="Suspender acceso" centeredMobile footer={<><button className="btn-secondary" disabled={saving} onClick={() => setSuspending(null)}>Cancelar</button><button className="btn-primary" disabled={saving} onClick={() => { if (suspending) void changeStatus(suspending); }}>{saving ? "Suspendiendo…" : "Suspender acceso"}</button></>}>
      <p>¿Querés suspender el acceso de <strong>{suspending?.name}</strong>? Se cerrarán sus sesiones y no podrá ingresar hasta que lo reactives.</p><AdminNotice error>{error}</AdminNotice>
    </AdminDialog>
  </div>;
}
