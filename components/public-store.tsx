"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommerceStorefront } from "./commerce-storefront";
import { StorefrontCartDrawer } from "./storefront-cart-drawer";
import { addOrIncrementCartItem, useStorefrontCart, type StorefrontCartItem } from "./storefront-cart";
import { categoryDescendantIds } from "@/lib/category-tree";
import { getDiscountPercent, normalizeStoreTemplate } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { calculateSelectedPrice, remainingProductStock, remainingSelectedStock } from "@/lib/storefront-product-selection";
import { normalizeVariants, selectedVariantKey } from "@/lib/product-variants";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

export type StorefrontProduct = {
  id: string; sku?: string | null; name: string; slug: string; description: string | null;
  basePrice: number; promoPrice: number | null; imageUrls: string[]; stockQuantity: number | null;
  isFeatured: boolean; category: { id: string; name: string; slug: string; imageUrl?: string | null } | null;
  assignedCategories?: Array<{ id: string; name: string; slug: string }>;
  variants?: unknown;
  optionGroups: Array<{ id: string; name: string; selectionType: "SINGLE" | "MULTIPLE"; isRequired: boolean; maxSelections: number | null;
    options: Array<{ id: string; name: string; priceDelta: number; isAvailable: boolean }> }>;
};
export type StorefrontCategory = { id: string; parentId?: string | null; name: string; slug: string; imageUrl: string | null };
export type CartItem = StorefrontCartItem;
export type StorefrontStore = {
  name: string; slug: string; whatsappPhone: string; description: string | null; heroTitle: string | null; heroSubtitle: string | null;
  logoUrl: string | null; template: string; theme: unknown; designConfig: unknown; mobileProductColumns: number;
  heroImageUrls: string[]; showCategories: boolean; showFeatured: boolean; freeShippingEnabled: boolean; freeShippingThreshold: number;
  acceptTransferPayments: boolean; acceptCashPayments: boolean; whatsappOrdersEnabled: boolean; checkoutSettings: unknown;
  deliveryMethods: unknown; menuConfig: unknown; taxRatePercent: number; showPricesWithoutTax: boolean;
  freeShippingProductIds?: string[]; isPreview?: boolean; signedIn?: boolean;
  paymentAccountHolder: string | null; paymentProvider: string | null; paymentAlias: string | null; paymentCbu: string | null;
  address: string | null; businessHoursText: string | null; publicPageConfig: unknown; availability: { isOpen: boolean; label: string };
};

