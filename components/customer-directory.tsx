"use client";

import Link from "next/link";
import { CalendarDays, MessageCircle, Search, ShoppingBag, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import type { CustomerSummary } from "@/lib/customer-summary";

export function CustomerDirectory({ customers }: { customers: CustomerSummary[] }) {
  const [query, setQuery] = useState("");
  const visibleCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) => [customer.name, customer.phone, customer.normalizedPhone, customer.lastOrderCode].join(" ").toLowerCase().includes(normalized));
  }, [customers, query]);

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
          <span className="sr-only">Buscar clientes</span>
          <input className="field !pl-11" type="search" placeholder="Buscar por nombre, teléfono o pedido" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <p className="mt-3 text-sm font-semibold text-muted">{visibleCustomers.length} cliente{visibleCustomers.length === 1 ? "" : "s"}</p>
      </section>

      {visibleCustomers.length ? (
        <section className="grid gap-3">
          {visibleCustomers.map((customer) => (
            <article className="panel p-5" key={customer.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Users className="shrink-0 text-brand" size={18} /><h2 className="truncate text-lg font-black">{customer.name}</h2></div>
                  <p className="mt-1 text-sm font-semibold text-muted">{customer.phone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="btn-secondary !px-3 !py-2" href={`https://wa.me/${customer.normalizedPhone}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
                  <Link className="btn-primary !px-3 !py-2" href={`/gestion/pedidos?q=${encodeURIComponent(customer.phone)}`}><ShoppingBag size={16} /> Pedidos</Link>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
                <div><dt className="text-xs font-bold text-muted">Pedidos</dt><dd className="mt-1 font-black">{customer.orderCount}</dd></div>
                <div><dt className="text-xs font-bold text-muted">Total comprado</dt><dd className="mt-1 font-black">{formatMoney(customer.totalSpent)}</dd></div>
                <div className="col-span-2 sm:col-span-1"><dt className="flex items-center gap-1 text-xs font-bold text-muted"><CalendarDays size={13} /> Última compra</dt><dd className="mt-1 text-sm font-black">{formatBuenosAiresDate(customer.lastOrderAt)} · #{customer.lastOrderCode}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel grid place-items-center p-10 text-center"><Users className="text-muted" size={32} /><h2 className="mt-3 font-black">No encontramos clientes</h2><p className="mt-1 text-sm text-muted">Probá con otro nombre o teléfono.</p></section>
      )}
    </div>
  );
}
