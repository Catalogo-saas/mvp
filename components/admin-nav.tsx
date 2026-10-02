"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowUpRight, BarChart3, ChevronRight, LogOut, Menu, Package, Palette, Settings2, ShoppingBag, Store, Tags, Users, UserRoundCog } from "lucide-react";
import { hasStorePermission, type StoreRole } from "@/lib/store-permissions";
import { useState } from "react";
import { AdminDialog } from "@/components/admin-ui";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";

import { useOrderRead } from "@/components/order-read-provider";

const links = [
  { href: "/gestion", label: "Inicio", icon: BarChart3, group: "Tu negocio" },
  { href: "/gestion/pedidos", label: "Ventas", icon: ShoppingBag, group: "Tu negocio" },
  { href: "/gestion/productos", label: "Productos", icon: Package, group: "Tu negocio" },
  { href: "/gestion/categorias", label: "Categorías", icon: Tags, group: "Tu negocio" },
  { href: "/gestion/clientes", label: "Clientes", icon: Users, group: "Tu negocio" },
  { href: "/gestion/configuracion/diseno", label: "Diseño de la tienda", icon: Palette, group: "Personalización" },
  { href: "/gestion/configuracion", label: "Configuración", icon: Settings2, group: "Personalización" },
  { href: "/gestion/usuarios", label: "Usuarios", icon: UserRoundCog, group: "Personalización" }
];
function active(path: string, href: string) {
  if (href === "/gestion") return path === href;
  if (href === "/gestion/configuracion" && path.startsWith(href + "/diseno")) return false;
  return path === href || path.startsWith(href + "/");
}
export function AdminNav({ storeSlug, storeName, role }: { storeSlug: string; storeName: string; role: StoreRole }) {
  const pathname = usePathname();
  const isDesignEditor = pathname === "/gestion/configuracion/diseno";
  const { count } = useOrderRead();
  const salesBadge = <span className="admin-nav-count" aria-label={`${count} ventas sin leer`}>{count > 99 ? "99+" : count}</span>;
  const [menuState, setMenuState] = useState({ pathname, open: false });
  if (menuState.pathname !== pathname) setMenuState({ pathname, open: false });
  const menu = menuState.open;
  const { confirmNavigation } = useUnsavedChanges();
  const visibleLinks = links.filter(link => hasStorePermission(role, link.href === "/gestion/usuarios" ? "users" : link.group === "Personalización" ? "settings" : "operate"));
  const bottomLinks = visibleLinks.filter(link => ["/gestion", "/gestion/pedidos", "/gestion/productos", role === "OPERATOR" ? "/gestion/clientes" : "/gestion/configuracion/diseno"].includes(link.href));
  const content = <>
    <Link href="/gestion" className="admin-brand"><span><Store size={23} /></span><div>Mi negocio<small>{storeName}</small></div></Link>
    <nav aria-label="Secciones de gestión" className="admin-side-links">
      {["Tu negocio", "Personalización"].filter(group => visibleLinks.some(link => link.group === group)).map(group => <div key={group}><p className="admin-nav-label">{group}</p>{visibleLinks.filter(link => link.group === group).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(pathname, href) ? "page" : undefined}><span className="admin-nav-icon"><Icon size={19} />{href === "/gestion/pedidos" && count > 0 && salesBadge}</span><span>{label}</span>{active(pathname, href) && <ChevronRight size={15} />}</Link>)}</div>)}
    </nav>
    <div className="admin-side-footer"><Link href={`/${storeSlug}`} target="_blank"><Store size={17} />Ver mi tienda<ArrowUpRight size={16} /></Link><button type="button" onClick={() => { void confirmNavigation().then(confirmed => { if (confirmed) void signOut({ callbackUrl: "/" }); }); }}><LogOut size={17} />Cerrar sesión</button></div>
  </>;
  return <>
    <aside className="admin-sidebar">{content}</aside>
    <nav className={"admin-bottom-nav" + (isDesignEditor ? " admin-bottom-nav--design-editor" : "")} aria-label="Navegación principal">
      {bottomLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(pathname, href) ? "page" : undefined}><span className="admin-nav-icon"><Icon size={21} />{href === "/gestion/pedidos" && count > 0 && salesBadge}</span><span>{href === "/gestion/configuracion/diseno" ? "Diseño" : label}</span></Link>)}
      <button type="button" onClick={() => setMenuState({ pathname, open: true })} aria-expanded={menu}><Menu size={21} /><span>Menú</span></button>
    </nav>
    <AdminDialog open={menu} onClose={() => setMenuState({ pathname, open: false })} title="Menú de gestión" rightDrawerMobile><div className="admin-mobile-menu">{content}</div></AdminDialog>
  </>;
}
