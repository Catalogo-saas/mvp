"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ImageIcon, Link as LinkIcon, Share2, ShoppingBag } from "lucide-react";
import type { StorefrontCategory, StorefrontProduct, StorefrontStore } from "./public-store";
import { StorefrontPageNav } from "./storefront-page-nav";
import { StorefrontCartDrawer } from "./storefront-cart-drawer";
import { StorefrontFooter } from "./storefront-footer";
import { addOrIncrementCartItem, useStorefrontCart } from "./storefront-cart";
import { storefrontAppearance } from "./storefront-appearance";
import { normalizeDesignConfig } from "@/lib/design-config";
import { normalizeCheckoutSettings } from "@/lib/commerce-settings";
import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { calculateSelectedPrice, remainingSelectedStock, shouldShowLowStockNotice } from "@/lib/storefront-product-selection";
import { normalizeVariants, selectedVariantKey } from "@/lib/product-variants";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import styles from "./storefront-product-page.module.css";
import storefrontStyles from "./commerce-storefront.module.css";
import { DemoNotice } from "./storefront-demo-notice";

export function StorefrontProductPage({ store, product, related, categories, signedIn }: {
  store: StorefrontStore; product: StorefrontProduct; related: StorefrontProduct[]; categories: StorefrontCategory[]; signedIn: boolean;
}) {
  const { cart, changeCart, cartCount, cartTotal } = useStorefrontCart(store.slug);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    if (!linkCopied) return;
    const timeout = window.setTimeout(() => setLinkCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [linkCopied]);
  const design = normalizeDesignConfig(store.designConfig);
  const checkout = normalizeCheckoutSettings(store.checkoutSettings);
  const variant = normalizeVariants(product.variants).find(item => item.key === selectedVariantKey(product.optionGroups, selectedOptionIds) && item.isVisible);
  const image = variant?.imageUrl || product.imageUrls[imageIndex];
  const remaining = remainingSelectedStock(product, selectedOptionIds, cart);
  const missingSelection = product.optionGroups.some(group => group.isRequired && !group.options.some(option => selectedOptionIds.includes(option.id)));
  const variants = normalizeVariants(product.variants);
  const unavailable = !missingSelection && remaining !== null && remaining <= 0 || variants.length > 0 && variants.every(item => !item.isVisible || item.stockQuantity === 0);
  const hasCompleteSelection = !missingSelection && (!variants.length || Boolean(variant));
  const showLowStockNotice = checkout.showLowStock && shouldShowLowStockNotice(remaining, checkout.lowStockThreshold, hasCompleteSelection);
  const price = calculateSelectedPrice(product, selectedOptionIds);
  const toggleOption = (group: StorefrontProduct["optionGroups"][number], id: string) => {
    setSelectedOptionIds(current => current.filter(item => !group.options.some(option => option.id === item)).concat(id));
    setMessage("");
  };
  function add() {
    const missing = product.optionGroups.find(group => group.isRequired && !selectedOptionIds.some(id => group.options.some(option => option.id === id)));
    if (missing) { setMessage(`Elegí ${missing.name} para continuar.`); return; }
    if (unavailable) { setMessage("No hay stock disponible para esta opción."); return; }
    const labels = product.optionGroups.flatMap(group => group.options.filter(option => selectedOptionIds.includes(option.id)).map(option => `${group.name}: ${option.name}`));
    changeCart(current => addOrIncrementCartItem(current, { lineId: crypto.randomUUID(), productId: product.id, productName: product.name, imageUrl: image || null, quantity: 1, selectedOptionIds, optionLabels: labels, unitPrice: price }));
    setCartOpen(true);
    setMessage("");
  }
  function updateQuantity(lineId: string, delta: number) {
    changeCart(current => current.map(item => {
      if (item.lineId !== lineId) return item;
      if (delta > 0 && item.productId === product.id) {
        const available = remainingSelectedStock(product, item.selectedOptionIds, current);
        if (available !== null && available <= 0) { setMessage("No hay más stock disponible."); return item; }
      }
      return { ...item, quantity: Math.max(0, item.quantity + delta) };
    }).filter(item => item.quantity > 0));
  }
  function continueOrder() {
    if (store.whatsappOrdersEnabled) {
      const lines = [`Hola ${store.name}, quisiera hacer un pedido:`, ...cart.map(item => `• ${item.quantity}x ${item.productName}${item.optionLabels.length ? ` (${item.optionLabels.join(", ")})` : ""} — ${formatMoney(item.unitPrice * item.quantity)}`), `Total: ${formatMoney(cartTotal)}`];
      window.location.assign(`https://wa.me/${normalizeWhatsAppPhone(store.whatsappPhone)}?text=${encodeURIComponent(lines.join("\n"))}`);
    } else window.location.assign(`/${store.slug}/compra`);
  }
  async function copyProductLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setShareOpen(false);
    } catch { setMessage("No se pudo copiar el enlace. Copiá la URL desde el navegador."); }
  }
  function shareOnWhatsApp() {
    const url = new URL("https://wa.me/");
    url.searchParams.set("text", `${product.name} ${window.location.href}`);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    setShareOpen(false);
  }
  function shareOnFacebook() {
    const url = new URL("https://www.facebook.com/sharer/sharer.php");
    url.searchParams.set("u", window.location.href);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    setShareOpen(false);
  }
  return <div {...storefrontAppearance(store)}>
    {checkout.demoMode && <DemoNotice/>}
    <StorefrontPageNav store={store} categories={categories.map(item => ({ ...item, parentId: item.parentId ?? null }))} signedIn={signedIn} cartCount={cartCount} onCart={() => setCartOpen(true)}/>
    <main className={styles.main}>
      <nav className={styles.breadcrumb} aria-label="Ubicación"><Link href={`/${store.slug}`}>Inicio</Link><span>/</span><Link href={`/${store.slug}/productos`}>Productos</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
      <div className={styles.layout}>
        <section className={styles.gallery} aria-label="Imágenes del producto"><div className={styles.heroImage}>{image ? <img src={image} alt={product.name}/> : <ImageIcon size={50}/ >}{getDiscountPercent(product) && <span className={styles.discount}>−{getDiscountPercent(product)}%</span>}</div>{product.imageUrls.length > 1 && <div className={styles.thumbnails}>{product.imageUrls.map((url,index) => <button key={`${url}-${index}`} type="button" aria-label={`Ver foto ${index+1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}><img src={url} alt=""/></button>)}</div>}</section>
        <section className={styles.details}><p className={styles.category}>{product.category?.name || "Producto"}</p><h1>{product.name}</h1>{product.sku && design.showSku && <p className={styles.sku}>SKU: {product.sku}</p>}<div className={styles.price}><strong>{formatMoney(price)}</strong>{getDiscountPercent(product) && <del>{formatMoney(product.basePrice)}</del>}</div><p className={styles.description}>{product.description}</p>
          {product.optionGroups.map(group => <fieldset className={styles.options} key={group.id}><legend>{group.name}{group.isRequired ? " *" : ""}</legend><div>{group.options.filter(option => option.isAvailable).map(option => <label key={option.id}><input type="radio" name={group.id} checked={selectedOptionIds.includes(option.id)} onChange={() => toggleOption(group,option.id)}/><span>{option.name}{option.priceDelta ? ` · +${formatMoney(option.priceDelta)}` : ""}</span></label>)}</div></fieldset>)}
          {unavailable ? <p className={styles.notice}>Sin stock para esta opción.</p> : showLowStockNotice ? <p className={styles.notice}>Quedan {remaining} unidades.</p> : null}
          {message && <p className={styles.notice} role="status">{message}</p>}<div className={styles.actions}><button className={styles.add} type="button" disabled={unavailable} onClick={add}><ShoppingBag size={19}/> {unavailable ? "Sin stock" : "Agregar al carrito"}</button><div className={styles.shareWrap} onKeyDown={event => { if (event.key === "Escape") setShareOpen(false); }}><button className={styles.share} data-copied={linkCopied} type="button" onClick={() => setShareOpen(open => !open)} aria-label={linkCopied ? "Enlace copiado" : "Compartir producto"} aria-expanded={shareOpen} aria-haspopup="menu"><Share2 className={styles.shareIcon} size={20}/><Check className={styles.copiedIcon} size={20}/></button>{shareOpen && <div className={styles.shareMenu} role="menu" aria-label="Compartir producto"><button type="button" role="menuitem" onClick={shareOnWhatsApp}><img src="/social/whatsapp.svg" alt=""/> WhatsApp</button><button type="button" role="menuitem" onClick={() => void copyProductLink()}><img src="/social/instagram.svg" alt=""/> Instagram</button><button type="button" role="menuitem" onClick={shareOnFacebook}><img src="/social/facebook.svg" alt=""/> Facebook</button><button type="button" role="menuitem" onClick={() => void copyProductLink()}><LinkIcon size={17}/> Copiar link</button></div>}</div></div>
        </section>
      </div>
      {related.length > 0 && <section className={styles.related}><h2>También te puede gustar</h2><div>{related.map(item => <Link key={item.id} href={`/${store.slug}/producto/${item.slug}`}><span>{item.imageUrls[0] ? <img src={item.imageUrls[0]} alt=""/> : <ImageIcon size={30}/>}</span><strong>{item.name}</strong><small>{formatMoney(getEffectiveProductPrice(item))}</small></Link>)}</div></section>}
    </main>
    <StorefrontFooter store={store}/>
    {design.floatingCartEnabled&&cartCount>0&&<button type="button" className={storefrontStyles.cartBar} onClick={() => setCartOpen(true)}><span><ShoppingBag size={18}/>{cartCount} {cartCount===1?"producto":"productos"}</span><strong>{formatMoney(cartTotal)}</strong></button>}
    <StorefrontCartDrawer open={cartOpen} slug={store.slug} items={cart} total={cartTotal} whatsapp={store.whatsappOrdersEnabled} onClose={() => setCartOpen(false)} onQuantity={updateQuantity} onRemove={lineId => changeCart(current => current.filter(item => item.lineId !== lineId))} onOrder={continueOrder}/>
  </div>;
}
