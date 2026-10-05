"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ImageIcon, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import type { StorefrontCategory, StorefrontProduct, StorefrontStore } from "@/components/public-store";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { getCatalogPrices, getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import { normalizeCheckoutSettings, normalizePaymentMethods } from "@/lib/commerce-settings";
import { normalizeDesignConfig } from "@/lib/design-config";
import { createBannerItem, featuredCategoryLayoutSlots, getBannerItems, normalizePublicPageConfig, safeBannerLink, type HomeSection } from "@/lib/public-page-config";
import { purchaseInfoIcon } from "@/lib/purchase-info-icon-options";
import { categoryPath } from "@/lib/category-tree";
import { formatMoney } from "@/lib/money";
import { calculateSelectedPrice, remainingSelectedStock } from "@/lib/storefront-product-selection";
import styles from "./commerce-storefront.module.css";
import { storefrontAppearance } from "./storefront-appearance";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader } from "./storefront-header";
import { DemoNotice, StromCategories, StromHero, StromWholesale } from "./strom-storefront";
import type { StoreTemplate } from "@/lib/catalog";

type Template = StoreTemplate;
type Props = {
  mode: "home" | "catalog"; template: Template; store: StorefrontStore; products: StorefrontProduct[]; featuredProducts: StorefrontProduct[]; hasPromos: boolean; filteredProducts: StorefrontProduct[];
  categories: StorefrontCategory[]; allCategories: StorefrontCategory[]; showcaseCategories: StorefrontCategory[];
  category: string; query: string; sort: string; totalProducts: number; hasMore: boolean; catalogLoading: boolean; catalogError: string; onLoadMore: () => void; cartCount: number; cartTotal: number;
  onQuery: (query: string) => void; onCategory: (slug: string) => void; onSort: (sort: string) => void;
  onOpen: (product: StorefrontProduct) => void; onCart: () => void; onQuickAdd: (product: StorefrontProduct, selectedOptionIds: string[]) => void;
  remaining: (product: StorefrontProduct) => number | null; outOfStock: (product: StorefrontProduct) => boolean; children: ReactNode;
};

