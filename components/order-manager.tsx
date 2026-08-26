"use client";

import {
  Banknote,
  Check,
  Eye,
  ListFilter,
  PackageCheck,
  Printer,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";

type OrderStatus = "PENDING_WHATSAPP" | "PAID" | "DELIVERED" | "CANCELLED";
type StatusFilter = OrderStatus | "all";
type TimeFilter = "today" | "yesterday" | "week" | "month" | "year" | "always" | "custom";

type AdvancedFilters = {
  timeFilter: TimeFilter;
  customFrom: string;
  customTo: string;
  priceMin: string;
  priceMax: string;
};

type OrderItemOption = {
  groupName?: string;
  optionName?: string;
  priceDelta?: number;
};

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
    unitPrice: number;
    options: unknown;
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

const timeFilterOptions: Array<{ value: TimeFilter; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "year", label: "Este año" },
  { value: "always", label: "Siempre" },
  { value: "custom", label: "Personalizado" }
];

const emptyAdvancedFilters: AdvancedFilters = {
  timeFilter: "always",
  customFrom: "",
  customTo: "",
  priceMin: "",
  priceMax: ""
};

const statusFilterValues = new Set<StatusFilter>(filterOptions.map((option) => option.value));
const timeFilterValues = new Set<TimeFilter>(timeFilterOptions.map((option) => option.value));

function isStatusFilter(value: string | null): value is StatusFilter {
  return value !== null && statusFilterValues.has(value as StatusFilter);
}

function isTimeFilter(value: string | null): value is TimeFilter {
  return value !== null && timeFilterValues.has(value as TimeFilter);
}

function isDateFilter(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatPriceFilterQuery(value: string) {
  const parsed = parsePriceFilter(value);
  return parsed === null ? "" : String(parsed);
}

function filtersFromSearchParams(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const time = searchParams.get("time");
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  return {
    statusFilter: isStatusFilter(status) ? status : "all",
    advancedFilters: {
      timeFilter: isTimeFilter(time) ? time : "always",
      customFrom: isDateFilter(customFrom) ? customFrom : "",
      customTo: isDateFilter(customTo) ? customTo : "",
      priceMin: minPrice ? formatPriceFilterInput(minPrice) : "",
      priceMax: maxPrice ? formatPriceFilterInput(maxPrice) : ""
    }
  } satisfies { statusFilter: StatusFilter; advancedFilters: AdvancedFilters };
}

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

function argentinaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addArgentinaDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return argentinaDateString(date);
}

function argentinaDayBoundary(dateString: string, boundary: "start" | "end") {
  const [year, month, day] = dateString.split("-").map(Number);
  const hours = boundary === "start" ? 0 : 23;
  const minutes = boundary === "start" ? 0 : 59;
  const seconds = boundary === "start" ? 0 : 59;
  const milliseconds = boundary === "start" ? 0 : 999;

  // Argentina is UTC-03:00. Building the timestamp from UTC avoids parsing
  // a local date in the browser's timezone before comparing it with ISO dates.
  return Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds) + 3 * 60 * 60 * 1000;
}

