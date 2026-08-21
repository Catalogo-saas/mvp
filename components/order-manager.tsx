"use client";

import { Banknote, Check, ListFilter, PackageCheck, Search, X, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/money";

type OrderStatus = "PENDING_WHATSAPP" | "PAID" | "DELIVERED" | "CANCELLED";
type StatusFilter = OrderStatus | "all";

type OrderListItem = {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  notes: string | null;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    subtotal: number;
  }>;
};

const statusOptions: Array<{ value: OrderStatus; label: string; plural: string }> = [
  { value: "PENDING_WHATSAPP", label: "Pendiente", plural: "Pendientes" },
  { value: "PAID", label: "Pagado", plural: "Pagados" },
  { value: "DELIVERED", label: "Entregado", plural: "Entregados" },
  { value: "CANCELLED", label: "Cancelado", plural: "Cancelados" }
];

const filterOptions: Array<{ value: StatusFilter; label: string; icon: LucideIcon }> = [
  { value: "all", label: "Todos", icon: ListFilter },
  { value: "PENDING_WHATSAPP", label: "Pendientes", icon: Banknote },
  { value: "PAID", label: "Pagados", icon: Check },
  { value: "DELIVERED", label: "Entregados", icon: PackageCheck },
  { value: "CANCELLED", label: "Cancelados", icon: X }
];

function statusLabel(status: OrderStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function statusBadgeClass(status: OrderStatus) {
  if (status === "PAID") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "DELIVERED") {
    return "bg-green-100 text-green-800";
  }
  if (status === "CANCELLED") {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-800";
}

function filterBadgeClass(status: StatusFilter, isActive: boolean) {
  if (status === "PAID") {
    return isActive ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700";
  }
  if (status === "DELIVERED") {
    return isActive ? "bg-green-600 text-white" : "bg-green-50 text-green-700";
  }
  if (status === "CANCELLED") {
    return isActive ? "bg-red-600 text-white" : "bg-red-50 text-red-700";
  }
  if (status === "PENDING_WHATSAPP") {
    return isActive ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700";
  }
  return isActive ? "bg-brand text-white" : "bg-surface text-muted";
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function OrderManager({ orders: initialOrders }: { orders: OrderListItem[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return orders.reduce<Record<StatusFilter, number>>(
      (acc, order) => {
        acc.all += 1;
        acc[order.status] += 1;
        return acc;
      },
      { all: 0, PENDING_WHATSAPP: 0, PAID: 0, DELIVERED: 0, CANCELLED: 0 }
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesQuery = [order.code, order.customerName, order.customerPhone]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    setError("");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json().catch(() => null);
    setUpdatingId(null);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el pedido.");
      return;
    }

    setOrders((current) => current.map((order) => (order.id === orderId ? { ...data.order, createdAt: data.order.createdAt } : order)));
  }

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-3 border-b border-line p-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            className="field !pl-11"
            placeholder="Buscar por ID, cliente, celular..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-black ${filterBadgeClass(option.value, isActive)}`}
                type="button"
                onClick={() => setStatusFilter(option.value)}
              >
                <Icon size={15} /> {option.label} ({counts[option.value]})
              </button>
            );
          })}
        </div>
        {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      <div className="divide-y divide-line">
        {filteredOrders.length === 0 ? (
          <p className="p-5 text-muted">No hay pedidos para mostrar.</p>
        ) : (
          filteredOrders.map((order) => (
            <article key={order.id} className="p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">#{order.code} · {order.customerName}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {order.customerPhone} · {order.fulfillment} · {formatOrderDate(order.createdAt)}
                  </p>
                  {order.notes ? <p className="mt-2 text-sm text-muted">{order.notes}</p> : null}
                </div>
                <div className="grid gap-2 text-left lg:min-w-48 lg:text-right">
                  <p className="text-xl font-black">{formatMoney(order.total)}</p>
                  <select
                    className="field !py-2 text-sm"
                    value={order.status}
                    disabled={updatingId === order.id}
                    onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.productName} - {formatMoney(item.subtotal)}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
