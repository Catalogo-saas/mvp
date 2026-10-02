"use client";

import Link from "next/link";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type AdminMenuAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  external?: boolean;
  download?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
};

export function AdminActionMenu({ label, text, items, disabled = false }: { label: string; text?: string; items: AdminMenuAction[]; disabled?: boolean }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  function position() {
    const element = menu.current, button = trigger.current;
    if (!element || !button) return;
    const box = button.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 24);
    element.style.width = `${width}px`;
    element.style.left = `${Math.max(12, Math.min(box.right - width, window.innerWidth - width - 12))}px`;
    const below = Math.max(0, window.innerHeight - box.bottom - 18);
    const above = Math.max(0, box.top - 18);
    const flip = below < Math.min(element.scrollHeight, 180) && above > below;
    element.style.maxHeight = `${flip ? above : below}px`;
    element.style.top = `${flip ? box.top - Math.min(element.scrollHeight, above) - 6 : box.bottom + 6}px`;
  }
  function close(restoreFocus = false) {
    menu.current?.hidePopover();
    if (restoreFocus) trigger.current?.focus();
  }
  function show(last = false) {
    menu.current?.showPopover();
    position();
    const choices = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)');
    choices?.[last ? choices.length - 1 : 0]?.focus();
  }
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className={text ? "btn-secondary" : "admin-icon-button"} disabled={disabled} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={() => open ? close() : show()}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(event.key === "ArrowUp"); } }}>
      <MoreVertical size={19} aria-hidden="true"/>{text}
    </button>
    <div id={id} ref={menu} popover="auto" role="menu" aria-label={label} className="admin-action-popover" onToggle={event => setOpen(event.newState === "open")}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); close(true); return; }
        if (event.key === "Tab") { close(); return; }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const choices = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
        const index = choices.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
        choices[next]?.focus();
      }}>
      {items.map(({ label: itemLabel, icon: Icon, href, external, download, disabled: itemDisabled, danger, onSelect }) => {
        const content = <>{Icon && <Icon size={18} aria-hidden="true"/>}<span>{itemLabel}</span></>;
        const common = { role: "menuitem", className: danger ? "is-danger" : undefined, tabIndex: -1, onClick: () => { close(true); onSelect?.(); } };
        return href && !itemDisabled ? external || download ? <a key={itemLabel} {...common} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} download={download}>{content}</a> : <Link key={itemLabel} {...common} href={href}>{content}</Link> : <button key={itemLabel} {...common} type="button" disabled={itemDisabled}>{content}</button>;
      })}
    </div>
  </>;
}
