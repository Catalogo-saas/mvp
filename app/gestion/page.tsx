import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, ClipboardList, Package, Settings, ShoppingBag } from "lucide-react";

import { OrderStatus } from "@/lib/generated/prisma/enums";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  PENDING_WHATSAPP: "Pendiente",
  PAID: "Pagado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado"
};

export default async function GestionDashboardPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  const [orderCount, earned, latestOrders, lowStockProducts] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id } }),
    prisma.order.aggregate({
      where: {
        storeId: store.id,
        status: { in: [OrderStatus.PAID, OrderStatus.DELIVERED] }
      },
      _sum: { total: true }
    }),
    prisma.order.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        code: true,
        status: true,
        customerName: true,
        total: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.product.findMany({
      where: {
        storeId: store.id,
        stockQuantity: { not: null, lt: 5 }
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true
      },
      orderBy: [{ stockQuantity: "asc" }, { name: "asc" }]
    })
  ]);

  const shortcuts = [
    { href: "/gestion/pedidos", label: "Pedidos", description: "Revisá y actualizá estados", icon: ClipboardList },
    { href: "/gestion/productos", label: "Productos", description: "Administrá catálogo y stock", icon: Package },
    { href: "/gestion/configuracion", label: "Configuración", description: "Editá los datos de tu tienda", icon: Settings }
  ];

  return (
    <div className="space-y-6">
      <header className="panel hidden p-6 sm:block">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Gestión</p>
        <h1 className="mt-2 text-3xl font-black">Resumen de {store.name}</h1>
        <p className="mt-2 text-muted">Todo lo importante de tu tienda, en un solo lugar.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="panel p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-muted">Total de pedidos</p>
            <ShoppingBag className="text-brand" size={20} />
          </div>
          <p className="mt-3 text-3xl font-black">{orderCount}</p>
        </article>
        <article className="panel p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-muted">Total ganado</p>
            <Banknote className="text-brand" size={20} />
          </div>
          <p className="mt-3 text-3xl font-black">{formatMoney(earned._sum.total ?? 0)}</p>
          <p className="mt-1 text-sm text-muted">Pedidos pagados o entregados</p>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">Atajos rápidos</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link key={shortcut.href} href={shortcut.href} className="panel flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand">
                <span className="rounded-2xl bg-green-50 p-3 text-brand">
                  <Icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{shortcut.label}</span>
                  <span className="mt-1 block text-sm text-muted">{shortcut.description}</span>
                </span>
                <ArrowRight className="shrink-0 text-muted" size={18} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Últimos pedidos</h2>
              <p className="mt-1 text-sm text-muted">Los cinco pedidos más recientes.</p>
            </div>
            <Link href="/gestion/pedidos" className="btn-secondary shrink-0">
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-5 divide-y divide-line">
            {latestOrders.length ? latestOrders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-black">#{order.code} · {order.customerName}</p>
                  <p className="mt-1 text-sm text-muted">{formatBuenosAiresDate(order.createdAt)} · {statusLabels[order.status]}</p>
                </div>
                <p className="font-black">{formatMoney(order.total)}</p>
              </div>
            )) : (
              <div className="py-6 text-sm text-muted">Todavía no hay pedidos.</div>
            )}
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Bajo stock</h2>
              <p className="mt-1 text-sm text-muted">Productos con menos de 5 unidades.</p>
            </div>
            <AlertTriangle className={lowStockProducts.length ? "text-orange-500" : "text-brand"} size={22} />
          </div>
          <div className="mt-5 divide-y divide-line">
            {lowStockProducts.length ? lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <p className="min-w-0 truncate font-bold">{product.name}</p>
                <span className="shrink-0 font-black text-orange-600">{product.stockQuantity} u.</span>
              </div>
            )) : (
              <div className="py-6 text-sm text-muted">No hay productos con bajo stock.</div>
            )}
          </div>
          <Link href="/gestion/productos" className="mt-5 inline-flex items-center gap-2 font-bold text-brand">
            Revisar productos <ArrowRight size={16} />
          </Link>
        </section>
      </section>
    </div>
  );
}
