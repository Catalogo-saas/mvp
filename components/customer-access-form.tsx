"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./customer-access-form.module.css";

export function CustomerAccessForm({ storeSlug, storeName, initialMode = "login", onClose }: {
  storeSlug: string;
  storeName: string;
  initialMode?: "login" | "register";
  onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canSubmit = fields.email.trim().length > 0 && fields.password.length >= (mode === "register" ? 8 : 1) && (mode === "login" || fields.name.trim().length >= 2);

  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    element?.querySelector<HTMLInputElement>("input[type=email]")?.focus({ preventScroll: true });
    return () => { if (element?.open) element.close(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/customer/${storeSlug}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(result?.error ?? "No se pudo continuar. Revisá tus datos e intentá otra vez.");
        return;
      }
      if (mode === "login") {
        onClose();
        router.push(`/${storeSlug}/perfil/compras`);
      } else {
        setMessage(result?.message ?? "Revisá tu correo para verificar la cuenta.");
      }
    } catch {
      setMessage("No pudimos conectarnos. Revisá tu conexión e intentá otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="customer-access-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }
  }}>
    <section className={styles.panel}>
      <button className={styles.close} type="button" aria-label="Cerrar" onClick={onClose}><X size={21}/></button>
      <h2 id="customer-access-title">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
      <p className={styles.storeName}>{storeName}</p>
      <form className={styles.form} onSubmit={submit}>
        {mode === "register" && <label>Nombre y apellido<input name="name" autoComplete="name" required minLength={2} maxLength={100} value={fields.name} onChange={event => setFields(current => ({ ...current, name: event.target.value }))}/></label>}
        <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={event => setFields(current => ({ ...current, email: event.target.value }))}/></label>
        <label>Clave<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} required value={fields.password} onChange={event => setFields(current => ({ ...current, password: event.target.value }))}/></label>
        {message && <p className={styles.message} role="status">{message}</p>}
        <button className={styles.submit} type="submit" disabled={busy || !canSubmit}>{busy ? "Procesando…" : mode === "login" ? "Ingresar" : "Registrarme"}</button>
      </form>
      <p className={styles.switchMode}>{mode === "login" ? "¿No estás registrado?" : "¿Ya tenés una cuenta?"}{" "}<button type="button" onClick={() => { setMode(current => current === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? "Registrate" : "Iniciá sesión"}</button></p>
    </section>
  </dialog>;
}
