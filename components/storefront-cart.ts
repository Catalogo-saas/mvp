"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type StorefrontCartItem = {
  lineId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  selectedOptionIds: string[];
  optionLabels: string[];
  unitPrice: number;
};

export function addOrIncrementCartItem(current: StorefrontCartItem[], incoming: StorefrontCartItem) {
  const selectedKey = (ids: string[]) => [...ids].sort().join("\u0000");
  const key = selectedKey(incoming.selectedOptionIds);
  const existing = current.find(item => item.productId === incoming.productId && selectedKey(item.selectedOptionIds) === key);
  if (!existing) return [...current, incoming];
  return current.map(item => item.lineId === existing.lineId ? {
    ...item,
    productName: incoming.productName,
    imageUrl: incoming.imageUrl,
    quantity: item.quantity + incoming.quantity,
    selectedOptionIds: incoming.selectedOptionIds,
    optionLabels: incoming.optionLabels,
    unitPrice: incoming.unitPrice
  } : item);
}

const eventName = "storefront-cart-change";
const keyFor = (slug: string) => `storefront-cart:${slug}`;

function readCart(raw: string): StorefrontCartItem[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is StorefrontCartItem => Boolean(item && typeof item === "object" &&
      typeof item.lineId === "string" && typeof item.productId === "string" &&
      typeof item.productName === "string" && Number.isInteger(item.quantity) && item.quantity > 0 &&
      Number.isFinite(item.unitPrice) && Array.isArray(item.selectedOptionIds) && item.selectedOptionIds.every((id: unknown) => typeof id === "string") && Array.isArray(item.optionLabels) && item.optionLabels.every((label: unknown) => typeof label === "string")));
  } catch { return []; }
}

export function useStorefrontCart(slug: string) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(eventName, notify);
    return () => { window.removeEventListener("storage", notify); window.removeEventListener(eventName, notify); };
  }, []);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(keyFor(slug)) || "[]", () => "[]");
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const cart = useMemo(() => readCart(raw), [raw]);

  const changeCart = useCallback((update: (current: StorefrontCartItem[]) => StorefrontCartItem[]) => {
    const next = update(readCart(localStorage.getItem(keyFor(slug)) || "[]"));
    if (JSON.stringify(next) === (localStorage.getItem(keyFor(slug)) || "[]")) return;
    localStorage.setItem(keyFor(slug), JSON.stringify(next));
    window.dispatchEvent(new Event(eventName));
  }, [slug]);

  return { cart, ready, changeCart, cartCount: cart.reduce((sum, item) => sum + item.quantity, 0), cartTotal: cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) };
}
