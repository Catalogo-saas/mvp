"use client";

/* eslint-disable @next/next/no-img-element */

import clsx from "clsx";
import { Check, Copy, ImageIcon, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import type { CSSProperties, Dispatch, FormEvent, SetStateAction } from "react";

import type { CartItem, StorefrontCategory, StorefrontProduct, StorefrontStore } from "@/components/public-store";
import { getDiscountPercent, getEffectiveProductPrice, type StoreTemplate } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import styles from "./baby-storefront.module.css";

type BabyTemplate = Extract<StoreTemplate, `baby-${string}`>;

export type BabyStorefrontController = {
  store: StorefrontStore;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  template: BabyTemplate;
  primary: string;
  accent: string;
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
  remainingStock: (product: StorefrontProduct) => number | null;
  isOutOfStock: (product: StorefrontProduct) => boolean;
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

const copy: Record<BabyTemplate, {
  announcement: string;
  eyebrow: string;
  fallbackTitle: string;
  fallbackSubtitle: string;
  action: string;
  categoryEyebrow: string;
  categoryTitle: string;
  catalogTitle: string;
  search: string;
  cart: string;
  add: string;
}> = {
  "baby-natural": { announcement: "Ropa · Calzado · Accesorios para los más pequeños", eyebrow: "Pequeños comienzos", fallbackTitle: "Suave desde el primer día.", fallbackSubtitle: "Prendas, calzado y accesorios cómodos para acompañar cada descubrimiento.", action: "Ver productos", categoryEyebrow: "Explorá por categoría", categoryTitle: "Todo para crecer", catalogTitle: "La colección", search: "Buscar productos", cart: "Tu carrito", add: "Agregar" },
  "baby-atelier": { announcement: "Una selección para acompañar sus primeros momentos", eyebrow: "La nueva colección", fallbackTitle: "Primeros recuerdos.", fallbackSubtitle: "Una selección delicada de prendas y accesorios para vestir cada pequeño momento.", action: "Descubrir la colección", categoryEyebrow: "Una edición para cada momento", categoryTitle: "La selección Petit", catalogTitle: "Piezas elegidas", search: "Buscar en la colección", cart: "Tu selección", add: "Agregar" },
  "baby-mini": { announcement: "Ropa · Calzado · Accesorios · Pedidos por WhatsApp", eyebrow: "Hola, mundo", fallbackTitle: "Listos para explorar.", fallbackSubtitle: "Comodidad, color y mucha personalidad para sus primeras aventuras.", action: "Ver todo", categoryEyebrow: "Elegí su próxima aventura", categoryTitle: "Explorá Mundo Mini", catalogTitle: "Todo para jugar", search: "¿Qué estás buscando?", cart: "Tu carrito", add: "Agregar" },
  "baby-cielito": { announcement: "Ropa · Calzado · Accesorios para acompañar sus primeros días", eyebrow: "Un mundo suavecito", fallbackTitle: "Tan dulce como sus sueños.", fallbackSubtitle: "Ropita, calzado y accesorios elegidos para abrazar cada pequeño momento.", action: "Ver la colección", categoryEyebrow: "Tres rinconcitos para descubrir", categoryTitle: "Elegí entre las nubes", catalogTitle: "Pequeños favoritos", search: "Buscar algo lindo", cart: "Mi carrito", add: "Agregar" },
  "baby-bosque": { announcement: "Prendas y detalles para historias que recién comienzan", eyebrow: "Capítulo uno", fallbackTitle: "Había una vez un pequeño gran amor.", fallbackSubtitle: "Una colección cálida de ropa, calzado y accesorios para acompañar sus primeras historias.", action: "Abrir la colección", categoryEyebrow: "Seguí el caminito", categoryTitle: "Tres capítulos para explorar", catalogTitle: "La colección del bosque", search: "Buscar en el bosque", cart: "Mi carrito", add: "Sumar a la canastita" },
  "baby-abrazo": { announcement: "Todo lo lindo para envolver sus primeros momentos", eyebrow: "Hecho para abrazar", fallbackTitle: "Un pedacito de ternura.", fallbackSubtitle: "Prendas suaves, primeros pasos y pequeños accesorios reunidos como una manta de recuerdos.", action: "Descubrir todo", categoryEyebrow: "Cada retazo guarda algo especial", categoryTitle: "Armá su pequeño mundo", catalogTitle: "Favoritos para abrazar", search: "Buscar productos", cart: "Mi carrito", add: "Agregar al carrito" }
};

function unitPrice(product: StorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce((total, group) => total + group.options.reduce((sum, option) => selected.has(option.id) ? sum + option.priceDelta : sum, 0), getEffectiveProductPrice(product));
}

function Price({ product }: { product: StorefrontProduct }) {
  const discount = getDiscountPercent(product);
  return <span className={styles.price}>{discount ? <del>{formatMoney(product.basePrice)}</del> : null}<b>{formatMoney(getEffectiveProductPrice(product))}</b>{discount ? <mark>{discount}% OFF</mark> : null}</span>;
}

function Logo({ store }: { store: StorefrontStore }) {
  return <span className={styles.logo}>{store.logoUrl ? <img src={store.logoUrl} alt="" /> : null}<b>{store.name}</b></span>;
}

export function BabyStorefront({ controller: c }: { controller: BabyStorefrontController }) {
  const text = copy[c.template];
  const facts = [
    "Pedidos simples por WhatsApp",
    c.store.address || (c.store.acceptTransferPayments ? "Efectivo o transferencia" : "Pago en efectivo"),
    c.store.businessHoursText || c.store.availability.label
  ];

  return <div data-template={c.template} className={styles.storefront} style={{ "--template-primary": c.primary, "--template-accent": c.accent } as CSSProperties}>
    <div className={styles.announcement}>{c.store.freeShippingEnabled ? `Envío gratis en pedidos desde ${formatMoney(c.store.freeShippingThreshold)}` : text.announcement}</div>
    <header className={styles.siteHeader}><div className={clsx(styles.wrap, styles.nav)}>
      <button className={styles.brandButton} type="button" onClick={() => { c.setCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Logo store={c.store} /></button>
      <nav className={styles.navLinks} aria-label="Categorías">{c.categories.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => c.selectCategory(item.slug)}>{item.name}</button>)}</nav>
      <div className={styles.navTools}><button className={styles.tool} type="button" onClick={() => { document.getElementById("baby-search")?.focus(); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={14} /> Buscar</button><button className={clsx(styles.tool, styles.cartButton)} type="button" onClick={c.openCart}><ShoppingBag size={14} /> {c.template === "baby-bosque" ? "Canastita" : "Carrito"} · <b>{c.cartCount}</b></button></div>
    </div></header>

    <main>
      <BabyHero c={c} text={text} />
      <section className={clsx(styles.wrap, styles.facts)}>{facts.map((fact) => <div key={fact}>{fact}</div>)}</section>
      {!c.store.availability.isOpen ? <div className={clsx(styles.wrap, styles.closed)}>{c.store.availability.label}</div> : null}
      {c.store.showCategories && c.categories.length ? <BabyCategories c={c} text={text} /> : null}
      <section className={clsx(styles.wrap, styles.catalog)} id="catalogo">
        <header className={styles.catalogHead}><h2>{c.category === "all" ? text.catalogTitle : c.category === "promos" ? "Promociones" : c.categories.find((item) => item.slug === c.category)?.name}</h2><b>{c.filteredProducts.length} producto{c.filteredProducts.length === 1 ? "" : "s"}</b></header>
        <div className={styles.catalogTools}><input id="baby-search" type="search" placeholder={text.search} aria-label="Buscar productos" value={c.query} onChange={(event) => c.setQuery(event.target.value)} /><div className={styles.filters}><button className={c.category === "all" ? styles.active : undefined} type="button" onClick={() => c.setCategory("all")}>Todo</button>{c.hasPromos ? <button className={c.category === "promos" ? styles.active : undefined} type="button" onClick={() => c.setCategory("promos")}>Promos</button> : null}{c.categories.map((item) => <button key={item.id} className={c.category === item.slug ? styles.active : undefined} type="button" onClick={() => c.setCategory(item.slug)}>{item.name}</button>)}</div></div>
        <div className={clsx(styles.productGrid, c.mobileProductColumns === 1 && styles.oneMobileColumn)}>{c.filteredProducts.map((product) => <ProductCard key={product.id} product={product} remaining={c.remainingStock(product)} outOfStock={c.isOutOfStock(product)} onOpen={() => c.quickAdd(product)} />)}</div>
        {!c.filteredProducts.length ? <p className={styles.empty}>No encontramos productos para esa búsqueda.</p> : null}
      </section>
    </main>

    <footer className={styles.footer}><div className={styles.wrap}><Logo store={c.store} /><span>{c.store.address || "Pedidos por WhatsApp"}</span></div></footer>
    {c.activeProduct ? <ProductPanel c={c} product={c.activeProduct} addLabel={text.add} /> : null}
    {c.checkoutOpen ? <CartPanel c={c} title={text.cart} /> : null}
  </div>;
}

function Slides({ c }: { c: BabyStorefrontController }) {
  if (!c.store.heroImageUrls.length) return <span className={styles.heroFallback}><ImageIcon size={48} /></span>;
  return <>{c.store.heroImageUrls.map((url, index) => <img key={`${url}-${index}`} className={index === c.heroIndex ? styles.activeSlide : undefined} src={url} alt="" />)}{c.store.heroImageUrls.length > 1 ? <div className={styles.heroDots}>{c.store.heroImageUrls.map((_, index) => <button key={index} className={index === c.heroIndex ? styles.active : undefined} type="button" onClick={() => c.setHeroIndex(index)} aria-label={`Ver imagen ${index + 1}`} />)}</div> : null}</>;
}

function BabyHero({ c, text }: { c: BabyStorefrontController; text: (typeof copy)[BabyTemplate] }) {
  const content = <><span className={styles.eyebrow}>{text.eyebrow}</span><h1>{c.store.heroTitle || text.fallbackTitle}</h1><p>{c.store.heroSubtitle || c.store.description || text.fallbackSubtitle}</p><button className={styles.primary} type="button" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>{text.action}</button></>;
  if (c.template === "baby-cielito") return <section className={styles.skyHero}><div className={styles.skyStars} aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div><div className={clsx(styles.wrap, styles.skyLayout)}><div className={styles.cloudCopy}>{content}</div><div className={styles.skyPhoto}><i className={styles.moon} aria-hidden="true" /><Slides c={c} /></div></div></section>;
  if (c.template === "baby-bosque") return <section className={clsx(styles.wrap, styles.storybook)}><div className={styles.storyPage}>{content}<svg className={styles.storyIllustration} aria-hidden="true" viewBox="0 0 260 210" fill="none"><path d="M20 198c38-70 82-97 132-80 38 13 66 4 88-27" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/><path d="M66 153c-16-34-8-64 25-91M116 123c1-42 22-72 63-90M160 118c27-24 50-31 70-20" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><ellipse cx="86" cy="58" rx="18" ry="39" transform="rotate(-28 86 58)" fill="currentColor"/><ellipse cx="177" cy="31" rx="17" ry="38" transform="rotate(36 177 31)" fill="currentColor"/><path d="M39 195c18-31 45-39 67-20 13 11 14 24 11 35H31l8-15Z" fill="#c99a72"/><circle cx="67" cy="158" r="28" fill="#c99a72"/></svg></div><div className={styles.storyPhoto}><Slides c={c} /></div></section>;
  if (c.template === "baby-abrazo") return <section className={clsx(styles.wrap, styles.quiltHero)}><div className={styles.quiltCopy}>{content}</div><div className={styles.quiltPhoto}><Slides c={c} /></div><div className={styles.quiltPatch} aria-hidden="true">♡</div><div className={styles.quiltPatch} aria-hidden="true">●</div></section>;
  return <section className={clsx(styles.wrap, styles.hero)}><div className={styles.heroCopy}>{content}</div><div className={styles.heroVisual}><Slides c={c} /></div></section>;
}

function BabyCategories({ c, text }: { c: BabyStorefrontController; text: (typeof copy)[BabyTemplate] }) {
  const cards = c.categories.slice(0, 3).map((item) => <button className={styles.categoryCard} key={item.id} type="button" onClick={() => c.selectCategory(item.slug)}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className={styles.imageFallback}><ImageIcon /></span>}<span>{c.template === "baby-bosque" ? `${item.name} para soñar` : item.name} →</span></button>);
  return <section className={styles.wrap}><header className={styles.sectionTitle}><small>{text.categoryEyebrow}</small><h2>{text.categoryTitle}</h2></header><div className={styles.categories}>{cards}</div></section>;
}

function ProductCard({ product, remaining, outOfStock, onOpen }: { product: StorefrontProduct; remaining: number | null; outOfStock: boolean; onOpen: () => void }) {
  return <article className={styles.productCard}><button className={styles.productOpen} type="button" onClick={onOpen} disabled={outOfStock}><span className={styles.productMedia}>{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} /> : <span className={styles.imageFallback}><ImageIcon /></span>}{getDiscountPercent(product) ? <span className={styles.productTag}>{getDiscountPercent(product)}% OFF</span> : null}{outOfStock ? <span className={styles.productAction}>Sin stock</span> : null}{!outOfStock && product.imageUrls.length > 1 ? <small>{product.imageUrls.length} fotos</small> : null}</span><span className={styles.productCopy}><span><small>{product.category?.name || "Producto"}</small><strong>{product.name}</strong><em>{product.description}</em></span><Price product={product} />{remaining !== null ? <span className={clsx(styles.stock, remaining <= 5 && styles.low)}>{outOfStock ? "Sin stock" : remaining <= 5 ? `Quedan ${remaining} unidades` : "Stock disponible"}</span> : null}</span></button></article>;
}

function ProductPanel({ c, product, addLabel }: { c: BabyStorefrontController; product: StorefrontProduct; addLabel: string }) {
  const remaining = c.remainingStock(product);
  const outOfStock = remaining !== null && remaining <= 0;
  return <div className={styles.shade} onMouseDown={(event) => { if (event.target === event.currentTarget) c.closeProduct(); }}><aside className={styles.panel} role="dialog" aria-modal="true" aria-label={`Agregar ${product.name}`}><div className={styles.panelInner}><button className={styles.close} type="button" onClick={c.closeProduct} aria-label="Cerrar"><X /></button><div className={styles.detailImage}>{c.activeImage ? <img src={c.activeImage} alt={product.name} /> : <span className={styles.imageFallback}><ImageIcon /></span>}</div>{product.imageUrls.length > 1 ? <div className={styles.thumbs}>{product.imageUrls.map((url, index) => <button key={`${url}-${index}`} className={index === c.activeImageIndex ? styles.active : undefined} type="button" onClick={() => c.setActiveImageIndex(index)}><img src={url} alt="" /></button>)}</div> : null}<div className={styles.detailMeta}><div><small>{product.category?.name || "Producto"}</small><h2>{product.name}</h2><p>{product.description}</p></div><Price product={product} /></div>{remaining !== null ? <p className={styles.detailStock}>{outOfStock ? "Sin stock" : `Quedan ${remaining} unidades disponibles`}</p> : null}<div className={styles.optionGroups}>{product.optionGroups.map((group) => <fieldset key={group.id} data-product-option-group data-option-group-id={group.id}><legend>{group.name} {group.isRequired ? <span>*</span> : null}</legend><div>{group.options.filter((option) => option.isAvailable).map((option) => <label key={option.id} className={c.selectedOptionIds.includes(option.id) ? styles.selected : undefined}><input type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={c.selectedOptionIds.includes(option.id)} onChange={() => c.toggleOption(group, option.id)} /><span>{option.name}</span>{option.priceDelta ? <b>+{formatMoney(option.priceDelta)}</b> : null}</label>)}</div></fieldset>)}</div>{c.error ? <p className={styles.error}>{c.error}</p> : null}<button className={styles.addCart} type="button" disabled={outOfStock} onClick={c.addActiveProduct}>{outOfStock ? "Sin stock" : `${addLabel} · ${formatMoney(unitPrice(product, c.selectedOptionIds))}`}</button></div></aside></div>;
}

function CartPanel({ c, title }: { c: BabyStorefrontController; title: string }) {
  const choice = (selected: boolean) => clsx(styles.choice, selected && styles.selected);
  return <div className={styles.shade} onMouseDown={(event) => { if (event.target === event.currentTarget) c.closeCart(); }}><aside className={styles.panel} role="dialog" aria-modal="true" aria-label="Tu carrito"><div className={styles.panelInner}><button className={styles.close} type="button" onClick={c.closeCart} aria-label="Cerrar carrito"><X /></button><h2 className={styles.cartTitle}>{title}</h2><div className={styles.cartLines}>{c.cart.length ? c.cart.map((item) => <article key={item.lineId}><div>{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} /> : <span className={styles.imageFallback}><ImageIcon /></span>}</div><section><strong>{item.productName}</strong><small>{item.optionLabels.join(" · ") || "Sin variantes"}</small><span className={styles.quantity}><button type="button" onClick={() => c.updateQuantity(item.lineId, -1)}><Minus /></button><b>{item.quantity}</b><button type="button" onClick={() => c.updateQuantity(item.lineId, 1)}><Plus /></button></span></section><b>{formatMoney(item.unitPrice * item.quantity)}</b></article>) : <p className={styles.empty}>Tu carrito está vacío.</p>}</div>{c.store.freeShippingEnabled && c.cart.length ? <div className={styles.shipping}>{c.shippingRemaining > 0 ? `Te faltan ${formatMoney(c.shippingRemaining)} para el envío gratis.` : "¡Tu pedido tiene envío gratis!"}<span><i style={{ width: `${c.shippingProgress}%` }} /></span></div> : null}<div className={styles.total}><span>Total</span><b>{formatMoney(c.cartTotal)}</b></div><form className={styles.checkoutForm} onSubmit={c.submitOrder}><fieldset><legend>Datos de contacto</legend><label>Nombre completo<input name="customerName" autoComplete="name" minLength={2} required /></label><label>Teléfono<input name="customerPhone" type="tel" autoComplete="tel" minLength={6} required /></label></fieldset><fieldset><legend>Método de entrega</legend><div className={styles.twoChoices}><label className={choice(c.fulfillmentMethod === "pickup")}><input type="radio" checked={c.fulfillmentMethod === "pickup"} onChange={() => c.setFulfillmentMethod("pickup")} />Retiro</label><label className={choice(c.fulfillmentMethod === "delivery")}><input type="radio" checked={c.fulfillmentMethod === "delivery"} onChange={() => c.setFulfillmentMethod("delivery")} />Envío</label></div>{c.fulfillmentMethod === "delivery" ? <label>Domicilio<input name="deliveryAddress" autoComplete="street-address" minLength={5} required /></label> : <p>{c.store.address || "Dirección a coordinar"}</p>}</fieldset><fieldset><legend>Método de pago</legend><div className={styles.twoChoices}><label className={choice(c.paymentMethod === "cash")}><input type="radio" checked={c.paymentMethod === "cash"} onChange={() => c.setPaymentMethod("cash")} />Efectivo</label>{c.store.acceptTransferPayments ? <label className={choice(c.paymentMethod === "transfer")}><input type="radio" checked={c.paymentMethod === "transfer"} onChange={() => c.setPaymentMethod("transfer")} />Transferencia</label> : null}</div>{c.paymentMethod === "transfer" && c.store.acceptTransferPayments ? <PaymentDetails c={c} /> : null}</fieldset><label>Notas<textarea name="notes" rows={3} maxLength={500} /></label>{c.error ? <p className={styles.error}>{c.error}</p> : null}<button className={styles.whatsapp} disabled={c.loading || !c.cart.length || !c.store.availability.isOpen}>{c.loading ? "Creando pedido..." : c.store.availability.isOpen ? "Enviar pedido por WhatsApp" : "Tienda cerrada"}</button></form></div></aside></div>;
}

function PaymentDetails({ c }: { c: BabyStorefrontController }) {
  return <dl className={styles.paymentDetails}>{c.store.paymentProvider ? <div><dt>Banco o billetera</dt><dd>{c.store.paymentProvider}</dd></div> : null}{c.store.paymentAccountHolder ? <div><dt>Titular</dt><dd>{c.store.paymentAccountHolder}</dd></div> : null}{c.store.paymentAlias ? <div><dt>Alias</dt><dd>{c.store.paymentAlias}</dd><button type="button" onClick={() => c.copyPaymentDetail("alias", c.store.paymentAlias!)}>{c.copiedField === "alias" ? <Check /> : <Copy />}</button></div> : null}{c.store.paymentCbu ? <div><dt>CBU / CVU</dt><dd>{c.store.paymentCbu}</dd><button type="button" onClick={() => c.copyPaymentDetail("cbu", c.store.paymentCbu!)}>{c.copiedField === "cbu" ? <Check /> : <Copy />}</button></div> : null}</dl>;
}