export function CommerceStorefront(c: Props) {
  const { store, template } = c;
  const design = normalizeDesignConfig(store.designConfig);
  const page = normalizePublicPageConfig(store.publicPageConfig);
  const payments = normalizeCheckoutSettings(store.checkoutSettings);
  const appearance = storefrontAppearance(store);
  const [filterOpen, setFilterOpen] = useState(false);
  useLockBodyScroll(filterOpen);
  useEffect(() => {
    if (!filterOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFilterOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filterOpen]);
  const href = (path: string) => path.startsWith("http") ? path : "/" + store.slug + (path === "/" ? "" : path);
  const catalog = (query = c.query) => { if (c.mode === "home" && !store.isPreview) window.location.assign(href("/productos" + (query.trim() ? "?q=" + encodeURIComponent(query.trim()) : ""))); else document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); };
  const navigatePreview = (event: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (!store.isPreview) return;
    event.preventDefault();
    if (path === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else catalog();
  };
  const announcement = page.announcement.enabled ? page.announcement.text : store.freeShippingEnabled ? "Envío gratis desde " + formatMoney(store.freeShippingThreshold) : "";
  const discountedPayment = normalizePaymentMethods(store).find(method => method.enabled && method.discountPercent > 0);
  const discount = discountedPayment ? { percent: discountedPayment.discountPercent, label: discountedPayment.name } : null;
  const paymentMessage = discount ? discount.percent + "% de descuento pagando con " + discount.label : "";
  const featuredProducts = (c.featuredProducts.length ? c.featuredProducts : c.products).slice(0, template === "vene" ? 8 : 4);
  const sortedProducts = store.isPreview ? [...c.filteredProducts].sort((a,b) => c.sort === "price-asc" ? getEffectiveProductPrice(a)-getEffectiveProductPrice(b) : c.sort === "price-desc" ? getEffectiveProductPrice(b)-getEffectiveProductPrice(a) : c.sort === "name" ? a.name.localeCompare(b.name) : 0) : c.filteredProducts;
  function productCard(product: StorefrontProduct) {
    const offer = getDiscountPercent(product);
    const stock = c.remaining(product);
    const unavailable = c.outOfStock(product);
    return <article className={styles.productCard} key={product.id} style={{ borderRadius: design.cardRadius }}>
      <div className={styles.productImageWrap}><button className={styles.productImageOpen} type="button" aria-label={`Ver ${product.name}`} onClick={() => c.onOpen(product)}>
        <span className={styles.productMedia} style={{ aspectRatio: design.productImageRatio === "square" ? "1" : "4/5", borderRadius: design.cardRadius }}>
          {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} loading="lazy" style={{ objectFit: design.productImageFit }} /> : <span className={styles.imageFallback}><ImageIcon size={32}/></span>}
          {product.imageUrls[1] && <img className={styles.secondImage} src={product.imageUrls[1]} alt="" loading="lazy" style={{ objectFit: design.productImageFit }}/>}
          <span className={styles.productBadges}>{unavailable ? <span>Sin stock</span> : null}{offer ? <span>−{offer}%</span> : null}</span>
        </span>
      </button>{design.quickBuyEnabled && <ProductQuickBuy product={product} unavailable={unavailable} preview={Boolean(store.isPreview)} onOpen={() => c.onOpen(product)} onAdd={selectedOptionIds => c.onQuickAdd(product, selectedOptionIds)}/>}</div>
      <button className={styles.productOpen} type="button" onClick={() => c.onOpen(product)}>
        <span className={styles.productName}>{product.name}</span>
        {design.showSku && product.sku && <span className={styles.sku}>SKU: {product.sku}</span>}
        <span className={styles.price}><strong>{formatMoney(getEffectiveProductPrice(product))}</strong>{offer && <del>{formatMoney(getCatalogPrices(product).regular)}</del>}</span>
        {discount && <span className={styles.paymentPrice}>{formatMoney(Math.round(getEffectiveProductPrice(product)*(1-discount.percent/100)))} <small>con {discount.label}</small></span>}
        {payments.showLowStock && stock !== null && stock > 0 && stock <= payments.lowStockThreshold && <span className={styles.sku}>Quedan {stock} unidades</span>}
      </button>
    </article>;
  }
  function categoryFilters() {
    return <fieldset><legend>Categorías</legend>
      <label><input type="radio" name="store-category" checked={c.category === "all"} onChange={() => c.onCategory("all")}/><span>Todos los productos</span></label>
      {c.hasPromos && <label><input type="radio" name="store-category" checked={c.category === "promos"} onChange={() => c.onCategory("promos")}/><span>Promociones</span></label>}
      {c.allCategories.map(item => <label key={item.id}><input type="radio" name="store-category" checked={c.category === item.slug} onChange={() => c.onCategory(item.slug)}/><span>{categoryPath(item.id,c.allCategories.map(category => ({...category,parentId:category.parentId ?? null})))}</span></label>)}
    </fieldset>;
  }
  function sortSelect() {
    return <select value={c.sort} onChange={event => c.onSort(event.target.value)}><option value="default">Más nuevo al más viejo</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre: A–Z</option></select>;
  }
  return <div {...appearance} style={{ ...appearance.style, "--mobile-columns": store.mobileProductColumns === 2 ? 2 : 1 } as CSSProperties}>
    {announcement && <div className={styles.announcement}>{announcement}</div>}
    {template === "dana" && paymentMessage && <div className={styles.paymentAnnouncement}>{paymentMessage}</div>}
    <StorefrontHeader store={store} categories={c.allCategories} cartCount={c.cartCount} query={c.query} onQuery={c.onQuery} onCart={c.onCart} onSearch={catalog} paymentMessage={template === "vene" ? paymentMessage : ""}/>
    <main>
      {c.mode === "home" ? page.homeSections.filter(section => section.enabled).map(section => {
        if (section.type === "banners") return template === "strom" ? <StromHero key={section.id} section={section} store={store}/> : <HomeBanner key={section.id} section={section} store={store}/>;
        if (section.type === "purchaseInfo") return section.infoItems.length ? <PurchaseInfoCarousel key={section.id} section={section}/> : null;
        if (section.type === "featuredCategories") {
          if (template === "strom") return <StromCategories key={section.id} section={section} store={store} categories={c.allCategories}/>;
          const categoryById = new Map(c.allCategories.map(item => [item.id, item]));
          const configuredTiles = section.categoryTiles ?? (section.categoryIds.length
            ? section.categoryIds.map((categoryId, index) => ({ id: `legacy-${index + 1}`, categoryId, title: "", imageUrl: section.categoryImages[categoryId] ?? "" }))
            : c.allCategories.filter(item => !item.parentId).map((item, index) => ({ id: `root-${index + 1}-${item.id}`, categoryId: item.id, title: "", imageUrl: section.categoryImages[item.id] ?? "" })));
          const tiles = configuredTiles.flatMap(tile => {
            const category = categoryById.get(tile.categoryId);
            return category ? [{ id: tile.id, category, title: tile.title || category.name, imageUrl: tile.imageUrl || section.categoryImages[category.id] || category.imageUrl }] : [];
          });
          const groupSize = featuredCategoryLayoutSlots[section.categoryLayout];
          const groups = Array.from({ length: Math.ceil(tiles.length / groupSize) }, (_, index) => tiles.slice(index * groupSize, (index + 1) * groupSize));
          const categoryColors = section.categoryColors;
          const categoryStyle = categoryColors ? {
            "--category-caption-bg": categoryColors.mode === "primary" ? "var(--store-primary)" : categoryColors.mode === "secondary" ? "var(--store-accent)" : categoryColors.mode === "custom" ? categoryColors.background : "var(--store-background)",
            "--category-caption-ink": categoryColors.mode === "primary" ? "var(--store-primary-ink)" : categoryColors.mode === "secondary" ? "var(--store-accent-ink)" : categoryColors.mode === "custom" ? categoryColors.text : "var(--store-text)"
          } as CSSProperties : undefined;
          return tiles.length ? <section key={section.id} className={styles.section} aria-label="Categorías destacadas"><div className={styles.categoryMosaic} data-spacing={section.categorySpacing} style={categoryStyle}>{groups.map(group => <div className={styles.categoryMosaicGroup} data-layout={section.categoryLayout} data-count={group.length} data-partial={group.length < groupSize} key={group[0].id}>{group.map(tile => <a key={tile.id} href={href("/productos?categoria=" + encodeURIComponent(tile.category.slug))} className={styles.categoryMosaicCard} onClick={event => { if (store.isPreview) event.preventDefault(); }}>{tile.imageUrl ? <img src={tile.imageUrl} alt="" loading="lazy"/> : <span className={styles.categoryMosaicPlaceholder}><ImageIcon size={32}/></span>}<span>{tile.title}</span></a>)}</div>)}</div></section> : null;
        }
        const available = [...c.products, ...c.featuredProducts].filter((product,index,array) => array.findIndex(item => item.id === product.id) === index);
        const chosen = section.productIds.length ? section.productIds.map(id => available.find(product => product.id === id)).filter((product): product is StorefrontProduct => Boolean(product)) : featuredProducts;
        return chosen.length ? <section key={section.id} className={styles.section}><h2>{section.title}</h2>{section.description && <p className={styles.sectionDescription}>{section.description}</p>}<div className={section.layout === "carousel" ? styles.featuredCarousel : styles.featuredGrid}>{chosen.map(productCard)}</div></section> : null;
      }) : <section id="catalogo" className={`${styles.section} ${styles.catalogSection}`}>
        <div className={styles.catalogHeadingRow}>
          <h1 className={styles.catalogHeading}>{c.category === "all" ? "Todos los productos" : c.category === "promos" ? "Promociones" : c.allCategories.find(item => item.slug === c.category)?.name || "Productos"}</h1>
          <button className={`${styles.filterButton} ${styles.mobileFilterButton}`} type="button" aria-expanded={filterOpen} aria-controls="mobile-filter-panel" onClick={() => setFilterOpen(value => !value)}><span>Filtrar</span><SlidersHorizontal size={17}/>{c.category !== "all" ? <span className={styles.filterDot}/> : null}</button>
          <label className={`${styles.sortControl} ${styles.desktopSort}`}>Ordenar por<select value={c.sort} onChange={event => c.onSort(event.target.value)}><option value="default">Más nuevo al más viejo</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre: A–Z</option></select></label>
        </div>
        <div className={styles.catalogLayout}>
          <aside className={styles.filterSidebar} aria-label="Filtrar productos">
            <div className={styles.filterSidebarTitle}>Filtrar por</div>
            {categoryFilters()}
          </aside>
          <div className={styles.catalogResults}>
            <p className={styles.resultCount}>{c.totalProducts} {c.totalProducts === 1 ? "producto" : "productos"}</p>
            <div className={styles.productGrid}>{sortedProducts.map(productCard)}</div>
            {!sortedProducts.length && !c.catalogLoading && <p className={styles.empty}>No encontramos productos. Probá otra búsqueda o categoría.</p>}
            {c.catalogError && <p className={styles.empty} role="alert">{c.catalogError}</p>}
            {c.hasMore && <button type="button" className={styles.loadMore} disabled={c.catalogLoading} onClick={c.onLoadMore}>{c.catalogLoading ? "Cargando…" : "Ver más productos"}</button>}
          </div>
        </div>
      </section>}
      {c.mode === "home" && template === "strom" && <StromWholesale store={store}/>}
      {payments.demoMode && <DemoNotice/>}
      {!store.availability.isOpen && <p className={styles.closed}>{store.availability.label}</p>}
    </main>
    {filterOpen && <div className={styles.filterOverlay} onMouseDown={event => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
      <aside id="mobile-filter-panel" className={styles.filterPanel} role="dialog" aria-modal="true" aria-label="Filtros">
        <div className={styles.filterPanelHeader}><h2>FILTROS</h2><button type="button" aria-label="Cerrar filtros" onClick={() => setFilterOpen(false)}><X size={21}/></button></div>
        <label className={`${styles.sortControl} ${styles.mobileSort}`}>Ordenar por{sortSelect()}</label>
        <div className={styles.filterPanelBody}><h3>Filtrar por</h3>{categoryFilters()}</div>
      </aside>
    </div>}
    <StorefrontFooter store={store} onNavigatePreview={navigatePreview} />
    {design.floatingCartEnabled&&c.cartCount>0&&<button type="button" className={styles.cartBar} onClick={c.onCart}><span><ShoppingBag size={18}/>{c.cartCount} {c.cartCount===1?"producto":"productos"}</span><strong>{formatMoney(c.cartTotal)}</strong></button>}
    {c.children}
  </div>;
}

function HomeBanner({ section, store }: { section: HomeSection; store: StorefrontStore }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setMobile(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const configured = getBannerItems(section);
  const all = section.bannerItems !== undefined ? section.bannerItems : configured.length ? configured : store.heroImageUrls.map((imageUrl, index) => createBannerItem(imageUrl, `store-hero-${index + 1}`));
  const visible = all.filter(item => mobile ? item.mobile : item.desktop);
  const activeIndex = heroIndex % Math.max(visible.length, 1);
  const active = visible[activeIndex];
  useEffect(() => {
    if (!section.bannerAutoplay || visible.length < 2 || paused) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) setHeroIndex((activeIndex + 1) % visible.length); }, section.bannerInterval * 1000);
    return () => window.clearInterval(timer);
  }, [section.bannerAutoplay, section.bannerInterval, visible.length, paused, activeIndex]);
  if (!active?.imageUrl) return null;
  const title = active.title;
  const description = active.description;
  const link = safeBannerLink(active?.link ?? "", store.slug);
  const personalized = Boolean(section.bannerItems?.length);
  const style = active ? { "--banner-overlay": active.backgroundColor, "--banner-ink": active.textColor } as CSSProperties : undefined;
  return <section className={styles.hero} data-has-image="true" data-has-copy={Boolean(title || description)} data-height={section.bannerHeight} data-personalized={personalized} data-position={active.position} data-fit-background={active.fitBackgroundToText} style={style} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <img src={active.imageUrl} alt="" className={styles.heroImage} fetchPriority="high"/>
    {link && <a href={link} className={styles.heroClick} aria-label={title ? `Abrir ${title}` : `Abrir enlace del banner ${activeIndex + 1}`} onClick={event => { if (store.isPreview) event.preventDefault(); }}/>} 
    {(title || description) && <div className={styles.heroCopy}><div className={styles.heroCopyContent}>{title && <h1>{title}</h1>}{description && <p>{description}</p>}</div></div>}
    {visible.length > 1 && <div className={styles.heroControls}><div className={styles.dots}>{visible.map((_, index) => <button type="button" key={index} aria-label={`Ver imagen ${index + 1}`} aria-pressed={activeIndex === index} onClick={() => setHeroIndex(index)}/>)}</div></div>}
  </section>;
}

