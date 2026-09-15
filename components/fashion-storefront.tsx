"use client";

/* eslint-disable @next/next/no-img-element */

import clsx from "clsx";
import { Check, Copy, ImageIcon, Minus, Plus, Search, Share2, ShoppingBag, X } from "lucide-react";
import type { CSSProperties, Dispatch, FormEvent, SetStateAction } from "react";

import type { CartItem, StorefrontCategory, StorefrontProduct, StorefrontStore } from "@/components/public-store";
import { StorefrontBrandSection, StoreSocialLinks } from "@/components/storefront-brand-content";
import { getDefaultCategoryTitle, getDiscountPercent, getEffectiveProductPrice, type StoreTemplate } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { normalizePublicPageConfig } from "@/lib/public-page-config";
import { calculateSelectedPrice } from "@/lib/storefront-product-selection";
import styles from "./fashion-storefront.module.css";

type FashionController = {
  store: StorefrontStore;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  showcaseCategories: StorefrontCategory[];
  template: StoreTemplate;
  primary: string;
  accent: string;
  heroImage?: string;
  heroIndex: number;
  query: string;
  category: string;
  hasPromos: boolean;
  filteredProducts: StorefrontProduct[];
  mobileProductColumns: 1 | 2;
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  activeProduct: StorefrontProduct | null;
  activeImage?: string;
  activeImageIndex: number;
  selectedOptionIds: string[];
  checkoutOpen: boolean;
  fulfillmentMethod: "pickup" | "delivery";
  paymentMethod: "cash" | "transfer";
  copiedField: "alias" | "cbu" | null;
  shippingRemaining: number;
  shippingProgress: number;
  error: string;
  loading: boolean;
  setHeroIndex: (index: number) => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setCategory: Dispatch<SetStateAction<string>>;
  selectCategory: (slug: string) => void;
  quickAdd: (product: StorefrontProduct) => void;
  shareProduct: (product: StorefrontProduct) => void;
  remainingStock: (product: StorefrontProduct, optionIds?: string[]) => number | null;
  isOutOfStock: (product: StorefrontProduct) => boolean;
  isOptionSelectable: (product: StorefrontProduct, group: StorefrontProduct["optionGroups"][number], optionId: string) => boolean;
  closeProduct: () => void;
  setActiveImageIndex: (index: number) => void;
  toggleOption: (group: StorefrontProduct["optionGroups"][number], optionId: string) => void;
  addActiveProduct: () => void;
  openCart: () => void;
  closeCart: () => void;
  updateQuantity: (lineId: string, delta: number) => void;
  setFulfillmentMethod: Dispatch<SetStateAction<"pickup" | "delivery">>;
  setPaymentMethod: Dispatch<SetStateAction<"cash" | "transfer">>;
  copyPaymentDetail: (field: "alias" | "cbu", value: string) => void;
  submitOrder: (event: FormEvent<HTMLFormElement>) => void;
};

function Price({ product }: { product: StorefrontProduct }) {
  const discount = getDiscountPercent(product);
  return <span className={styles.price}>{discount ? <del>{formatMoney(product.basePrice)}</del> : null}<b>{formatMoney(getEffectiveProductPrice(product))}</b>{discount ? <mark>{discount}% OFF</mark> : null}</span>;
}

function Logo({ store }: { store: StorefrontStore }) {
  return <span className={styles.logo}>{store.logoUrl ? <img src={store.logoUrl} alt="" /> : null}<b>{store.name}</b></span>;
}

