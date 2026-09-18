"use client";

/* eslint-disable @next/next/no-img-element */

import clsx from "clsx";
import { Check, Copy, ImageIcon, MapPin, Minus, Plus, Search, Share2, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { getDefaultCategoryTitle, getDiscountPercent, getEffectiveProductPrice, getStoreThemeColors, isBabyTemplate, isFashionTemplate, normalizeStoreTemplate, type StoreTemplate } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { normalizePublicPageConfig } from "@/lib/public-page-config";
import { calculateSelectedPrice, isOptionAvailable, remainingProductStock } from "@/lib/storefront-product-selection";
import { formatArgentineLocalPhone } from "@/lib/store-settings";
import { BabyStorefront } from "./baby-storefront";
import { FashionStorefront } from "./fashion-storefront";
import { StorefrontBrandSection, StoreSocialLinks } from "./storefront-brand-content";

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  imageUrls: string[];
  stockQuantity: number | null;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string; imageUrl?: string | null } | null;
  optionGroups: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
    maxSelections: number | null;
    options: Array<{ id: string; name: string; priceDelta: number; isAvailable: boolean }>;
  }>;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

export type CartItem = {
  lineId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  selectedOptionIds: string[];
  optionLabels: string[];
  unitPrice: number;
};

export type StorefrontStore = {
  name: string;
  slug: string;
  whatsappPhone: string;
  description: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  logoUrl: string | null;
  template: string;
  theme: unknown;
  mobileProductColumns: number;
  heroImageUrls: string[];
  showCategories: boolean;
  showFeatured: boolean;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  acceptTransferPayments: boolean;
  paymentAccountHolder: string | null;
  paymentProvider: string | null;
  paymentAlias: string | null;
  paymentCbu: string | null;
  address: string | null;
  businessHoursText: string | null;
  publicPageConfig: unknown;
  availability: { isOpen: boolean; label: string };
};

function PriceBlock({ product, large = false, compact = false }: { product: StorefrontProduct; large?: boolean; compact?: boolean }) {
  const discount = getDiscountPercent(product);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <strong className={clsx("font-black", large ? "text-3xl" : compact ? "text-base" : "text-xl", discount ? "text-red-600" : "text-ink")}>{formatMoney(getEffectiveProductPrice(product))}</strong>
      {discount ? <span className="text-sm font-bold text-muted line-through">{formatMoney(product.basePrice)}</span> : null}
      {discount ? <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">{discount}% OFF</span> : null}
    </div>
  );
}

