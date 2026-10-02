"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { StorefrontCartItem } from "./storefront-cart";
import { useStorefrontCart } from "./storefront-cart";
import { useCheckoutQuote } from "./use-checkout-quote";
import { StorefrontQuantityValue } from "./storefront-quantity-value";
import styles from "./storefront-cart-drawer.module.css";

export function StorefrontCartDrawer({ open, slug, items, total, whatsapp, onClose, onQuantity, onRemove, onOrder, error }: {
  open: boolean; slug: string; items: StorefrontCartItem[]; total: number; whatsapp: boolean;
  onClose: () => void; onQuantity: (lineId: string, delta: number) => void; onRemove: (lineId: string) => void;
  onOrder: () => void; error?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  const { changeCart } = useStorefrontCart(slug);
  const verified = useCheckoutQuote(slug, items, changeCart, open && !whatsapp);
  const [notice, setNotice] = useState("");
  const [continuing, setContinuing] = useState(false);
  async function continuePurchase() {
    if (whatsapp) { onOrder(); return; }
    setContinuing(true);
    const fresh = await verified.refresh();
    setContinuing(false);
    if (!fresh?.valid) return;
    if (fresh.totals.productSubtotal !== verified.quote?.totals.productSubtotal) {
      setNotice("Actualizamos los precios. Revisá el carrito y volvé a continuar.");
      return;
    }
    onOrder();
  }
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]"));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-label="Mi carrito" tabIndex={-1}>
      <header className={styles.header}><h2>Mi carrito</h2><button type="button" onClick={onClose} aria-label="Cerrar carrito"><X size={22}/></button></header>
      <div className={styles.body}>
        {items.length ? <><div className={styles.items}>{items.map(item => <article className={styles.item} key={item.lineId}>
          <div className={styles.image}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <ShoppingBag size={25}/>}</div>
          <div className={styles.itemContent}><div className={styles.itemHeading}><div><strong>{item.productName}</strong>{item.optionLabels.length > 0 && <p>{item.optionLabels.join(" · ")}</p>}</div><button type="button" onClick={() => onRemove(item.lineId)} aria-label={`Eliminar ${item.productName}`}><Trash2 size={19}/></button></div>
            <div className={styles.itemBottom}><div className={styles.quantity} role="group" aria-label={`Cantidad de ${item.productName}`}><button type="button" onClick={() => onQuantity(item.lineId,-1)} aria-label={`Quitar una unidad de ${item.productName}`}><Minus size={16}/></button><StorefrontQuantityValue quantity={item.quantity} verifying={verified.verifying} productName={item.productName}/><button type="button" onClick={() => onQuantity(item.lineId,1)} aria-label={`Agregar una unidad de ${item.productName}`}><Plus size={16}/></button></div><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>
          </div>
        </article>)}</div><div className={styles.subtotal}><strong>Subtotal <small>(sin envío)</small></strong><strong>{formatMoney(total)}</strong></div></> : <p className={styles.empty}>Tu carrito está vacío. Explorá los productos y agregá tus favoritos.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!whatsapp && verified.quote?.issueDetails.map((issue, index) => <p className={styles.error} role="alert" key={`${issue.lineId}-${index}`}>{issue.message}{issue.availableQuantity !== undefined && issue.availableQuantity !== null ? ` Disponibles: ${issue.availableQuantity}.` : ""}</p>)}
        {!whatsapp && verified.error && <p className={styles.error} role="alert">{verified.error} <button type="button" onClick={() => void verified.refresh()}>Reintentar</button></p>}
        {notice && <p role="status">{notice}</p>}
      </div>
      <footer className={styles.footer}><div className={styles.total}><strong>Total <small>(sin envío)</small></strong><strong>{formatMoney(whatsapp ? total : verified.quote?.totals.productSubtotal ?? total)}</strong></div><button className={styles.primary} type="button" disabled={!items.length || continuing || !whatsapp && (verified.verifying || !verified.quote?.valid || Boolean(verified.error))} onClick={() => void continuePurchase()}>{whatsapp ? "Realizar pedido" : "Realizar compra"}</button><a className={styles.secondary} href={`/${slug}/productos`} onClick={onClose}>Ver más productos</a></footer>
    </section>
  </div>;
}