export function PublicStore({ store, products: initialProducts, categories, featuredProducts = [], totalProducts, initialPage = 1, availableCategoryIds, hasPromosFromServer, mode = "home" }: {
  store: StorefrontStore; products: StorefrontProduct[]; categories: StorefrontCategory[]; featuredProducts?: StorefrontProduct[];
  totalProducts?: number; initialPage?: number; availableCategoryIds?: string[];
  hasPromosFromServer?: boolean; mode?: "home" | "catalog";
}) {
  const params = useSearchParams();
  const [products, setProducts] = useState(initialProducts);
  const [catalogTotal, setCatalogTotal] = useState(totalProducts ?? initialProducts.length);
  const [catalogPage, setCatalogPage] = useState(initialPage);
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("categoria") || "all");
  const [sort, setSort] = useState(params.get("orden") || "default");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState("");
  const initialFilters = useRef(JSON.stringify([query,category,sort]));
  const { cart, changeCart, cartCount, cartTotal } = useStorefrontCart(store.slug);
  const template = normalizeStoreTemplate(store.template);

  const availableCategories = useMemo(() => categories.filter(item => availableCategoryIds ? availableCategoryIds.includes(item.id) || [...categoryDescendantIds(item.id,categories)].some(id => availableCategoryIds.includes(id)) : products.some(product => product.category?.id === item.id || product.assignedCategories?.some(assigned => assigned.id === item.id))), [categories, availableCategoryIds, products]);
  const hasPromos = hasPromosFromServer ?? products.some(product => Boolean(getDiscountPercent(product)));
  const filteredProducts = useMemo(() => {
    if (totalProducts !== undefined && !store.isPreview) return products;
    const selected = categories.find(item => item.slug === category);
    const ids = selected ? categoryDescendantIds(selected.id,categories) : new Set<string>();
    return products.filter(product => {
      const text = [product.name,product.sku,product.description,product.category?.name,...(product.assignedCategories?.map(item=>item.name)||[])].filter(Boolean).join(" ").toLocaleLowerCase("es-AR");
      const matches = text.includes(query.trim().toLocaleLowerCase("es-AR"));
      return matches && (category === "all" || category === "promos" && Boolean(getDiscountPercent(product)) || Boolean(product.category && ids.has(product.category.id)) || Boolean(product.assignedCategories?.some(item => ids.has(item.id))));
    });
  }, [products,totalProducts,store.isPreview,categories,category,query]);

  const track = useCallback((type: "STOREFRONT_VIEW" | "PRODUCT_VIEW" | "CHECKOUT_STARTED" | "WHATSAPP_HANDOFF", productId?: string) => {
    if (store.isPreview) return;
    let sessionId = "";
    try { sessionId = sessionStorage.getItem("storefront-session") || crypto.randomUUID(); sessionStorage.setItem("storefront-session",sessionId); }
    catch { sessionId = crypto.randomUUID(); }
    void fetch("/api/storefront-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeSlug: store.slug, productId, type, sessionId }), keepalive: true }).catch(() => undefined);
  }, [store.isPreview,store.slug]);
  useEffect(() => { track("STOREFRONT_VIEW"); }, [track]);
  useEffect(() => {
    if (mode !== "catalog" || totalProducts === undefined || store.isPreview) return;
    const filters = JSON.stringify([query,category,sort]);
    if (filters === initialFilters.current) return;
    initialFilters.current = filters;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("pagina");
      if (query.trim()) url.searchParams.set("q",query.trim()); else url.searchParams.delete("q");
      if (category !== "all") url.searchParams.set("categoria",category); else url.searchParams.delete("categoria");
      if (sort !== "default") url.searchParams.set("orden",sort); else url.searchParams.delete("orden");
      window.history.pushState(null,"",url);
      setCatalogLoading(true); setCatalogError("");
      const search = new URLSearchParams({ storeSlug: store.slug, page: "1", q: query, category, sort });
      void fetch(`/api/storefront/products?${search}`,{signal:controller.signal}).then(async response => { const result=await response.json(); if(!response.ok)throw Error(result.error); setProducts(result.products);setCatalogTotal(result.total);setCatalogPage(1); }).catch(error => { if(error.name!=="AbortError")setCatalogError("No pudimos cargar los productos. Intentá nuevamente."); }).finally(()=>setCatalogLoading(false));
    },250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode,totalProducts,store.isPreview,store.slug,query,category,sort]);

  async function loadMore() {
    if (catalogLoading || totalProducts === undefined || catalogPage * 12 >= catalogTotal) return;
    setCatalogLoading(true); setCatalogError("");
    try { const page=catalogPage+1; const search=new URLSearchParams({ storeSlug:store.slug,page:String(page),q:query,category,sort }); const response=await fetch(`/api/storefront/products?${search}`); const result=await response.json(); if(!response.ok)throw Error(result.error); setProducts(current=>[...current,...result.products.filter((product:StorefrontProduct)=>!current.some(item=>item.id===product.id))]);setCatalogTotal(result.total);setCatalogPage(page);const url=new URL(window.location.href);url.searchParams.set("pagina",String(page));window.history.pushState(null,"",url); }
    catch { setCatalogError("No pudimos cargar más productos. Intentá nuevamente."); }
    finally { setCatalogLoading(false); }
  }
  function selectCategory(slug: string) {
    if (mode === "home" && !store.isPreview) { window.location.assign(`/${store.slug}/productos?categoria=${encodeURIComponent(slug)}`); return; }
    setCategory(slug); document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"});
  }
  function remaining(product: StorefrontProduct) { return remainingProductStock(product,cart); }
  function outOfStock(product: StorefrontProduct) { const value=remaining(product); return value !== null && value <= 0 || normalizeVariants(product.variants).length > 0 && normalizeVariants(product.variants).every(item=>!item.isVisible || item.stockQuantity===0); }
  function updateQuantity(lineId: string, delta: number) {
    changeCart(current=>current.map(item=>{
      if(item.lineId!==lineId)return item;
      const product=[...products,...featuredProducts].find(candidate=>candidate.id===item.productId);
      if(delta>0 && product){const value=remainingSelectedStock(product,item.selectedOptionIds,current);if(value!==null && value<=0){setCartError("No hay más stock disponible.");return item;}}
      return {...item,quantity:Math.max(0,item.quantity+delta)};
    }).filter(item=>item.quantity>0));
  }
  function quickAdd(product: StorefrontProduct, selectedOptionIds: string[]) {
    if (store.isPreview) return;
    const missing = product.optionGroups.find(group => group.isRequired && !selectedOptionIds.some(id => group.options.some(option => option.id === id)));
    if (missing) { setCartError(`Elegí ${missing.name} para continuar.`); return; }
    if (product.optionGroups.some(group => group.options.some(option => selectedOptionIds.includes(option.id) && !option.isAvailable))) { setCartError("La opción seleccionada no está disponible."); return; }
    const available = remainingSelectedStock(product, selectedOptionIds, cart);
    if (available !== null && available <= 0) { setCartError("No hay stock disponible para esta opción."); return; }
    const variant = normalizeVariants(product.variants).find(item => item.key === selectedVariantKey(product.optionGroups, selectedOptionIds));
    const labels = product.optionGroups.flatMap(group => group.options.filter(option => selectedOptionIds.includes(option.id)).map(option => `${group.name}: ${option.name}`));
    changeCart(current => addOrIncrementCartItem(current, { lineId: crypto.randomUUID(), productId: product.id, productName: product.name, imageUrl: variant?.imageUrl || product.imageUrls[0] || null, quantity: 1, selectedOptionIds, optionLabels: labels, unitPrice: calculateSelectedPrice(product, selectedOptionIds) }));
    setCartError("");
    setCartOpen(true);
  }
  function continueOrder() {
    if (!cart.length) return;
    if (store.whatsappOrdersEnabled) {
      const lines=[`Hola ${store.name}, quisiera hacer un pedido:`,...cart.map(item=>`• ${item.quantity}x ${item.productName}${item.optionLabels.length?` (${item.optionLabels.join(", ")})`:""} — ${formatMoney(item.unitPrice*item.quantity)}`),`Total: ${formatMoney(cartTotal)}`];
      track("WHATSAPP_HANDOFF"); window.location.assign(`https://wa.me/${normalizeWhatsAppPhone(store.whatsappPhone)}?text=${encodeURIComponent(lines.join("\n"))}`); return;
    }
    track("CHECKOUT_STARTED");window.location.assign(`/${store.slug}/compra`);
  }
  return <CommerceStorefront mode={mode} template={template} store={store} products={products} featuredProducts={featuredProducts} hasPromos={hasPromos} filteredProducts={filteredProducts}
    categories={availableCategories} allCategories={categories} showcaseCategories={categories}
    category={category} query={query} sort={sort} totalProducts={catalogTotal} hasMore={totalProducts!==undefined && catalogPage*12<catalogTotal} catalogLoading={catalogLoading} catalogError={catalogError} onLoadMore={()=>void loadMore()} cartCount={cartCount} cartTotal={cartTotal}
    onQuery={setQuery} onCategory={selectCategory} onSort={setSort} onOpen={product=>{if(!store.isPreview){track("PRODUCT_VIEW",product.id);window.location.assign(`/${store.slug}/producto/${product.slug}`);}}} onCart={()=>{if(!store.isPreview){setCartError("");setCartOpen(true);}}} onQuickAdd={quickAdd}
    remaining={remaining} outOfStock={outOfStock}>
    <StorefrontCartDrawer open={cartOpen} slug={store.slug} items={cart} total={cartTotal} whatsapp={store.whatsappOrdersEnabled} onClose={()=>setCartOpen(false)} onQuantity={updateQuantity} onRemove={lineId=>changeCart(current=>current.filter(item=>item.lineId!==lineId))} onOrder={continueOrder} error={cartError}/>
  </CommerceStorefront>;
}
