"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const OrderReadContext = createContext<{ count: number; readIds: Set<string>; markRead: (id: string) => Promise<void> }>({ count: 0, readIds: new Set<string>(), markRead: async () => {} });

export function OrderReadProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [count, setCount] = useState(initialCount);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const pathname = usePathname();
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = revision.current;
    try {
      const response = await fetch("/api/admin/orders/unread", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (!controller.signal.aborted && revision.current === version) setCount(data.count);
    } catch { /* Retain the last confirmed count while offline. */ }
  }, []);

  const markRead = useCallback(async (id: string) => {
    request.current?.abort();
    revision.current += 1;
    const version = revision.current;
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/read`, { method: "POST" });
    if (!response.ok) throw new Error("No se pudo marcar la venta como leída.");
    const data = await response.json();
    request.current?.abort();
    setReadIds(current => new Set(current).add(id));
    if (revision.current === version) setCount(data.count);
    revision.current += 1;
    window.dispatchEvent(new Event("orders-read-changed"));
  }, []);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("orders-read-changed", onFocus);
    return () => {
      disposed = true;
      clearInterval(timer);
      request.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("orders-read-changed", onFocus);
    };
  }, [pathname, refresh]);

  return <OrderReadContext.Provider value={{ count, readIds, markRead }}>{children}</OrderReadContext.Provider>;
}

export const useOrderRead = () => useContext(OrderReadContext);
