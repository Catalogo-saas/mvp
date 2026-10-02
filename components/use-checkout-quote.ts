"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { buildCheckoutQuote } from "@/lib/checkout-quote";
import type { StorefrontCartItem } from "./storefront-cart";

export type CheckoutQuote = Awaited<ReturnType<typeof buildCheckoutQuote>>["quote"];
type ChangeCart = (update: (items: StorefrontCartItem[]) => StorefrontCartItem[]) => void;
export function cartQuoteLines(cart: StorefrontCartItem[]) {
  return cart.map(item => ({ lineId: item.lineId, productId: item.productId, quantity: item.quantity, selectedOptionIds: item.selectedOptionIds }));
}

export function useCheckoutQuote(slug: string, cart: StorefrontCartItem[], changeCart: ChangeCart, active: boolean, selection: { paymentMethodId?: string; deliveryMethodId?: string } = {}) {
  const linesJson = JSON.stringify(cartQuoteLines(cart));
  const inputJson = JSON.stringify({ storeSlug: slug, items: JSON.parse(linesJson), ...(selection.paymentMethodId ? { paymentMethodId: selection.paymentMethodId } : {}), ...(selection.deliveryMethodId ? { deliveryMethodId: selection.deliveryMethodId } : {}) });
  const [state, setState] = useState<{ key: string; quote: CheckoutQuote | null; error: string }>({ key: "", quote: null, error: "" });
  const [pending, setPending] = useState(false);
  const request = useRef<{ controller: AbortController; sequence: number } | null>(null);
  const sequence = useRef(0);

  const applyQuote = useCallback((quote: CheckoutQuote) => {
    const inputLines = JSON.parse(linesJson) as ReturnType<typeof cartQuoteLines>;
    const mapped = {
      ...quote,
      items: quote.items.map(item => ({ ...item, lineId: item.lineId || inputLines[item.lineIndex]?.lineId || "" })),
      issueDetails: quote.issueDetails.map(issue => ({ ...issue, lineId: issue.lineId ?? (issue.lineIndex === undefined ? null : inputLines[issue.lineIndex]?.lineId ?? null) }))
    };
    changeCart(current => {
      if (JSON.stringify(cartQuoteLines(current)) !== linesJson) return current;
      const byId = new Map(mapped.items.map(item => [item.lineId, item]));
      return current.map(item => {
        const verified = byId.get(item.lineId);
        return verified ? { ...item, productName: verified.productName, imageUrl: verified.imageUrl, unitPrice: verified.unitPrice, optionLabels: verified.optionLabels } : item;
      });
    });
    setState({ key: inputJson, quote: mapped, error: "" });
  }, [changeCart, inputJson, linesJson]);

  const refresh = useCallback(async (): Promise<CheckoutQuote | null> => {
    request.current?.controller.abort();
    const controller = new AbortController();
    const id = ++sequence.current;
    request.current = { controller, sequence: id };
    setPending(true);
    try {
      const response = await fetch("/api/storefront/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: inputJson, signal: controller.signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos verificar el carrito.");
      if (controller.signal.aborted || id !== sequence.current) return null;
      // Cross-tab cart updates can precede React's next effect cleanup.
      const stored = JSON.parse(localStorage.getItem(`storefront-cart:${slug}`) || "[]") as StorefrontCartItem[];
      if (JSON.stringify(cartQuoteLines(stored)) !== linesJson) return null;
      applyQuote(result);
      return result;
    } catch (error) {
      if (!controller.signal.aborted && id === sequence.current) setState({ key: inputJson, quote: null, error: error instanceof Error ? error.message : "No pudimos verificar el carrito." });
      return null;
    } finally { if (id === sequence.current) setPending(false); }
  }, [applyQuote, inputJson, linesJson, slug]);

  useEffect(() => {
    if (!active || !cart.length) return;
    const timer = window.setTimeout(() => { void refresh(); }, 250);
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearTimeout(timer);
      request.current?.controller.abort();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [active, cart.length, refresh]);

  const quote = state.key === inputJson ? state.quote : null;
  const error = state.key === inputJson ? state.error : "";
  return { quote, error, refresh, applyQuote, verifying: active && cart.length > 0 && (pending || !quote && !error) };
}