function argentinaDateRange(timeFilter: TimeFilter, customFrom: string, customTo: string) {
  if (timeFilter === "always") {
    return { from: null, to: null };
  }

  const today = argentinaDateString();
  if (timeFilter === "today") {
    return { from: argentinaDayBoundary(today, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "yesterday") {
    const yesterday = addArgentinaDays(today, -1);
    return { from: argentinaDayBoundary(yesterday, "start"), to: argentinaDayBoundary(yesterday, "end") };
  }

  if (timeFilter === "week") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    const monday = addArgentinaDays(today, -mondayOffset);
    return { from: argentinaDayBoundary(monday, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "month") {
    return { from: argentinaDayBoundary(`${today.slice(0, 7)}-01`, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "year") {
    return { from: argentinaDayBoundary(`${today.slice(0, 4)}-01-01`, "start"), to: argentinaDayBoundary(today, "end") };
  }

  return {
    from: customFrom ? argentinaDayBoundary(customFrom, "start") : null,
    to: customTo ? argentinaDayBoundary(customTo, "end") : null
  };
}

function parsePriceFilter(value: string) {
  const raw = value.replace(/\s/g, "").replace(/^\$/, "");
  if (!raw) {
    return null;
  }

  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) {
    // Argentine format with thousands dots and decimal comma: 1.234,50.
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // Argentine thousands format: 1.234.567.
    normalized = raw.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    normalized = raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function formatPriceFilterInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("es-AR") : "";
}

function PriceFilterInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <span className="field grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 !px-4 !py-0">
        <span className="flex h-full items-center justify-center font-black leading-none text-ink">$</span>
        <input
          className="min-w-0 bg-transparent py-3 text-[inherit] font-semibold text-ink outline-none placeholder:text-muted"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(formatPriceFilterInput(event.target.value))}
        />
      </span>
    </label>
  );
}

function normalizeOrderOptions(options: unknown): OrderItemOption[] {
  if (!Array.isArray(options)) {
    return [];
  }
  return options
    .map((option) => {
      if (!option || typeof option !== "object") {
        return null;
      }
      const record = option as Record<string, unknown>;
      return {
        groupName: typeof record.groupName === "string" ? record.groupName : undefined,
        optionName: typeof record.optionName === "string" ? record.optionName : undefined,
        priceDelta: typeof record.priceDelta === "number" ? record.priceDelta : undefined
      };
    })
    .filter(Boolean) as OrderItemOption[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printableOrderHtml(order: OrderListItem) {
  const items = order.items
    .map((item) => {
      const options = normalizeOrderOptions(item.options)
        .map((option) => `<li>${escapeHtml(option.groupName ? `${option.groupName}: ` : "")}${escapeHtml(option.optionName ?? "")}${option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}</li>`)
        .join("");
      return `
        <tr>
          <td>
            <strong>${item.quantity}x ${escapeHtml(item.productName)}</strong>
            ${options ? `<ul>${options}</ul>` : ""}
          </td>
          <td>${formatMoney(item.unitPrice)}</td>
          <td>${formatMoney(item.subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Pedido ${escapeHtml(order.code)}</title>
        <style>
          body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; margin: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { margin: 4px 0; color: #4b5563; }
          .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 18px; }
          .badge { display: inline-block; border-radius: 999px; padding: 6px 10px; background: #ecfdf5; color: #166534; font-weight: 800; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 0; text-align: left; vertical-align: top; }
          th:nth-child(2), th:nth-child(3), td:nth-child(2), td:nth-child(3) { text-align: right; white-space: nowrap; }
          ul { margin: 6px 0 0 18px; padding: 0; color: #6b7280; font-size: 13px; }
          .total { margin-top: 20px; text-align: right; font-size: 24px; font-weight: 900; }
          .notes { margin-top: 18px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="badge">${escapeHtml(statusLabel(order.status))}</span>
          <h1>Pedido #${escapeHtml(order.code)}</h1>
          <p><strong>Cliente:</strong> ${escapeHtml(order.customerName)}</p>
          <p><strong>Celular:</strong> ${escapeHtml(order.customerPhone)}</p>
          <p><strong>Entrega:</strong> ${escapeHtml(order.fulfillment)}</p>
          <p><strong>Fecha:</strong> ${escapeHtml(formatBuenosAiresDate(order.createdAt))}</p>
        </div>
        <table>
          <thead>
            <tr><th>Producto</th><th>Unitario</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
        ${order.notes ? `<div class="notes"><strong>Notas:</strong><br />${escapeHtml(order.notes)}</div>` : ""}
        <div class="total">Total: ${formatMoney(order.total)}</div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;
}

function printOrder(order: OrderListItem) {
  const printWindow = window.open("", "_blank", "width=520,height=720");
  if (!printWindow) {
    return;
  }
  printWindow.document.open();
  printWindow.document.write(printableOrderHtml(order));
  printWindow.document.close();
}

export function OrderManager({ orders: initialOrders }: { orders: OrderListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const urlFilters = useMemo(() => filtersFromSearchParams(new URLSearchParams(searchParamsString)), [searchParamsString]);
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const statusFilter = urlFilters.statusFilter;
  const appliedFilters = urlFilters.advancedFilters;
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(appliedFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useLockBodyScroll(filtersOpen || Boolean(selectedOrder));

  function replaceFilterParams(nextStatusFilter: StatusFilter, nextAdvancedFilters: AdvancedFilters) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextStatusFilter === "all") {
      params.delete("status");
    } else {
      params.set("status", nextStatusFilter);
    }

    if (nextAdvancedFilters.timeFilter === "always") {
      params.delete("time");
      params.delete("from");
      params.delete("to");
    } else {
      params.set("time", nextAdvancedFilters.timeFilter);
      if (nextAdvancedFilters.timeFilter === "custom" && nextAdvancedFilters.customFrom) {
        params.set("from", nextAdvancedFilters.customFrom);
      } else {
        params.delete("from");
      }
      if (nextAdvancedFilters.timeFilter === "custom" && nextAdvancedFilters.customTo) {
        params.set("to", nextAdvancedFilters.customTo);
      } else {
        params.delete("to");
      }
    }

    const minPrice = formatPriceFilterQuery(nextAdvancedFilters.priceMin);
    const maxPrice = formatPriceFilterQuery(nextAdvancedFilters.priceMax);
    if (minPrice) {
      params.set("minPrice", minPrice);
    } else {
      params.delete("minPrice");
    }
    if (maxPrice) {
      params.set("maxPrice", maxPrice);
    } else {
      params.delete("maxPrice");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const advancedFilteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const hasAdvancedFilters =
      appliedFilters.timeFilter !== "always" ||
      appliedFilters.customFrom.trim() ||
      appliedFilters.customTo.trim() ||
      appliedFilters.priceMin.trim() ||
      appliedFilters.priceMax.trim();

    if (!normalizedQuery && !hasAdvancedFilters) {
      return orders;
    }

    const dateRange = argentinaDateRange(appliedFilters.timeFilter, appliedFilters.customFrom, appliedFilters.customTo);
    const min = parsePriceFilter(appliedFilters.priceMin);
    const max = parsePriceFilter(appliedFilters.priceMax);

    return orders.filter((order) => {
      const createdAt = Date.parse(order.createdAt);
      if (!Number.isFinite(createdAt)) {
        return false;
      }
      const matchesQuery = [order.code, order.customerName, order.customerPhone]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesFrom = dateRange.from === null || createdAt >= dateRange.from;
      const matchesTo = dateRange.to === null || createdAt <= dateRange.to;
      const matchesMin = min === null || order.total >= min;
      const matchesMax = max === null || order.total <= max;
      return matchesQuery && matchesFrom && matchesTo && matchesMin && matchesMax;
    });
  }, [orders, query, appliedFilters]);

  const counts = useMemo(() => {
    return advancedFilteredOrders.reduce<Record<StatusFilter, number>>(
      (acc, order) => {
        acc.all += 1;
        acc[order.status] += 1;
        return acc;
      },
      { all: 0, PENDING_WHATSAPP: 0, PAID: 0, DELIVERED: 0, CANCELLED: 0 }
    );
  }, [advancedFilteredOrders]);

  const filteredOrders = useMemo(() => {
    return advancedFilteredOrders.filter((order) => statusFilter === "all" || order.status === statusFilter);
  }, [advancedFilteredOrders, statusFilter]);

  const metrics = useMemo(() => {
    const paidTotal = filteredOrders.reduce((sum, order) => {
      if (order.status === "PAID" || order.status === "DELIVERED") {
        return sum + order.total;
      }
      return sum;
    }, 0);
    const average = filteredOrders.length ? Math.round(filteredOrders.reduce((sum, order) => sum + order.total, 0) / filteredOrders.length) : 0;
    return { count: filteredOrders.length, paidTotal, average };
  }, [filteredOrders]);

  const activeAdvancedFilters = [
    appliedFilters.timeFilter !== "always",
    Boolean(appliedFilters.priceMin.trim()),
    Boolean(appliedFilters.priceMax.trim())
  ].filter(Boolean).length;

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
    setSelectedOrder((current) => (current?.id === orderId ? { ...data.order, createdAt: data.order.createdAt } : current));
  }

  function resetAdvancedFilters() {
    setDraftFilters(emptyAdvancedFilters);
    setFiltersOpen(false);
    replaceFilterParams(statusFilter, emptyAdvancedFilters);
  }

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  }

  function closeFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(false);
  }

  function applyAdvancedFilters() {
    setFiltersOpen(false);
    replaceFilterParams(statusFilter, draftFilters);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Pedidos</p>
          <p className="mt-2 text-3xl font-black">{metrics.count}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Total pagado</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(metrics.paidTotal)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Prom. pedido</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(metrics.average)}</p>
        </article>
      </section>

      <section className="panel overflow-hidden">
        <div className="grid gap-3 border-b border-line p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="grid gap-2">
              <span className="text-sm font-black text-ink">Buscar pedido</span>
              <span className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  className="field !pl-11"
                  placeholder="ID, cliente o celular"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </label>
            <button className="btn-secondary self-end !py-3" type="button" onClick={openFilters}>
              <SlidersHorizontal size={18} />
              Filtros{activeAdvancedFilters ? ` (${activeAdvancedFilters})` : ""}
            </button>
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
                  onClick={() => {
                    replaceFilterParams(option.value, appliedFilters);
                  }}
                >
                  <Icon size={15} /> {option.label} ({counts[option.value]})
                </button>
              );
            })}
          </div>
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>

        {filteredOrders.length === 0 ? (
          <p className="p-5 text-muted">No hay pedidos para mostrar.</p>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[27%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Pedido</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Cliente</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Productos</th>
                    <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-[0.14em] text-muted">Total</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Estado</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-4 align-top">
                        <p className="font-black text-ink">#{order.code}</p>
                        <p className="mt-1 text-sm font-semibold leading-snug text-muted">{formatBuenosAiresDate(order.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black text-ink">{order.customerName}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-muted">{order.customerPhone}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <ul className="grid gap-1 text-sm font-semibold text-muted">
                          {order.items.map((item) => (
                            <li key={item.id} className="truncate">
                              <span className="font-black text-ink">{item.quantity}x</span> {item.productName}
                            </li>
                          ))}
                        </ul>
                        {order.notes ? <p className="mt-2 truncate text-xs font-semibold text-muted">Nota: {order.notes}</p> : null}
                      </td>
                      <td className="px-3 py-4 text-right align-top">
                        <p className="whitespace-nowrap text-lg font-black tracking-[-0.03em] text-ink">{formatMoney(order.total)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <select
                          className="field !py-2 !pl-3 !pr-8 text-sm font-bold"
                          value={order.status}
                          disabled={updatingId === order.id}
                          aria-label={`Cambiar estado del pedido ${order.code}`}
                          onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <button
                          className="btn-secondary w-full !rounded-2xl !px-2 !py-2 text-sm"
                          type="button"
                          aria-label={`Ver detalle del pedido ${order.code}`}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye size={16} />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 bg-surface p-3 lg:hidden">
              {filteredOrders.map((order) => (
                <article key={order.id} className="grid overflow-hidden rounded-[28px] border border-line bg-white">
                  <div className="grid gap-4 bg-surface p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Pedido</p>
                      <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-ink">#{order.code}</p>
                      <p className="mt-1 text-sm font-bold text-muted">{formatBuenosAiresDate(order.createdAt)}</p>
                    </div>
                    <span className={`w-max rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid gap-4 border-t border-line p-5">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Cliente</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.customerName}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Celular</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.customerPhone}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Entrega</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.fulfillment}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Items</p>
                          <p className="mt-1 text-sm font-black text-ink">
                            {order.items.length} producto{order.items.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Productos</p>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-muted">
                        {order.items.map((item) => (
                          <li key={item.id} className="before:mr-2 before:text-brand before:content-['•']">
                            <span className="font-black text-ink">{item.quantity}x</span> {item.productName}
                            <span className="ml-1 whitespace-nowrap text-ink">{formatMoney(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {order.notes ? (
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Nota del cliente</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-muted">{order.notes}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 border-t border-line p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Total</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink">{formatMoney(order.total)}</p>
                    </div>
                    <div className="grid gap-2">
                      <button
                        className="btn-secondary !rounded-2xl !px-4 !py-2.5"
                        type="button"
                        aria-label={`Ver detalle del pedido ${order.code}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye size={18} />
                        Ver detalle
                      </button>
                      <select
                        className="field !py-2.5 text-sm font-bold"
                        value={order.status}
                        disabled={updatingId === order.id}
                        aria-label={`Cambiar estado del pedido ${order.code}`}
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
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Filtrar pedidos">
          <div className="grid max-h-[92dvh] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Filtros</p>
                <h2 className="mt-1 text-2xl font-black">Filtrar pedidos</h2>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={closeFilters} aria-label="Cerrar filtros">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 overflow-y-auto overscroll-contain pb-6 pr-1">
              <fieldset className="grid gap-3">
                <legend className="font-black">Tiempo</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {timeFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black ${
                        draftFilters.timeFilter === option.value ? "border-brand bg-brand/10 text-brand" : "border-line bg-white text-ink"
                      }`}
                      type="button"
                      onClick={() => setDraftFilters((current) => ({ ...current, timeFilter: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {draftFilters.timeFilter === "custom" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Fecha inicio</span>
                    <input
                      className="field"
                      type="date"
                      value={draftFilters.customFrom}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, customFrom: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Fecha fin</span>
                    <input
                      className="field"
                      type="date"
                      value={draftFilters.customTo}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, customTo: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <PriceFilterInput
                  label="Precio mínimo"
                  placeholder="0"
                  value={draftFilters.priceMin}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, priceMin: value }))}
                />
                <PriceFilterInput
                  label="Precio máximo"
                  placeholder="50.000"
                  value={draftFilters.priceMax}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, priceMax: value }))}
                />
              </div>
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="btn-secondary w-full" type="button" onClick={resetAdvancedFilters}>
                  Limpiar
                </button>
                <button className="btn-primary w-full" type="button" onClick={applyAdvancedFilters}>
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-[100] flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Detalle del pedido">
          <div className="grid max-h-[92dvh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pedido</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black">#{selectedOrder.code}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(selectedOrder.status)}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{formatBuenosAiresDate(selectedOrder.createdAt)}</p>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={() => setSelectedOrder(null)} aria-label="Cerrar detalle">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain pb-6 pr-1">
              <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Cliente</p>
                  <p className="mt-1 truncate font-black">{selectedOrder.customerName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Celular</p>
                    <p className="mt-1 truncate font-black">{selectedOrder.customerPhone}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Entrega</p>
                    <p className="mt-1 truncate font-black">{selectedOrder.fulfillment}</p>
                  </div>
                </div>
              </div>

              {selectedOrder.notes ? (
                <div className="mt-4 rounded-3xl border border-line p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Notas</p>
                  <p className="mt-2 text-sm text-muted">{selectedOrder.notes}</p>
                </div>
              ) : null}

              <div className="mt-5 divide-y divide-line rounded-3xl border border-line">
                {selectedOrder.items.map((item) => {
                  const options = normalizeOrderOptions(item.options);
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {item.quantity}x {item.productName}
                          </p>
                          <p className="mt-1 text-sm text-muted">Unitario: {formatMoney(item.unitPrice)}</p>
                        </div>
                        <p className="shrink-0 font-black">{formatMoney(item.subtotal)}</p>
                      </div>
                      {options.length ? (
                        <ul className="mt-3 space-y-1 text-sm text-muted">
                          {options.map((option, index) => (
                            <li key={`${item.id}-${index}`}>
                              {option.groupName ? `${option.groupName}: ` : ""}
                              {option.optionName}
                              {option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-2xl font-black">Total: {formatMoney(selectedOrder.total)}</p>
                <button className="btn-primary" type="button" onClick={() => printOrder(selectedOrder)}>
                  <Printer size={18} /> Imprimir pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
