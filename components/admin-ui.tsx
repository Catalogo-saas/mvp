"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";

export function AdminPageHeader({ title, description, action, back }: { title: string; description?: string; action?: ReactNode; back?: string }) {
  return <header className="admin-page-header"><div>{back && <Link href={back} className="admin-back"><ChevronLeft size={16} />Volver</Link>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="admin-header-actions">{action}</div>}</header>;
}
export function AdminDialog({ open, onClose, title, children, footer, fullScreenMobile = false, centeredMobile = false, rightDrawerMobile = false, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; fullScreenMobile?: boolean; centeredMobile?: boolean; rightDrawerMobile?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLockBodyScroll(open);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); if (open) previous?.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => {
    if (!open || !fullScreenMobile || !window.visualViewport) return;
    const dialog = ref.current;
    const viewport = window.visualViewport;
    if (!dialog) return;
    const update = () => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      dialog.style.setProperty("--dialog-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--dialog-viewport-top", `${viewport.offsetTop}px`);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && dialog.contains(focused)) focused.scrollIntoView({ block: "nearest" });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      dialog.style.removeProperty("--dialog-viewport-height");
      dialog.style.removeProperty("--dialog-viewport-top");
    };
  }, [open, fullScreenMobile]);
  return <dialog ref={ref} className={`admin-dialog${fullScreenMobile ? " admin-dialog-fullscreen" : ""}${centeredMobile ? " admin-dialog-centered-mobile" : ""}${rightDrawerMobile ? " admin-dialog-right-drawer" : ""}${wide ? " admin-dialog-wide" : ""}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }} aria-label={title}><header><h2>{title}</h2><button type="button" className="admin-icon-button" onClick={onClose} aria-label={`Cerrar ${title}`}><X size={20} /></button></header><div className="admin-dialog-body">{open ? children : null}</div>{footer && <footer>{footer}</footer>}</dialog>;
}
export function AdminPagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number, size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="admin-pagination"><span>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} de {total}</span><div><select aria-label="Elementos por página" value={pageSize} onChange={e => onChange(1, Number(e.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} por página</option>)}</select><button className="admin-icon-button" disabled={page <= 1} aria-label="Página anterior" onClick={() => onChange(page - 1, pageSize)}><ChevronLeft size={18} /></button><span>{page} / {pages}</span><button className="admin-icon-button" disabled={page >= pages} aria-label="Página siguiente" onClick={() => onChange(page + 1, pageSize)}><ChevronRight size={18} /></button></div></div>;
}
export function AdminNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return children ? <div className={`admin-notice ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{children}</div> : null;
}