function PurchaseInfoCarousel({ section }: { section: HomeSection }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemCount = section.infoItems.length;
  useEffect(() => {
    if (itemCount < 2) return;
    const mobile = window.matchMedia("(max-width: 900px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const syncAutoplay = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = mobile.matches && !reducedMotion.matches ? window.setInterval(() => {
        if (document.visibilityState === "visible") setActiveIndex(current => (current + 1) % itemCount);
      }, 1500) : undefined;
    };
    syncAutoplay();
    mobile.addEventListener("change", syncAutoplay);
    reducedMotion.addEventListener("change", syncAutoplay);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      mobile.removeEventListener("change", syncAutoplay);
      reducedMotion.removeEventListener("change", syncAutoplay);
    };
  }, [itemCount]);

  const colors = section.infoColors.mode === "primary" ? { background: "var(--store-primary)", text: "var(--store-primary-ink)" } : section.infoColors.mode === "secondary" ? { background: "var(--store-accent)", text: "var(--store-accent-ink)" } : section.infoColors.mode === "custom" ? { background: section.infoColors.background, text: section.infoColors.text } : { background: "var(--store-background)", text: "var(--store-text)" };
  return <section className={styles.info} data-carousel={itemCount > 1} aria-label="Información de compra" style={{ "--info-background": colors.background, "--info-text": colors.text, "--info-count": itemCount } as CSSProperties}>
    <div className={styles.infoSlides}>{section.infoItems.map((item, index) => { const Icon = purchaseInfoIcon(item.icon); return <article key={`${item.title}-${index}`} data-active={index === activeIndex}><Icon size={28}/><div><h2>{item.title}</h2><p>{item.text}</p></div></article>; })}</div>
    {itemCount > 1 && <div className={styles.infoDots} role="group" aria-label="Elegir información de compra">{section.infoItems.map((item, index) => <button key={`${item.title}-${index}`} type="button" aria-label={`Mostrar ${item.title}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)}/>)}</div>}
  </section>;
}

function ProductQuickBuy({ product, unavailable, preview, onOpen, onAdd }: { product: StorefrontProduct; unavailable: boolean; preview: boolean; onOpen: () => void; onAdd: (selectedOptionIds: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const optionGroups = product.optionGroups.filter(group => group.options.length > 0);
  const hasOptions = optionGroups.length > 0;
  const missingRequired = optionGroups.some(group => group.isRequired && !selectedOptionIds.some(id => group.options.some(option => option.id === id)));
  const price = calculateSelectedPrice(product, selectedOptionIds);
  const stock = remainingSelectedStock(product, selectedOptionIds, []);
  const soldOut = unavailable || stock !== null && stock <= 0;
  function select(group: StorefrontProduct["optionGroups"][number], optionId: string) {
    setSelectedOptionIds(current => {
      if (group.selectionType === "SINGLE") return current.filter(id => !group.options.some(option => option.id === id)).concat(optionId);
      if (current.includes(optionId)) return current.filter(id => id !== optionId);
      const selectedInGroup = current.filter(id => group.options.some(option => option.id === id));
      if (group.maxSelections !== null && selectedInGroup.length >= group.maxSelections) return current;
      return [...current, optionId];
    });
  }
  return <div className={styles.quickBuy} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    <button className={styles.productBag} type="button" aria-label={`Compra rápida: ${product.name}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><ShoppingBag size={19}/></button>
    {open && <div className={styles.quickBuyMenu} role="group" aria-label={`Compra rápida de ${product.name}`}>
      <button className={styles.quickBuyClose} type="button" aria-label="Cerrar compra rápida" onClick={() => setOpen(false)}><X size={18}/></button>
      {hasOptions ? <><strong>Elegí una opción</strong>{optionGroups.map(group => <fieldset key={group.id}><legend>{group.name}{group.isRequired ? " · *" : ""}</legend>{group.selectionType === "SINGLE" ? <label className={styles.quickBuySelect}><select aria-label={group.name} value={selectedOptionIds.find(id => group.options.some(option => option.id === id)) ?? ""} onChange={event => { if (event.target.value) select(group,event.target.value); }}><option value="">Seleccionar</option>{group.options.map(option => <option key={option.id} value={option.id} disabled={!option.isAvailable}>{option.name}{option.priceDelta ? ` · +${formatMoney(option.priceDelta)}` : ""}</option>)}</select><ChevronDown size={17}/></label> : group.options.map(option => <label key={option.id}><input type="checkbox" checked={selectedOptionIds.includes(option.id)} disabled={!option.isAvailable || !selectedOptionIds.includes(option.id) && group.maxSelections !== null && selectedOptionIds.filter(id => group.options.some(groupOption => groupOption.id === id)).length >= group.maxSelections} onChange={() => select(group,option.id)}/>{option.name}</label>)}</fieldset>)}<small>{formatMoney(price)}</small></> : <strong>{formatMoney(price)}</strong>}
      <button className={styles.quickBuyAdd} type="button" disabled={soldOut || missingRequired || preview} onClick={() => { onAdd(selectedOptionIds); setOpen(false); setSelectedOptionIds([]); }}>{soldOut ? "Sin stock" : "Agregar"}</button>
      <button className={styles.quickBuyDetails} type="button" onClick={() => { setOpen(false); onOpen(); }}>Ver más detalles</button>
    </div>}
  </div>;
}