export function FashionStorefront({ controller: c }: { controller: FashionController }) {
  const pageConfig = normalizePublicPageConfig(c.store.publicPageConfig);
  const facts = [
    "Pedidos simples por WhatsApp",
    c.store.address || (c.store.acceptTransferPayments ? "Efectivo o transferencia" : "Pago en efectivo"),
    c.store.businessHoursText || c.store.availability.label
  ];
  const sectionCopy = c.template === "beauty-pop"
    ? { eyebrow: "Elegí tu universo", categories: "Explorá tu estilo", catalog: "Todo para vos", hero: "Nueva energía" }
    : c.template === "boutique-soft"
      ? { eyebrow: "Una selección para vos", categories: "Encontrá eso que te encanta", catalog: "La tienda", hero: "Elegidos para vos" }
      : { eyebrow: "Categorías", categories: "Una edición para cada momento", catalog: "La selección", hero: "Nueva colección" };

  return <div data-template={c.template} className={styles.storefront} style={{ "--template-primary": c.primary, "--template-accent": c.accent, "--store-primary": c.primary, "--store-accent": c.accent } as CSSProperties}>
    <div className={styles.announcement}>{pageConfig.announcement.enabled && pageConfig.announcement.text ? pageConfig.announcement.text : c.store.freeShippingEnabled ? `Envío gratis en pedidos desde ${formatMoney(c.store.freeShippingThreshold)}` : "Selección online · Pedidos por WhatsApp"}</div>
    <header className={styles.siteHeader}>
      <div className={clsx(styles.wrap, styles.nav)}>
        <button className={styles.brandButton} type="button" onClick={() => { c.setCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Logo store={c.store} /></button>
        <nav className={styles.navLinks} aria-label="Categorías">{c.categories.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => c.selectCategory(item.slug)}>{item.name}</button>)}</nav>
        <div className={styles.tools}><button type="button" onClick={() => { document.getElementById("fashion-search")?.focus(); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={14} /> Buscar</button><button className={styles.cartButton} type="button" onClick={c.openCart}><ShoppingBag size={14} /> Carrito <b>{c.cartCount}</b></button></div>
      </div>
    </header>

    <main>
      <section className={clsx(styles.hero, c.template !== "premium-minimal" && styles.wrap)}>
        <div className={clsx(styles.heroCopy, c.template === "premium-minimal" && styles.wrap)}><span className={styles.eyebrow}>{sectionCopy.hero}</span><h1>{c.store.heroTitle || c.store.name}</h1><p>{c.store.heroSubtitle || c.store.description || "Elegí tus favoritos y confirmá el pedido directamente por WhatsApp."}</p><button className={styles.primary} type="button" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Ver productos</button></div>
        <div className={styles.heroVisual}>{c.heroImage ? <img src={c.heroImage} alt="" /> : <span><ImageIcon size={48} /></span>}<div className={styles.heroDots}>{c.store.heroImageUrls.length > 1 ? c.store.heroImageUrls.map((_, index) => <button key={index} className={index === c.heroIndex ? styles.active : undefined} type="button" onClick={() => c.setHeroIndex(index)} aria-label={`Ver imagen ${index + 1}`} />) : null}</div></div>
      </section>

      <section className={clsx(styles.wrap, styles.facts)}>{facts.map((fact) => <div key={fact}>{fact}</div>)}</section>
      {!c.store.availability.isOpen ? <div className={clsx(styles.wrap, styles.closed)}>{c.store.availability.label}</div> : null}

      {pageConfig.sections.map((section) => {
        if (section === "categories") return c.store.showCategories && c.showcaseCategories.length ? <FashionCategories key={section} c={c} eyebrow={sectionCopy.eyebrow} title={pageConfig.categoriesTitle || getDefaultCategoryTitle(c.template)} /> : null;
        if (section === "catalog") return <FashionCatalog key={section} c={c} title={sectionCopy.catalog} />;
        return <StorefrontBrandSection key={section} section={section} store={c.store} products={c.products} onOpenProduct={c.quickAdd} />;
      })}
    </main>

    <footer className={styles.footer}><div className={styles.wrap}><div className={styles.footerBrand}><Logo store={c.store} /><span>{c.store.address || "Pedidos por WhatsApp"}</span></div><StoreSocialLinks store={c.store} /></div></footer>
    {c.activeProduct ? <ProductPanel c={c} product={c.activeProduct} /> : null}
    {c.checkoutOpen ? <CartPanel c={c} /> : null}
  </div>;
}

function FashionCategories({ c, eyebrow, title }: { c: FashionController; eyebrow: string; title: string }) {
  return <section className={styles.wrap}><header className={styles.sectionTitle}><div><small>{eyebrow}</small><h2>{title}</h2></div></header><div className={styles.categories}>{c.showcaseCategories.map((item) => <button className={styles.categoryCard} key={item.id} type="button" onClick={() => c.selectCategory(item.slug)}><img src={item.imageUrl!} alt="" /><span>{item.name} →</span></button>)}</div></section>;
}

function FashionCatalog({ c, title }: { c: FashionController; title: string }) {
  return <section className={clsx(styles.wrap, styles.catalog)} id="catalogo">
    <header className={styles.catalogHead}><h2>{c.category === "all" ? title : c.category === "promos" ? "Promociones" : c.categories.find((item) => item.slug === c.category)?.name}</h2><b>{c.filteredProducts.length} producto{c.filteredProducts.length === 1 ? "" : "s"}</b></header>
    <div className={styles.catalogTools}><label><input id="fashion-search" type="search" placeholder={c.template === "premium-minimal" ? "Buscar en la colección" : "Buscar productos"} value={c.query} onChange={(event) => c.setQuery(event.target.value)} /></label><div className={styles.filters}><button className={c.category === "all" ? styles.active : undefined} type="button" onClick={() => c.setCategory("all")}>Todo</button>{c.hasPromos ? <button className={c.category === "promos" ? styles.active : undefined} type="button" onClick={() => c.setCategory("promos")}>Promos</button> : null}{c.categories.map((item) => <button key={item.id} className={c.category === item.slug ? styles.active : undefined} type="button" onClick={() => c.setCategory(item.slug)}>{item.name}</button>)}</div></div>
    <div className={clsx(styles.productGrid, c.mobileProductColumns === 1 && styles.oneMobileColumn)}>{c.filteredProducts.map((product) => <FashionProductCard key={product.id} product={product} remaining={c.remainingStock(product)} outOfStock={c.isOutOfStock(product)} onOpen={() => c.quickAdd(product)} />)}</div>
    {!c.filteredProducts.length ? <p className={styles.empty}>No encontramos productos con esos filtros.</p> : null}
  </section>;
}

function FashionProductCard({ product, remaining, outOfStock, onOpen }: { product: StorefrontProduct; remaining: number | null; outOfStock: boolean; onOpen: () => void }) {
  return <article className={styles.productCard}><button className={styles.productOpen} type="button" onClick={onOpen}><span className={styles.productMedia}>{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} /> : <span className={styles.imageFallback}><ImageIcon /></span>}{getDiscountPercent(product) ? <span className={styles.productTag}>{getDiscountPercent(product)}% OFF</span> : null}{outOfStock ? <span className={styles.productAction}>Sin stock</span> : null}{!outOfStock && product.imageUrls.length > 1 ? <small>{product.imageUrls.length} fotos</small> : null}</span><span className={styles.productCopy}><span><small>{product.category?.name || "Producto"}</small><strong>{product.name}</strong><em>{product.description}</em></span><Price product={product} />{remaining !== null ? <span className={clsx(styles.stock, remaining <= 5 && styles.low)}>{outOfStock ? "Sin stock · Ver detalle" : remaining <= 5 ? `Quedan ${remaining} unidades` : "Stock disponible"}</span> : null}</span></button></article>;
}

function ProductPanel({ c, product }: { c: FashionController; product: StorefrontProduct }) {
  const remaining = c.remainingStock(product, c.selectedOptionIds);
  const outOfStock = remaining !== null && remaining <= 0;
  const pageConfig = normalizePublicPageConfig(c.store.publicPageConfig);
  const sizeGuide = pageConfig.info.sizeGuide;
  const related = c.products.filter((item) => item.id !== product.id && item.category?.id === product.category?.id).slice(0, 3);
  return (
    <div className={styles.shade} onMouseDown={(event) => { if (event.target === event.currentTarget) c.closeProduct(); }}>
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-label={`Detalle de ${product.name}`}>
        <div className={styles.panelInner}>
          <div className={styles.detailActions}><span>Detalle del producto</span><div><button className={styles.close} type="button" onClick={() => c.shareProduct(product)} aria-label="Compartir producto"><Share2 /></button><button data-dialog-close className={styles.close} type="button" onClick={c.closeProduct} aria-label="Cerrar"><X /></button></div></div>
          <div className={styles.detailImage}>{c.activeImage ? <img src={c.activeImage} alt={product.name} /> : <span className={styles.imageFallback}><ImageIcon /></span>}</div>
          {product.imageUrls.length > 1 ? <div className={styles.thumbs}>{product.imageUrls.map((url, index) => <button key={`${url}-${index}`} className={index === c.activeImageIndex ? styles.active : undefined} type="button" onClick={() => c.setActiveImageIndex(index)}><img src={url} alt="" /></button>)}</div> : null}
          <div className={styles.detailMeta}><div><small>{product.category?.name || "Producto"}</small><h2>{product.name}</h2><p>{product.description}</p></div><Price product={product} /></div>
          {remaining !== null ? <p className={styles.detailStock}>{outOfStock ? "Sin stock por el momento" : `Quedan ${remaining} unidades disponibles`}</p> : null}
          <div className={styles.optionGroups}>{product.optionGroups.map((group) => <fieldset key={group.id} data-product-option-group data-option-group-id={group.id}><legend>{group.name} {group.isRequired ? <span>*</span> : null}</legend><div>{group.options.filter((option) => option.isAvailable).map((option) => { const disabled = !c.isOptionSelectable(product, group, option.id); return <label key={option.id} className={clsx(c.selectedOptionIds.includes(option.id) && styles.selected, disabled && "cursor-not-allowed opacity-40")}><input type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={c.selectedOptionIds.includes(option.id)} disabled={disabled} onChange={() => c.toggleOption(group, option.id)} /><span>{option.name}</span>{option.priceDelta ? <b>+{formatMoney(option.priceDelta)}</b> : null}</label>; })}</div></fieldset>)}</div>
          {sizeGuide ? <details className="my-5 border-y border-black/10 py-4"><summary className="cursor-pointer text-sm font-black">Guía de talles</summary><p className="mt-3 whitespace-pre-line text-sm leading-6 opacity-70">{sizeGuide}</p></details> : null}
          {c.error ? <p className={styles.error}>{c.error}</p> : null}
          <button className={styles.addCart} type="button" disabled={outOfStock} onClick={c.addActiveProduct}>{outOfStock ? "Sin stock" : `Agregar · ${formatMoney(calculateSelectedPrice(product, c.selectedOptionIds))}`}</button>
          {related.length ? <section className="mt-7 border-t border-black/10 pt-5"><h3 className="text-sm font-black">También te puede gustar</h3><div className="mt-3 grid grid-cols-3 gap-2">{related.map((item) => <button className="min-w-0 text-left" key={item.id} type="button" onClick={() => c.quickAdd(item)}>{item.imageUrls[0] ? <img className="aspect-square w-full object-cover" src={item.imageUrls[0]} alt="" /> : null}<span className="mt-2 block truncate text-xs font-black">{item.name}</span></button>)}</div></section> : null}
        </div>
      </aside>
    </div>
  );
}

function CartPanel({ c }: { c: FashionController }) {
  const choice = (selected: boolean) => clsx(styles.choice, selected && styles.selected);
  return <div className={styles.shade} onMouseDown={(event) => { if (event.target === event.currentTarget) c.closeCart(); }}><aside className={styles.panel} role="dialog" aria-modal="true" aria-label="Tu carrito"><div className={styles.panelInner}><button className={styles.close} type="button" onClick={c.closeCart} aria-label="Cerrar carrito"><X /></button><h2 className={styles.cartTitle}>Tu carrito</h2><div className={styles.cartLines}>{c.cart.length ? c.cart.map((item) => <article key={item.lineId}><div>{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} /> : <span className={styles.imageFallback}><ImageIcon /></span>}</div><section><strong>{item.productName}</strong><small>{item.optionLabels.join(" · ") || "Sin variantes"}</small><span className={styles.quantity}><button type="button" onClick={() => c.updateQuantity(item.lineId, -1)}><Minus /></button><b>{item.quantity}</b><button type="button" onClick={() => c.updateQuantity(item.lineId, 1)}><Plus /></button></span></section><b>{formatMoney(item.unitPrice * item.quantity)}</b></article>) : <p className={styles.empty}>Tu carrito está vacío.</p>}</div>{c.store.freeShippingEnabled && c.cart.length ? <div className={styles.shipping}>{c.shippingRemaining > 0 ? `Te faltan ${formatMoney(c.shippingRemaining)} para el envío gratis.` : "¡Tu pedido tiene envío gratis!"}<span><i style={{ width: `${c.shippingProgress}%` }} /></span></div> : null}<div className={styles.total}><span>Total</span><b>{formatMoney(c.cartTotal)}</b></div><form className={styles.checkoutForm} onSubmit={c.submitOrder}><fieldset><legend>Datos de contacto</legend><label>Nombre completo<input name="customerName" autoComplete="name" minLength={2} required /></label><label>Teléfono<input name="customerPhone" type="tel" autoComplete="tel" minLength={6} required /></label></fieldset><fieldset><legend>Método de entrega</legend><div className={styles.twoChoices}><label className={choice(c.fulfillmentMethod === "pickup")}><input type="radio" checked={c.fulfillmentMethod === "pickup"} onChange={() => c.setFulfillmentMethod("pickup")} />Retiro</label><label className={choice(c.fulfillmentMethod === "delivery")}><input type="radio" checked={c.fulfillmentMethod === "delivery"} onChange={() => c.setFulfillmentMethod("delivery")} />Envío</label></div>{c.fulfillmentMethod === "delivery" ? <label>Domicilio<input name="deliveryAddress" autoComplete="street-address" minLength={5} required /></label> : <p>{c.store.address || "Dirección a coordinar"}</p>}</fieldset><fieldset><legend>Método de pago</legend><div className={styles.twoChoices}><label className={choice(c.paymentMethod === "cash")}><input type="radio" checked={c.paymentMethod === "cash"} onChange={() => c.setPaymentMethod("cash")} />Efectivo</label>{c.store.acceptTransferPayments ? <label className={choice(c.paymentMethod === "transfer")}><input type="radio" checked={c.paymentMethod === "transfer"} onChange={() => c.setPaymentMethod("transfer")} />Transferencia</label> : null}</div>{c.paymentMethod === "transfer" && c.store.acceptTransferPayments ? <PaymentDetails c={c} /> : null}</fieldset><label>Notas<textarea name="notes" rows={3} maxLength={500} /></label>{c.error ? <p className={styles.error}>{c.error}</p> : null}<button className={styles.whatsapp} disabled={c.loading || !c.cart.length || !c.store.availability.isOpen}>{c.loading ? "Creando pedido..." : c.store.availability.isOpen ? "Enviar pedido por WhatsApp" : "Tienda cerrada"}</button></form></div></aside></div>;
}

function PaymentDetails({ c }: { c: FashionController }) {
  return <dl className={styles.paymentDetails}>{c.store.paymentProvider ? <div><dt>Banco o billetera</dt><dd>{c.store.paymentProvider}</dd></div> : null}{c.store.paymentAccountHolder ? <div><dt>Titular</dt><dd>{c.store.paymentAccountHolder}</dd></div> : null}{c.store.paymentAlias ? <div><dt>Alias</dt><dd>{c.store.paymentAlias}</dd><button type="button" onClick={() => c.copyPaymentDetail("alias", c.store.paymentAlias!)}>{c.copiedField === "alias" ? <Check /> : <Copy />}</button></div> : null}{c.store.paymentCbu ? <div><dt>CBU / CVU</dt><dd>{c.store.paymentCbu}</dd><button type="button" onClick={() => c.copyPaymentDetail("cbu", c.store.paymentCbu!)}>{c.copiedField === "cbu" ? <Check /> : <Copy />}</button></div> : null}</dl>;
}
