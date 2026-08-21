"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, Package, Settings, Store } from "lucide-react";

export function AdminNav({ storeSlug }: { storeSlug: string }) {
  const pathname = usePathname();

  function linkClass(href: string) {
    const isActive = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return `rounded-2xl px-3 py-3 font-bold transition ${
      isActive ? "bg-green-50 text-brand" : "hover:bg-surface"
    }`;
  }

  return (
    <aside className="panel h-fit p-4 lg:sticky lg:top-6">
      <Link href="/admin" className="mb-6 flex items-center gap-2 px-2 text-xl font-black">
        <Store className="text-brand" /> Admin
      </Link>
      <nav className="grid gap-2">
        <Link className={linkClass("/admin")} href="/admin">
          <LayoutDashboard className="mr-2 inline" size={18} /> Pedidos
        </Link>
        <Link className={linkClass("/admin/products")} href="/admin/products">
          <Package className="mr-2 inline" size={18} /> Productos
        </Link>
        <Link className={linkClass("/admin/settings")} href="/admin/settings">
          <Settings className="mr-2 inline" size={18} /> Tienda
        </Link>
        <Link className="rounded-2xl px-3 py-3 font-bold text-brand hover:bg-green-50" href={`/${storeSlug}`}>
          Ver tienda pública
        </Link>
        <button
          className="rounded-2xl px-3 py-3 text-left font-bold text-red-600 hover:bg-red-50"
          onClick={() => signOut({ callbackUrl: "/" })}
          type="button"
        >
          <LogOut className="mr-2 inline" size={18} /> Salir
        </button>
      </nav>
    </aside>
  );
}