function ProductImage({ product, className }: { product: StorefrontProduct; className: string }) {
  return (
    <div className={clsx("relative overflow-hidden bg-surface", className)}>
      {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-muted"><ImageIcon size={30} /></div>}
      {getDiscountPercent(product) ? <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-red-600 shadow">{getDiscountPercent(product)}% OFF</span> : null}
      {product.imageUrls.length > 1 ? <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white">{product.imageUrls.length} fotos</span> : null}
    </div>
  );
}

export function PublicStore({ store, products, categories }: { store: StorefrontStore; products: StorefrontProduct[]; categories: StorefrontCategory[] }) {
  const searchParams = useSearchParams();
  const initialProductSlug = searchParams.get("product");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(() => initialProductSlug ? products.find((product) => product.slug === initialProductSlug) ?? null : null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"pickup" | "delivery">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [copiedField, setCopiedField] = useState<"alias" | "cbu" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const template = normalizeStoreTemplate(store.template);
  const pageConfig = normalizePublicPageConfig(store.publicPageConfig);
  const isFood = template === "food";
  const isFashion = isFashionTemplate(template);
  const isBaby = isBabyTemplate(template);
  const { primary, accent } = getStoreThemeColors(template, store.theme);
  const heroImage = store.heroImageUrls[heroIndex] ?? store.heroImageUrls[0];
  const availableCategories = useMemo(() => categories.filter((item) => products.some((product) => product.category?.id === item.id)), [categories, products]);
  const showcaseCategories = useMemo(() => categories.filter((item) => Boolean(item.imageUrl)), [categories]);
  const hasPromos = products.some((product) => Boolean(getDiscountPercent(product)));
  const filteredProducts = products.filter((product) => {
    const haystack = [product.name, product.description, product.category?.name].filter(Boolean).join(" ").toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesCategory = category === "all" || (category === "promos" && Boolean(getDiscountPercent(product))) || product.category?.slug === category;
    return matchesQuery && matchesCategory;
  });
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const shippingRemaining = Math.max(0, store.freeShippingThreshold - cartTotal);
  const shippingProgress = store.freeShippingEnabled && store.freeShippingThreshold > 0 ? Math.min(100, (cartTotal / store.freeShippingThreshold) * 100) : 0;
  const activeImage = activeProduct?.imageUrls[activeImageIndex] ?? activeProduct?.imageUrls[0];
  const mobileGrid = store.mobileProductColumns === 2 ? "grid-cols-2" : "grid-cols-1";
  const storeFacts = [
    store.freeShippingEnabled ? { label: "Envío gratis", value: "Desde " + formatMoney(store.freeShippingThreshold) } : null,
    { label: "Medios de pago", value: store.acceptTransferPayments ? "Efectivo o transferencia" : "Efectivo" },
    store.address ? { label: "Estamos en", value: store.address } : null,
    store.businessHoursText ? { label: "Horario", value: store.businessHoursText } : null
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const track = useCallback((type: "STOREFRONT_VIEW" | "PRODUCT_VIEW" | "ADD_TO_CART" | "CHECKOUT_STARTED" | "WHATSAPP_HANDOFF", productId?: string) => {
    let sessionId = "";
    try {
      sessionId = window.sessionStorage.getItem("storefront-session") || crypto.randomUUID();
      window.sessionStorage.setItem("storefront-session", sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
    void fetch("/api/storefront-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeSlug: store.slug, productId, type, sessionId }),
      keepalive: true
    }).catch(() => undefined);
  }, [store.slug]);

  useEffect(() => {
    track("STOREFRONT_VIEW");
  }, [track]);

  useEffect(() => {
    if (store.heroImageUrls.length < 2) return;
    const interval = window.setInterval(() => setHeroIndex((current) => (current + 1) % store.heroImageUrls.length), 5000);
    return () => window.clearInterval(interval);
  }, [store.heroImageUrls.length]);

  useEffect(() => {
    if (!activeProduct && !checkoutOpen) return;
    lastFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[role='dialog'] [data-dialog-close], [role='dialog'] button")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeProduct) setActiveProduct(null);
        else setCheckoutOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[role='dialog']");
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")) : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      lastFocusedElement.current?.focus();
    };
  }, [activeProduct, checkoutOpen]);

  function remainingStock(product: StorefrontProduct) {
    return remainingProductStock(product, cart);
  }

  function isOutOfStock(product: StorefrontProduct) {
    const remaining = remainingStock(product);
    return remaining !== null && remaining <= 0;
  }

  function selectCategory(slug: string) {
    setCategory(slug);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  }

  function openProduct(product: StorefrontProduct) {
    setActiveProduct(product);
    setActiveImageIndex(0);
    setSelectedOptionIds([]);
    setError("");
    track("PRODUCT_VIEW", product.id);
  }

  function toggleOption(group: StorefrontProduct["optionGroups"][number], optionId: string) {
    setError("");
    setSelectedOptionIds((current) => {
      if (group.selectionType === "SINGLE") {
        return current.filter((id) => !group.options.some((option) => option.id === id)).concat(optionId);
      }
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      const selectedInGroup = current.filter((id) => group.options.some((option) => option.id === id));
      if (group.maxSelections && selectedInGroup.length >= group.maxSelections) {
        setError("Máximo " + group.maxSelections + " opción(es) en " + group.name);
        return current;
      }
      return current.concat(optionId);
    });
  }

  function addProduct(product: StorefrontProduct, optionIds: string[]) {
    if (isOutOfStock(product)) {
      setError("No hay stock disponible para este producto.");
      return false;
    }
    for (const group of product.optionGroups) {
      const selectedInGroup = optionIds.filter((id) => group.options.some((option) => option.id === id));
      if (group.isRequired && selectedInGroup.length === 0) {
        setError("Falta seleccionar " + group.name);
        return false;
      }
      if (group.selectionType === "SINGLE" && selectedInGroup.length > 1) {
        setError("Solo se puede elegir una opción en " + group.name);
        return false;
      }
      if (group.maxSelections && selectedInGroup.length > group.maxSelections) {
        setError("Máximo " + group.maxSelections + " opción(es) en " + group.name);
        return false;
      }
    }
    const optionLabels = product.optionGroups.flatMap((group) => group.options.filter((option) => optionIds.includes(option.id)).map((option) => group.name + ": " + option.name));
    setCart((current) => current.concat({
      lineId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrls[0] ?? null,
      quantity: 1,
      selectedOptionIds: optionIds.slice(),
      optionLabels,
      unitPrice: calculateSelectedPrice(product, optionIds)
    }));
    track("ADD_TO_CART", product.id);
    return true;
  }

  function quickAdd(product: StorefrontProduct) {
    openProduct(product);
  }

  function openCheckout() {
    setCheckoutOpen(true);
    setError("");
    track("CHECKOUT_STARTED");
  }

  async function shareProduct(product: StorefrontProduct) {
    const url = new URL(window.location.href);
    url.searchParams.set("product", product.slug);
    try {
      if (navigator.share) await navigator.share({ title: product.name, text: `Mirá ${product.name} en ${store.name}`, url: url.toString() });
      else {
        await navigator.clipboard.writeText(url.toString());
        setError("Enlace del producto copiado.");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError("No se pudo compartir el producto.");
    }
  }

  function addActiveProduct() {
    if (!activeProduct) return;

    const missingRequiredGroup = activeProduct.optionGroups.find((group) =>
      group.isRequired && !selectedOptionIds.some((id) => group.options.some((option) => option.id === id))
    );
    if (missingRequiredGroup) {
      setError("Falta seleccionar " + missingRequiredGroup.name);
      window.requestAnimationFrame(() => {
        const groupElement = Array.from(document.querySelectorAll<HTMLElement>("[data-product-option-group]"))
          .find((element) => element.dataset.optionGroupId === missingRequiredGroup.id);
        groupElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if (addProduct(activeProduct, selectedOptionIds)) {
      setActiveProduct(null);
      setSelectedOptionIds([]);
    }
  }

  function updateQuantity(lineId: string, delta: number) {
    setCart((current) => current.map((item) => {
      if (item.lineId !== lineId) return item;
      if (delta > 0) {
        const product = products.find((candidate) => candidate.id === item.productId);
        const remaining = product ? remainingProductStock(product, current) : null;
        if (remaining !== null && remaining <= 0) {
          setError("No hay más stock disponible para este producto.");
          return item;
        }
      }
      return { ...item, quantity: Math.max(0, item.quantity + delta) };
    }).filter((item) => item.quantity > 0));
  }

  async function copyPaymentDetail(field: "alias" | "cbu", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setError("No se pudo copiar el dato. Mantenelo presionado para copiarlo.");
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store.availability.isOpen) {
      setError(store.availability.label);
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeSlug: store.slug,
        customerName: form.get("customerName"),
        customerPhone: form.get("customerPhone"),
        fulfillment: fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === "delivery" ? form.get("deliveryAddress") : undefined,
        paymentMethod,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, selectedOptionIds: item.selectedOptionIds }))
      })
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el pedido.");
      return;
    }
    track("WHATSAPP_HANDOFF");
    window.location.assign(data.whatsappUrl);
  }

  if (isBaby) {
    return <BabyStorefront controller={{
      store,
      products,
      categories: availableCategories,
      showcaseCategories,
      template,
      primary,
      accent,
      heroIndex,
      query,
      category,
      hasPromos,
      filteredProducts,
      mobileProductColumns: store.mobileProductColumns === 2 ? 2 : 1,
      cart,
      cartTotal,
      cartCount,
      activeProduct,
      activeImage,
      activeImageIndex,
      selectedOptionIds,
      checkoutOpen,
      fulfillmentMethod,
      paymentMethod,
      copiedField,
      shippingRemaining,
      shippingProgress,
      error,
      loading,
      setHeroIndex,
      setQuery,
      setCategory,
      selectCategory,
      quickAdd,
      shareProduct,
      remainingStock,
      isOutOfStock,
      isOptionSelectable: (_product, group, optionId) => isOptionAvailable(group, optionId),
      closeProduct: () => setActiveProduct(null),
      setActiveImageIndex,
      toggleOption,
      addActiveProduct,
      openCart: openCheckout,
      closeCart: () => setCheckoutOpen(false),
      updateQuantity,
      setFulfillmentMethod,
      setPaymentMethod,
      copyPaymentDetail,
      submitOrder
    }} />;
  }

  if (isFashion) {
    return <FashionStorefront controller={{
      store,
      products,
      categories: availableCategories,
      showcaseCategories,
      template,
      primary,
      accent,
      heroImage,
      heroIndex,
      query,
      category,
      hasPromos,
      filteredProducts,
      mobileProductColumns: store.mobileProductColumns === 2 ? 2 : 1,
      cart,
      cartTotal,
      cartCount,
      activeProduct,
      activeImage,
      activeImageIndex,
      selectedOptionIds,
      checkoutOpen,
      fulfillmentMethod,
      paymentMethod,
      copiedField,
      shippingRemaining,
      shippingProgress,
      error,
      loading,
      setHeroIndex,
      setQuery,
      setCategory,
      selectCategory,
      quickAdd,
      shareProduct,
      remainingStock,
      isOutOfStock,
      isOptionSelectable: (_product, group, optionId) => isOptionAvailable(group, optionId),
      closeProduct: () => setActiveProduct(null),
      setActiveImageIndex,
      toggleOption,
      addActiveProduct,
      openCart: openCheckout,
      closeCart: () => setCheckoutOpen(false),
      updateQuantity,
      setFulfillmentMethod,
      setPaymentMethod,
      copyPaymentDetail,
      submitOrder
    }} />;
  }

  return (
    <div style={{ "--store-primary": primary, "--store-accent": accent } as CSSProperties} className={clsx("min-h-screen", isFood ? "bg-[#fffaf4]" : "bg-[#f6f5f0]")}>
      {pageConfig.announcement.enabled && pageConfig.announcement.text ? <div className="bg-[var(--store-primary)] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white sm:text-xs">{pageConfig.announcement.text}</div> : store.freeShippingEnabled ? <div className="bg-[var(--store-primary)] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white sm:text-xs">Envío gratis en pedidos desde {formatMoney(store.freeShippingThreshold)}</div> : null}

      <header className={clsx("sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur-xl", !isFood && "lg:static")}>
        <div className={clsx("container-page flex items-center justify-between gap-4 py-3", !isFood && "lg:grid lg:grid-cols-[1fr_auto_1fr] lg:py-4")}>
          <button className="flex min-w-0 items-center gap-3 text-left" type="button" onClick={() => { setCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} className={clsx("h-11 w-11 object-cover", isFood ? "rounded-2xl" : "rounded-full")} /> : <span className={clsx("grid h-11 w-11 shrink-0 place-items-center bg-[var(--store-primary)] font-black text-white", isFood ? "rounded-2xl" : "rounded-full")}>{store.name.slice(0, 1)}</span>}
            <span className="min-w-0"><span className={clsx("block truncate font-black leading-tight", !isFood && "text-lg tracking-tight")}>{store.name}</span><span className="block text-xs text-muted">{isFood ? "Menú online" : "Catálogo online"}</span></span>
          </button>
          {!isFood ? <nav className="hidden items-center gap-5 lg:flex" aria-label="Categorías">{availableCategories.slice(0, 4).map((item) => <button key={item.id} className="text-xs font-black hover:underline" type="button" onClick={() => selectCategory(item.slug)}>{item.name}</button>)}{hasPromos ? <button className="text-xs font-black text-red-600 hover:underline" type="button" onClick={() => selectCategory("promos")}>Promociones</button> : null}</nav> : null}
          <div className="flex justify-end gap-2">
            {!isFood ? <button className="hidden items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-black sm:flex" type="button" onClick={() => { document.getElementById("store-search")?.focus(); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={16} /> Buscar</button> : null}
            <button className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-black text-white" onClick={openCheckout} type="button"><ShoppingBag size={17} /> {cartCount}</button>
          </div>
        </div>
      </header>

      <main className="container-page pb-16 pt-5">
        {isFood ? <FoodHero store={store} heroImage={heroImage} heroIndex={heroIndex} setHeroIndex={setHeroIndex} /> : <EcommerceHero store={store} heroImage={heroImage} heroIndex={heroIndex} setHeroIndex={setHeroIndex} />}

        {!store.availability.isOpen ? <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{store.availability.label}</section> : null}

        {!isFood && storeFacts.length ? <section className={clsx("grid border-b border-line", storeFacts.length === 2 ? "sm:grid-cols-2" : storeFacts.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>{storeFacts.map((fact) => <div key={fact.label} className="border-b border-line px-3 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs font-black">{fact.label}</p><p className="mt-1 truncate text-[11px] text-muted">{fact.value}</p></div>)}</section> : null}

        {pageConfig.sections.map((section) => {
          if (section === "categories") return store.showCategories && showcaseCategories.length ? <CategoryShowcase key={section} categories={showcaseCategories} template={template} title={pageConfig.categoriesTitle || getDefaultCategoryTitle(template)} selected={category} onSelect={selectCategory} /> : null;
          if (section === "featured" || section === "info") return <StorefrontBrandSection key={section} section={section} store={store} products={products} onOpenProduct={openProduct} />;
          return <section key={section} id="catalogo" className={isFood ? "mt-8" : "mt-20"}>
          <div className="flex items-end justify-between gap-4"><div className="min-w-0">{isFood ? <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">Nuestro menú</p> : null}<h2 className={clsx(isFood ? "mt-2 text-2xl font-black" : "font-serif text-4xl tracking-tight sm:text-5xl")}>{category === "promos" ? "Promociones" : category === "all" ? (isFood ? "Todos los productos" : "Productos destacados") : availableCategories.find((item) => item.slug === category)?.name}</h2></div><p className="shrink-0 whitespace-nowrap text-xs font-bold text-muted">{filteredProducts.length} producto{filteredProducts.length === 1 ? "" : "s"}</p></div>
          <div className={clsx("sticky top-[69px] z-20 -mx-4 mt-5 bg-inherit/95 px-4 py-3 backdrop-blur", isFood ? "md:top-[73px]" : "lg:top-0")}><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} /><input id="store-search" className="field !rounded-full !border-black/10 !bg-white !pl-11" placeholder={isFood ? "Buscar en el menú" : "Buscar productos"} value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1"><FilterButton active={category === "all"} onClick={() => setCategory("all")}>Todo</FilterButton>{hasPromos ? <FilterButton active={category === "promos"} promo onClick={() => selectCategory("promos")}>Promos</FilterButton> : null}{store.showCategories ? availableCategories.map((item) => <FilterButton key={item.id} active={category === item.slug} onClick={() => selectCategory(item.slug)}>{item.name}</FilterButton>) : null}</div></div>
          <div className={clsx("mt-5 grid gap-4", mobileGrid, "sm:grid-cols-2", isFood ? "lg:grid-cols-1" : "xl:grid-cols-4")}>
            {filteredProducts.map((product) => <ProductCard key={product.id} product={product} template={template} remaining={remainingStock(product)} outOfStock={isOutOfStock(product)} onOpen={() => quickAdd(product)} />)}
          </div>
          {filteredProducts.length === 0 ? <p className="mt-6 border border-line bg-white p-8 text-center font-bold text-muted">No encontramos productos con esos filtros.</p> : null}
        </section>;
        })}
      </main>

      {cartCount > 0 ? <button className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 items-center justify-between rounded-full bg-ink px-5 py-4 font-black text-white shadow-2xl" onClick={openCheckout} type="button"><span>{cartCount} producto(s)</span><span>{formatMoney(cartTotal)}</span></button> : null}

      {activeProduct ? <ProductDialog product={activeProduct} products={products} template={template} activeImage={activeImage} activeImageIndex={activeImageIndex} selectedOptionIds={selectedOptionIds} error={error} remaining={remainingStock(activeProduct)} defaultSizeGuide={pageConfig.info.sizeGuide} onClose={() => setActiveProduct(null)} onImage={setActiveImageIndex} onToggle={toggleOption} onAdd={addActiveProduct} onShare={() => shareProduct(activeProduct)} onOpenRelated={openProduct} /> : null}

      {checkoutOpen ? <CheckoutDialog store={store} template={template} cart={cart} cartTotal={cartTotal} shippingRemaining={shippingRemaining} shippingProgress={shippingProgress} fulfillmentMethod={fulfillmentMethod} paymentMethod={paymentMethod} copiedField={copiedField} error={error} loading={loading} onClose={() => setCheckoutOpen(false)} onQuantity={updateQuantity} onFulfillment={setFulfillmentMethod} onPayment={setPaymentMethod} onCopy={copyPaymentDetail} onSubmit={submitOrder} /> : null}

      <footer className="border-t border-black/5 bg-white py-10"><div className="container-page flex min-w-0 flex-col justify-between gap-5 text-sm text-muted lg:flex-row lg:items-center"><div className="min-w-0"><p className="truncate font-black text-ink">{store.name}</p><p className="mt-1 break-words">{store.address || "Pedidos simples por WhatsApp"}</p>{store.businessHoursText ? <p className="mt-1 break-words">{store.businessHoursText}</p> : null}</div><div className="flex min-w-0 w-full flex-col items-stretch gap-3 lg:w-auto lg:flex-row lg:items-center lg:justify-end"><StoreSocialLinks store={store} className="w-full lg:w-auto" layoutClassName="grid grid-cols-2 lg:flex lg:flex-wrap" linkClassName="w-full justify-center lg:w-auto" /><a className="btn-secondary w-full !px-4 !py-2 lg:w-auto" href={"https://wa.me/" + store.whatsappPhone.replace(/\D/g, "")} target="_blank" rel="noreferrer"><img src="/whatsapp.svg" alt="" aria-hidden="true" className="h-4 w-4 shrink-0 brightness-0" /> Escribir por WhatsApp</a></div></div></footer>
    </div>
  );
}

function HeroDots({ images, current, onSelect }: { images: string[]; current: number; onSelect: (index: number) => void }) {
  if (images.length < 2) return null;
  return <div className="absolute bottom-5 right-5 flex gap-2 rounded-full bg-black/30 p-2 backdrop-blur">{images.map((_, index) => <button key={index} className={clsx("h-2.5 w-2.5 rounded-full", index === current ? "bg-white" : "bg-white/45")} type="button" onClick={() => onSelect(index)} aria-label={"Ver imagen " + (index + 1)} />)}</div>;
}

function EcommerceHero({ store, heroImage, heroIndex, setHeroIndex }: { store: StorefrontStore; heroImage?: string; heroIndex: number; setHeroIndex: (index: number) => void }) {
  return <section className="grid min-h-[560px] overflow-hidden bg-[#d8d4c9] lg:grid-cols-[0.82fr_1.18fr]"><div className="order-2 flex flex-col justify-center p-7 sm:p-12 lg:order-1 lg:p-16"><h1 className="font-serif text-5xl leading-[0.9] tracking-[-0.055em] sm:text-7xl">{store.heroTitle || store.name}</h1><p className="mt-6 max-w-lg text-base leading-7 text-[#50534d]">{store.heroSubtitle || store.description || "Elegí tus productos y confirmá el pedido por WhatsApp."}</p><button className="mt-7 w-max rounded-full bg-ink px-6 py-3.5 text-xs font-black text-white" type="button" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Ver productos</button></div><div className="relative order-1 min-h-[380px] bg-[#cbc8bd] lg:order-2">{heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted"><ImageIcon size={42} /></div>}<HeroDots images={store.heroImageUrls} current={heroIndex} onSelect={setHeroIndex} /></div></section>;
}

function FoodHero({ store, heroImage, heroIndex, setHeroIndex }: { store: StorefrontStore; heroImage?: string; heroIndex: number; setHeroIndex: (index: number) => void }) {
  return <section className="relative overflow-hidden rounded-[32px] bg-white">{heroImage ? <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" /> : null}<div className={clsx("relative p-6 md:p-12", heroImage && "bg-black/45")}><div className="max-w-2xl"><p className={clsx("text-sm font-black uppercase tracking-[0.2em]", heroImage ? "text-white/70" : "text-[var(--store-primary)]")}>Pedí fácil y rápido</p><h1 className={clsx("mt-3 text-4xl font-black tracking-tight md:text-6xl", heroImage && "text-white")}>{store.heroTitle || store.name}</h1><p className={clsx("mt-4 max-w-xl text-lg leading-8", heroImage ? "text-white/80" : "text-muted")}>{store.heroSubtitle || store.description || "Elegí tus productos y confirmá tu pedido por WhatsApp."}</p>{store.address || store.businessHoursText ? <div className={clsx("mt-5 grid gap-2 text-sm font-bold", heroImage ? "text-white/80" : "text-muted")}>{store.address ? <span className="flex items-center gap-2"><MapPin size={15} /> {store.address}</span> : null}{store.businessHoursText ? <span>{store.businessHoursText}</span> : null}</div> : null}</div></div><HeroDots images={store.heroImageUrls} current={heroIndex} onSelect={setHeroIndex} /></section>;
}

function CategoryShowcase({ categories, template, title, selected, onSelect }: { categories: StorefrontCategory[]; template: StoreTemplate; title: string; selected: string; onSelect: (slug: string) => void }) {
  const isFood = template === "food";
  return <section className={isFood ? "mt-8" : "mt-16"}><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">Explorá</p><h2 className={clsx("mt-2", isFood ? "text-2xl font-black" : "font-serif text-4xl tracking-tight sm:text-5xl")}>{title}</h2><div className={clsx("-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:px-0", isFood ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>{categories.map((item) => <button key={item.id} className={clsx("group relative w-[78vw] max-w-[300px] shrink-0 snap-start overflow-hidden text-left sm:w-auto sm:max-w-none", isFood ? "aspect-[1.5] rounded-3xl" : "h-[380px]", selected === item.slug && "ring-4 ring-[var(--store-primary)]")} type="button" onClick={() => onSelect(item.slug)}><img src={item.imageUrl!} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" /><span className={clsx("relative flex h-full items-end font-black text-white", isFood ? "p-4 text-lg" : "p-6 font-serif text-3xl")}>{item.name}</span></button>)}</div></section>;
}

function FilterButton({ active, promo = false, onClick, children }: { active: boolean; promo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={clsx("whitespace-nowrap rounded-full px-4 py-2 text-xs font-black", active ? (promo ? "bg-red-600 text-white" : "bg-ink text-white") : promo ? "bg-white text-red-600" : "bg-white")} type="button" onClick={onClick}>{children}</button>;
}

function ProductCard({ product, template, remaining, outOfStock, onOpen }: { product: StorefrontProduct; template: StoreTemplate; remaining: number | null; outOfStock: boolean; onOpen: () => void }) {
  const isFood = template === "food";
  if (isFood) return <article className="group grid grid-cols-[84px_1fr_auto] items-center gap-3 rounded-3xl border border-line bg-white p-3 shadow-soft"><button className="contents text-left" type="button" onClick={onOpen}><ProductImage product={product} className="aspect-square rounded-2xl" /><div className="min-w-0"><p className="truncate text-base font-black">{product.name}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{product.description}</p>{remaining !== null ? <p className={clsx("mt-1 text-xs font-black", outOfStock ? "text-red-600" : "text-muted")}>{outOfStock ? "Sin stock" : "Quedan " + remaining}</p> : null}<div className="mt-2"><PriceBlock product={product} /></div></div><span className={clsx("grid h-10 w-10 place-items-center rounded-full p-2 text-white", outOfStock ? "bg-slate-300" : "bg-ink")}>{outOfStock ? "—" : <Plus size={18} />}</span></button></article>;
  return <article className="group min-w-0"><button className="flex h-full w-full flex-col items-stretch justify-start text-left" type="button" onClick={onOpen}><ProductImage product={product} className="aspect-[4/5]" /><div className="py-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--store-primary)]">{product.category?.name ?? "Producto"}</p><h3 className="mt-2 truncate text-sm font-black">{product.name}</h3><p className="mt-1 line-clamp-1 text-xs text-muted">{product.description}</p><div className="mt-3"><PriceBlock product={product} compact /></div>{remaining !== null ? <p className={clsx("mt-2 text-[10px] font-black", outOfStock || remaining <= 5 ? "text-orange-700" : "text-muted")}>{outOfStock ? "Sin stock" : remaining <= 5 ? "Quedan " + remaining + " unidades" : "Stock disponible"}</p> : null}<span className="mt-3 inline-block text-[11px] font-black underline underline-offset-4">Ver detalle</span></div></button></article>;
}

function ProductDialog({ product, products, template, activeImage, activeImageIndex, selectedOptionIds, error, remaining, defaultSizeGuide, onClose, onImage, onToggle, onAdd, onShare, onOpenRelated }: { product: StorefrontProduct; products: StorefrontProduct[]; template: StoreTemplate; activeImage?: string; activeImageIndex: number; selectedOptionIds: string[]; error: string; remaining: number | null; defaultSizeGuide: string; onClose: () => void; onImage: (index: number) => void; onToggle: (group: StorefrontProduct["optionGroups"][number], optionId: string) => void; onAdd: () => void; onShare: () => void; onOpenRelated: (product: StorefrontProduct) => void }) {
  const isFood = template === "food";
  const outOfStock = remaining !== null && remaining <= 0;
  const sizeGuide = defaultSizeGuide;
  const related = products.filter((candidate) => candidate.id !== product.id && candidate.category?.id === product.category?.id).slice(0, 3);
  return <div className="fixed inset-0 z-40 bg-black/55 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="mx-auto flex h-full max-w-5xl items-end md:items-center"><section className={clsx("max-h-[96dvh] w-full overflow-auto bg-white sm:rounded-[30px]", !isFood && "md:grid md:grid-cols-[1.08fr_.92fr]")} role="dialog" aria-modal="true" aria-label={"Detalle de " + product.name}>{product.imageUrls.length ? <div className="bg-surface p-3 md:sticky md:top-0"><div className="grid h-[52dvh] min-h-[280px] max-h-[560px] place-items-center overflow-hidden bg-white md:h-[calc(96dvh-110px)] md:max-h-[760px]"><img src={activeImage} alt={product.name} className="h-full w-full object-contain" /></div>{product.imageUrls.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{product.imageUrls.map((url, index) => <button key={url + "-" + index} className={clsx("h-16 w-16 shrink-0 overflow-hidden border-2", index === activeImageIndex ? "border-[var(--store-primary)]" : "border-transparent")} type="button" onClick={() => onImage(index)}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div> : null}</div> : null}<div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">{product.category?.name ?? "Producto"}</p><h2 className={clsx("mt-2", isFood ? "text-2xl font-black" : "font-serif text-4xl tracking-tight")}>{product.name}</h2>{!isFood ? <><p className="mt-3 leading-7 text-muted">{product.description}</p><div className="mt-5"><PriceBlock product={product} large /></div></> : <p className="mt-2 text-sm font-semibold text-muted">Elegí tus opciones para agregarlo al pedido.</p>}</div><div className="flex shrink-0 items-center gap-2"><button className="grid h-10 w-10 place-items-center rounded-full border border-line" onClick={onShare} type="button" aria-label="Compartir producto"><Share2 size={17} /></button><button data-dialog-close className="grid h-10 w-10 place-items-center rounded-full border border-line" onClick={onClose} type="button" aria-label="Cerrar"><X size={18} /></button></div></div><div className="mt-6 grid gap-5">{product.optionGroups.map((group) => <fieldset key={group.id} data-product-option-group data-option-group-id={group.id}><legend className="text-sm font-black">{group.name} {group.isRequired ? <span className="text-red-600">*</span> : null}</legend><div className="mt-3 grid gap-2">{group.options.filter((option) => option.isAvailable).map((option) => { const disabled = !isOptionAvailable(group, option.id); return <label key={option.id} className={clsx("flex items-center justify-between border p-3", isFood && "rounded-2xl", selectedOptionIds.includes(option.id) ? "border-[var(--store-primary)] bg-green-50" : "border-line", disabled && "cursor-not-allowed opacity-45")}><span><input className="mr-3 accent-[var(--store-primary)]" type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={selectedOptionIds.includes(option.id)} disabled={disabled} onChange={() => onToggle(group, option.id)} />{option.name}</span>{option.priceDelta ? <span className="font-bold">+{formatMoney(option.priceDelta)}</span> : null}</label>; })}</div></fieldset>)}</div>{sizeGuide ? <details className="mt-5 border-y border-line py-4"><summary className="cursor-pointer text-sm font-black">Guía de talles</summary><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{sizeGuide}</p></details> : null}{remaining !== null ? <p className="mt-5 bg-surface p-3 text-xs font-black">{outOfStock ? "Sin stock por el momento. Podés compartir o volver a consultar más tarde." : "Quedan " + remaining + " unidades disponibles"}</p> : null}{error ? <p className="mt-4 text-sm font-semibold text-red-600" role="status">{error}</p> : null}<button className="btn-primary mt-6 w-full disabled:bg-slate-300" style={{ background: "var(--store-primary)" }} onClick={onAdd} type="button" disabled={outOfStock}>{outOfStock ? "Sin stock" : "Agregar · " + formatMoney(calculateSelectedPrice(product, selectedOptionIds))}</button>{related.length ? <div className="mt-8 border-t border-line pt-6"><h3 className="text-sm font-black">También te puede gustar</h3><div className="mt-3 grid grid-cols-3 gap-2">{related.map((item) => <button key={item.id} className="min-w-0 text-left" type="button" onClick={() => onOpenRelated(item)}>{item.imageUrls[0] ? <img className="aspect-square w-full object-cover" src={item.imageUrls[0]} alt="" /> : null}<span className="mt-2 block truncate text-xs font-black">{item.name}</span></button>)}</div></div> : null}</div></section></div></div>;
}

type CheckoutProps = {
  store: StorefrontStore;
  template: StoreTemplate;
  cart: CartItem[];
  cartTotal: number;
  shippingRemaining: number;
  shippingProgress: number;
  fulfillmentMethod: "pickup" | "delivery";
  paymentMethod: "cash" | "transfer";
  copiedField: "alias" | "cbu" | null;
  error: string;
  loading: boolean;
  onClose: () => void;
  onQuantity: (lineId: string, delta: number) => void;
  onFulfillment: (value: "pickup" | "delivery") => void;
  onPayment: (value: "cash" | "transfer") => void;
  onCopy: (field: "alias" | "cbu", value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CheckoutDialog({ store, template, cart, cartTotal, shippingRemaining, shippingProgress, fulfillmentMethod, paymentMethod, copiedField, error, loading, onClose, onQuantity, onFulfillment, onPayment, onCopy, onSubmit }: CheckoutProps) {
  const isFood = template === "food";
  const choiceClass = (selected: boolean) => clsx("flex cursor-pointer gap-2 border p-3 text-sm font-bold", isFood && "rounded-2xl", selected ? "border-[var(--store-primary)] bg-green-50" : "border-line");
  return <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={clsx("flex h-full", isFood ? "items-end justify-center p-0 sm:items-center sm:p-4" : "justify-end")}><section className={clsx("max-h-[100dvh] w-full overflow-auto bg-white", isFood ? "max-w-xl rounded-t-[30px] sm:max-h-[94dvh] sm:rounded-[30px]" : "h-full max-w-xl")} role="dialog" aria-modal="true" aria-label="Tu pedido"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 p-5 backdrop-blur sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">Pedido por WhatsApp</p><h2 className={clsx("mt-1", isFood ? "text-2xl font-black" : "font-serif text-4xl")}>Tu carrito</h2></div><button className="grid h-10 w-10 place-items-center rounded-full border border-line" onClick={onClose} type="button" aria-label="Cerrar carrito"><X size={18} /></button></div><div className="p-5 pb-8 sm:p-6"><div className="divide-y divide-line">{cart.length ? cart.map((item) => <article key={item.lineId} className="py-4"><div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-3"><div className={clsx("grid h-[72px] w-[72px] place-items-center overflow-hidden bg-surface text-muted", isFood ? "rounded-2xl" : "rounded-sm")}>{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" /> : <ImageIcon size={24} />}</div><div className="min-w-0"><p className="font-black">{item.productName}</p><p className="mt-1 text-xs leading-5 text-muted">{item.optionLabels.join(" · ") || "Sin variantes"}</p><div className="mt-3 flex items-center gap-3"><button className="grid h-8 w-8 place-items-center rounded-full border border-line" onClick={() => onQuantity(item.lineId, -1)} type="button" aria-label="Quitar una unidad"><Minus size={14} /></button><span className="font-black">{item.quantity}</span><button className="grid h-8 w-8 place-items-center rounded-full border border-line" onClick={() => onQuantity(item.lineId, 1)} type="button" aria-label="Agregar una unidad"><Plus size={14} /></button></div></div><p className="whitespace-nowrap font-black">{formatMoney(item.unitPrice * item.quantity)}</p></div></article>) : <p className="py-10 text-center font-bold text-muted">Tu carrito está vacío.</p>}</div>{store.freeShippingEnabled && cart.length ? <div className="mt-4 bg-green-50 p-4 text-sm font-bold text-green-900">{shippingRemaining > 0 ? "Te faltan " + formatMoney(shippingRemaining) + " para el envío gratis." : "¡Tu pedido tiene envío gratis!"}<div className="mt-3 h-2 overflow-hidden rounded-full bg-green-100"><div className="h-full rounded-full bg-green-600" style={{ width: shippingProgress + "%" }} /></div></div> : null}<form className="mt-6 grid gap-5" onSubmit={onSubmit}>
    <fieldset className="grid gap-3 border-t border-line pt-5"><legend className="pr-2 text-sm font-black">Datos de contacto</legend><label className="grid gap-1.5 text-xs font-black">Nombre completo<input className="field text-base sm:text-sm" name="customerName" autoComplete="name" placeholder="Nombre y apellido" minLength={2} required /></label><label className="grid gap-1.5 text-xs font-black">Teléfono<input className="field text-base sm:text-sm" name="customerPhone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="381 123-4567" pattern="[0-9]{3} [0-9]{3}-[0-9]{4}" maxLength={12} onChange={(event) => { event.currentTarget.value = formatArgentineLocalPhone(event.currentTarget.value); }} required /></label></fieldset>
    <fieldset className="grid gap-3 border-t border-line pt-5"><legend className="pr-2 text-sm font-black">Método de entrega</legend><div className="grid grid-cols-2 gap-2"><label className={choiceClass(fulfillmentMethod === "pickup")}><input type="radio" name="fulfillment" checked={fulfillmentMethod === "pickup"} onChange={() => onFulfillment("pickup")} /><span>Retiro<small className="mt-1 block font-normal text-muted">Por el local</small></span></label><label className={choiceClass(fulfillmentMethod === "delivery")}><input type="radio" name="fulfillment" checked={fulfillmentMethod === "delivery"} onChange={() => onFulfillment("delivery")} /><span>Envío<small className="mt-1 block font-normal text-muted">A domicilio</small></span></label></div>{fulfillmentMethod === "pickup" ? <div className="bg-surface p-3 text-xs text-muted"><strong className="text-ink">Dirección para retirar el pedido</strong><br />{store.address || "A coordinar con el comercio"}{store.businessHoursText ? <><br />{store.businessHoursText}</> : null}</div> : <label className="grid gap-1.5 text-xs font-black">Domicilio de entrega<input className="field text-base sm:text-sm" name="deliveryAddress" autoComplete="street-address" placeholder="Calle, número, piso y localidad" minLength={5} required /></label>}</fieldset>
    <fieldset className="grid gap-3 border-t border-line pt-5"><legend className="pr-2 text-sm font-black">Método de pago</legend><div className={clsx("grid gap-2", store.acceptTransferPayments ? "grid-cols-2" : "grid-cols-1")}><label className={choiceClass(paymentMethod === "cash")}><input type="radio" name="paymentMethod" checked={paymentMethod === "cash"} onChange={() => onPayment("cash")} /><span>Efectivo<small className="mt-1 block font-normal text-muted">A coordinar</small></span></label>{store.acceptTransferPayments ? <label className={choiceClass(paymentMethod === "transfer")}><input type="radio" name="paymentMethod" checked={paymentMethod === "transfer"} onChange={() => onPayment("transfer")} /><span>Transferencia<small className="mt-1 block font-normal text-muted">Datos bancarios</small></span></label> : null}</div>{paymentMethod === "transfer" && store.acceptTransferPayments ? <PaymentDetails store={store} copiedField={copiedField} onCopy={onCopy} /> : null}</fieldset>
    <div className="border-t border-line pt-4"><div className="flex items-center justify-between text-xl font-black"><span>Total</span><span>{formatMoney(cartTotal)}</span></div><p className="mt-2 text-xs text-muted">El pedido se enviará al comercio para su confirmación.</p></div>{!store.availability.isOpen ? <p className="bg-amber-50 p-3 text-sm font-semibold text-amber-900">{store.availability.label}</p> : null}{error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}<button className="flex w-full items-center justify-center gap-2 rounded-full bg-[#16803d] px-5 py-4 font-black text-white disabled:bg-slate-300" disabled={loading || cart.length === 0 || !store.availability.isOpen}><img src="/whatsapp.svg" alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> {loading ? "Creando pedido..." : store.availability.isOpen ? "Enviar pedido" : "Tienda cerrada"}</button>
  </form></div></section></div></div>;
}

function PaymentDetails({ store, copiedField, onCopy }: { store: StorefrontStore; copiedField: "alias" | "cbu" | null; onCopy: (field: "alias" | "cbu", value: string) => void }) {
  return <dl className="grid gap-3 bg-surface p-4 text-xs">{store.paymentProvider ? <div><dt className="text-muted">Banco o billetera</dt><dd className="mt-1 font-black">{store.paymentProvider}</dd></div> : null}{store.paymentAccountHolder ? <div><dt className="text-muted">Titular</dt><dd className="mt-1 font-black">{store.paymentAccountHolder}</dd></div> : null}{store.paymentAlias ? <PaymentDetail label="Alias" value={store.paymentAlias} copied={copiedField === "alias"} onCopy={() => onCopy("alias", store.paymentAlias!)} /> : null}{store.paymentCbu ? <PaymentDetail label="CBU / CVU" value={store.paymentCbu} copied={copiedField === "cbu"} onCopy={() => onCopy("cbu", store.paymentCbu!)} /> : null}</dl>;
}

function PaymentDetail({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="flex items-center justify-between gap-3"><div><dt className="text-muted">{label}</dt><dd className="mt-1 break-all font-black">{value}</dd></div><button className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 py-2 font-black" type="button" onClick={onCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copiado" : "Copiar"}</button></div>;
}
