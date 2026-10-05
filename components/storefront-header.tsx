"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import type { StorefrontStore } from "@/components/public-store";
import { CustomerAccessForm } from "@/components/customer-access-form";
import { normalizeDesignConfig } from "@/lib/design-config";
import styles from "./commerce-storefront.module.css";

type HeaderStore = Pick<StorefrontStore, "name" | "slug" | "logoUrl" | "designConfig"> & {
  template?: string;
  isPreview?: boolean;
  signedIn?: boolean;
};
type HeaderCategory = { id: string; name: string; slug: string; parentId?: string | null };

export function StorefrontHeader({ store, categories, cartCount = 0, query, onQuery, onCart, onSearch, paymentMessage = "" }: {
  store: HeaderStore;
  categories: HeaderCategory[];
  cartCount?: number;
  query?: string;
  onQuery?: (query: string) => void;
  onCart?: () => void;
  onSearch?: (query: string) => void;
  paymentMessage?: string;
}) {
  const design = normalizeDesignConfig(store.designConfig);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<"login" | "register" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query ?? "");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const drawer = useRef<HTMLDialogElement>(null);
  const mobileSearch = useRef<HTMLInputElement>(null);
  const scrollAfterMenu = useRef<string | null>(null);
  const searchQuery = localQuery;
  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedMode = url.searchParams.get("cuenta");
    if (requestedMode !== "login" && requestedMode !== "register") return;
    const frame = requestAnimationFrame(() => setAccessMode(requestedMode));
    url.searchParams.delete("cuenta");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return () => cancelAnimationFrame(frame);
  }, [store.slug]);

  useEffect(() => {
    const dialog = drawer.current;
    const focused = document.activeElement as HTMLElement | null;
    if (menuOpen) {
      if (!dialog?.open) dialog?.showModal();
      dialog?.focus({ preventScroll: true });
    } else if (dialog?.open) dialog.close();
    return () => { dialog?.close(); if (menuOpen) focused?.focus({ preventScroll: true }); };
  }, [menuOpen]);
  useEffect(() => { if (searchOpen) mobileSearch.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (menuOpen || !scrollAfterMenu.current) return;
    const path = scrollAfterMenu.current;
    scrollAfterMenu.current = null;
    requestAnimationFrame(() => {
      if (path === "/") window.scrollTo({ top: 0, behavior: "smooth" });
      else document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [menuOpen]);

  const href = (path: string) => `/${store.slug}${path === "/" ? "" : path}`;
  const previewNavigate = (path: string) => {
    if (path === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  };
  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, path: string, mobile = false) => {
    if (store.isPreview) {
      event.preventDefault();
      if (mobile && menuOpen) { scrollAfterMenu.current = path; setMenuOpen(false); }
      else previewNavigate(path);
    }
    if (mobile) setMenuOpen(false);
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>, mobile = false) => {
    event.preventDefault();
    if (mobile) setSearchOpen(false);
    onQuery?.(searchQuery.trim());
    if (onSearch) onSearch(searchQuery.trim());
    else window.location.assign(href("/productos" + (searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : "")));
  };
  const updateQuery = (value: string) => setLocalQuery(value);
  const openAccess = (mode: "login" | "register") => { setMenuOpen(false); setAccessMode(mode); };

  function categoryBranches(parentId: string | null, mobile: boolean): React.ReactNode {
    return categories.filter(item => (item.parentId ?? null) === parentId).map(item => {
      const hasChildren = categories.some(child => child.parentId === item.id);
      const expanded = !mobile || expandedCategories.includes(item.id);
      const path = `/productos?categoria=${encodeURIComponent(item.slug)}`;
      return <div key={item.id} className={styles.categoryBranch}>
        <a href={href(path)} onClick={event => handleNavigation(event, path, mobile)}>{item.name}</a>
        {mobile && hasChildren && <button className={styles.categoryToggle} type="button" aria-label={`${expanded ? "Ocultar" : "Mostrar"} subcategorías de ${item.name}`} aria-expanded={expanded} onClick={() => setExpandedCategories(current => expanded ? current.filter(id => id !== item.id) : [...current, item.id])}><ChevronDown size={16}/></button>}
        {hasChildren && expanded && <div className={styles.categoryChildren}>{categoryBranches(item.id, mobile)}</div>}
      </div>;
    });
  }

  function navItems(mobile = false) {
    return <>
      <div className={styles.navItem}><a href={href("/")} onClick={event => handleNavigation(event, "/", mobile)}>Inicio</a></div>
      {mobile ? <div className={`${styles.navItem} ${styles.categoryNav}`}><details><summary aria-label="Mostrar categorías">Categorías <ChevronDown size={18}/></summary><div className={styles.submenu}>{categoryBranches(null, true)}</div></details></div> : <div className={`${styles.navItem} ${styles.categoryNav}`}><button type="button" aria-haspopup="true">Categorías <ChevronDown size={14}/></button><div className={styles.submenu}>{categoryBranches(null, false)}</div></div>}
      <div className={styles.navItem}><a href={href("/productos")} onClick={event => handleNavigation(event, "/productos", mobile)}>Productos</a></div>
    </>;
  }

  return <>
    <header className={styles.header} data-sticky={design.headerSticky}>
      <div className={styles.headerInner}>
        <button className={styles.mobileMenuButton} aria-label="Abrir menú" type="button" onClick={() => setMenuOpen(true)}><Menu size={25}/></button>
        <a className={styles.brand} href={href("/")} aria-label={`Inicio · ${store.name}`} onClick={event => handleNavigation(event, "/")}>
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ height: design.logoSize, maxWidth: design.logoSize * 3.5 }}/> : <span>{store.name}</span>}
        </a>
        <nav className={styles.desktopNav} aria-label="Menú de la tienda">{navItems()}</nav>
        <form className={styles.headerSearch} onSubmit={event => submitSearch(event)}>
          <input aria-label="Buscar productos en la tienda" placeholder="¿Qué buscás?" value={searchQuery} onChange={event => updateQuery(event.target.value)}/>
          <button type="submit" aria-label="Buscar"><Search size={19}/></button>
        </form>
        <div className={styles.tools}>
          <button className={styles.mobileSearchButton} type="button" aria-label={searchOpen ? "Cerrar búsqueda" : "Abrir búsqueda"} aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}>{searchOpen ? <X size={23}/> : <Search size={23}/>}</button>
          {store.signedIn ? <a className={styles.accountLink} aria-label="Mi perfil" href={href("/perfil/compras")}><UserRound size={23}/></a> : <button className={styles.accountLink} aria-label="Iniciar sesión" aria-haspopup="dialog" type="button" onClick={() => openAccess("login")}><UserRound size={23}/></button>}
          {onCart ? <button type="button" onClick={onCart} aria-label={`Abrir carrito, ${cartCount} productos`}><ShoppingBag size={23}/>{cartCount > 0 && <span className={styles.cartCount}>{cartCount}</span>}</button> : <a href={href("/productos")} aria-label="Ver productos"><ShoppingBag size={23}/></a>}
        </div>
      </div>
      {searchOpen && <form className={styles.mobileSearch} onSubmit={event => submitSearch(event, true)}><input ref={mobileSearch} aria-label="Buscar productos" placeholder="¿Qué buscás?" value={searchQuery} onChange={event => updateQuery(event.target.value)}/><button type="submit" aria-label="Buscar en el catálogo"><Search size={20}/></button></form>}
      {paymentMessage && <div className={styles.paymentAnnouncement}>{paymentMessage}</div>}
    </header>
    <dialog ref={drawer} className={styles.drawer} aria-label="Menú de la tienda" tabIndex={-1} onCancel={event => { event.preventDefault(); setMenuOpen(false); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right) setMenuOpen(false); } }}>
      <div className={styles.drawerHead}><strong>{store.name}</strong><button aria-label="Cerrar menú" type="button" onClick={() => setMenuOpen(false)}><X size={22}/></button></div>
      <nav>{navItems(true)}</nav>
      <div className={styles.drawerAccount}>{store.signedIn ? <a href={href("/perfil/compras")}>Mi perfil</a> : <button type="button" aria-haspopup="dialog" onClick={() => openAccess("login")}>Iniciar sesión</button>}<span aria-hidden="true"/>{!store.signedIn && <button type="button" aria-haspopup="dialog" onClick={() => openAccess("register")}>Crear cuenta</button>}</div>
    </dialog>
    {accessMode && <CustomerAccessForm key={accessMode} storeSlug={store.slug} storeName={store.name} initialMode={accessMode} onClose={() => setAccessMode(null)}/>}
  </>;
}
