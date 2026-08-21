"use client";

import { ImageIcon, MessageCircle, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { getDiscountPercent, getEffectiveProductPrice, normalizeStoreTemplate } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  imageUrls: string[];
  category: { id: string; name: string; slug: string } | null;
  optionGroups: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
    maxSelections: number | null;
    options: Array<{ id: string; name: string; priceDelta: number; isAvailable: boolean }>;
  }>;
};

type CartItem = {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  selectedOptionIds: string[];
  optionLabels: string[];
  unitPrice: number;
};

function calculateUnitPrice(product: StorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce((total, group) => {
    return (
      total +
      group.options.reduce((sum, option) => {
        return selected.has(option.id) ? sum + option.priceDelta : sum;
      }, 0)
    );
  }, getEffectiveProductPrice(product));
}

function PriceBlock({ product, size = "md" }: { product: StorefrontProduct; size?: "sm" | "md" | "lg" }) {
  const discount = getDiscountPercent(product);
  const effectivePrice = getEffectiveProductPrice(product);
  const priceClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <strong className={`${priceClass} font-black ${discount ? "text-red-600" : ""}`}>{formatMoney(effectivePrice)}</strong>
      {discount ? <span className="font-bold text-muted line-through">{formatMoney(product.basePrice)}</span> : null}
      {discount ? <span className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-black text-white">{discount}% OFF</span> : null}
    </div>
  );
}

function ProductImage({ product, className }: { product: StorefrontProduct; className: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {product.imageUrls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-muted">
          <ImageIcon size={24} />
        </div>
      )}
      {getDiscountPercent(product) ? (
        <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-lg">
          {getDiscountPercent(product)}% OFF
        </span>
      ) : null}
      {product.imageUrls.length > 1 ? (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-black text-white">
          {product.imageUrls.length} fotos
        </span>
      ) : null}
    </div>
  );
}

export function PublicStore({
  store,
  products
}: {
  store: {
    name: string;
    slug: string;
    description: string | null;
    heroTitle: string | null;
    heroSubtitle: string | null;
    logoUrl: string | null;
    template: string;
    theme: unknown;
    mobileProductColumns: number;
    availability: {
      isOpen: boolean;
      label: string;
    };
  };
  products: StorefrontProduct[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const template = normalizeStoreTemplate(store.template);
  const mobileProductColumns = store.mobileProductColumns === 2 ? 2 : 1;
  const primary =
    store.theme && typeof store.theme === "object" && "primary" in store.theme
      ? String((store.theme as Record<string, unknown>).primary)
      : "#16a34a";

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string }>();
    for (const product of products) {
      if (product.category) {
        map.set(product.category.slug, product.category);
      }
    }
    return Array.from(map.values());
  }, [products]);

  const hasPromos = products.some((product) => getDiscountPercent(product));
  const filteredProducts = products.filter((product) => {
    const matchesQuery = [product.name, product.description ?? ""].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      category === "all" ||
      (category === "promos" && Boolean(getDiscountPercent(product))) ||
      product.category?.slug === category;
    return matchesQuery && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function toggleOption(group: StorefrontProduct["optionGroups"][number], optionId: string) {
    setError("");
    setSelectedOptionIds((current) => {
      if (group.selectionType === "SINGLE") {
        const withoutGroup = current.filter((id) => !group.options.some((option) => option.id === id));
        return [...withoutGroup, optionId];
      }

      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }

      const selectedInGroup = current.filter((id) => group.options.some((option) => option.id === id));
      if (group.maxSelections && selectedInGroup.length >= group.maxSelections) {
        setError(`Máximo ${group.maxSelections} opción(es) en ${group.name}`);
        return current;
      }

      return [...current, optionId];
    });
  }

  function openProduct(product: StorefrontProduct) {
    setActiveProduct(product);
    setActiveImageIndex(0);
    setSelectedOptionIds([]);
    setError("");
  }

  function addActiveProduct() {
    if (!activeProduct) {
      return;
    }

    for (const group of activeProduct.optionGroups) {
      const selectedInGroup = selectedOptionIds.filter((id) => group.options.some((option) => option.id === id));
      if (group.isRequired && selectedInGroup.length === 0) {
        setError(`Falta seleccionar ${group.name}`);
        return;
      }
      if (group.maxSelections && selectedInGroup.length > group.maxSelections) {
        setError(`Máximo ${group.maxSelections} opción(es) en ${group.name}`);
        return;
      }
    }

    const optionLabels = activeProduct.optionGroups.flatMap((group) =>
      group.options
        .filter((option) => selectedOptionIds.includes(option.id))
        .map((option) => `${group.name}: ${option.name}`)
    );

    setCart((current) => [
      ...current,
      {
        lineId: crypto.randomUUID(),
        productId: activeProduct.id,
        productName: activeProduct.name,
        quantity: 1,
        selectedOptionIds,
        optionLabels,
        unitPrice: calculateUnitPrice(activeProduct, selectedOptionIds)
      }
    ]);
    setActiveProduct(null);
    setSelectedOptionIds([]);
  }

  function updateQuantity(lineId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.lineId === lineId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
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
        fulfillment: form.get("fulfillment"),
        notes: form.get("notes"),
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          selectedOptionIds: item.selectedOptionIds
        }))
      })
    });

    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el pedido.");
      return;
    }

    window.location.href = data.whatsappUrl;
  }

  const heroClass =
    template === "premium"
      ? "overflow-hidden rounded-[28px] bg-ink p-6 text-white md:p-10"
      : template === "quick-menu"
        ? "rounded-[24px] border border-line bg-white p-5"
        : "overflow-hidden rounded-[28px] bg-ink p-6 text-white md:p-10";
  const gridClass =
    template === "quick-menu"
      ? mobileProductColumns === 2
        ? "mt-5 grid grid-cols-2 gap-3 md:grid-cols-1"
        : "mt-5 grid gap-3"
      : template === "premium"
        ? `mt-5 grid gap-5 ${mobileProductColumns === 2 ? "grid-cols-2" : "grid-cols-1"} sm:grid-cols-2`
        : `mt-5 grid gap-4 ${mobileProductColumns === 2 ? "grid-cols-2" : "grid-cols-1"} sm:grid-cols-2 lg:grid-cols-3`;
  const activeImage = activeProduct?.imageUrls[activeImageIndex] ?? activeProduct?.imageUrls[0];
  const quickMenuTwoColumns = template === "quick-menu" && mobileProductColumns === 2;

  return (
    <div style={{ "--store-primary": primary } as CSSProperties} className="min-h-screen bg-[#fffaf4]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="container-page flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} className="h-11 w-11 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--store-primary)] font-black text-white">
                {store.name.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="font-black leading-tight">{store.name}</p>
              <p className="text-xs text-muted">Pedido por WhatsApp</p>
            </div>
          </div>
          <button className="btn-primary !px-4" onClick={() => setCheckoutOpen(true)} type="button">
            <ShoppingCart size={18} /> {cartCount}
          </button>
        </div>
      </header>

      <main className="container-page pb-28 pt-5">
        <section className={heroClass}>
          <p className={`text-sm font-bold ${template === "quick-menu" ? "text-[var(--store-primary)]" : "text-white/60"}`}>
            {template === "market" ? "Ofertas y catálogo" : template === "quick-menu" ? "Menú online" : "Catálogo seleccionado"}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
            {store.heroTitle ?? store.name}
          </h1>
          <p className={`mt-4 max-w-xl ${template === "quick-menu" ? "text-muted" : "text-white/70"}`}>
            {store.heroSubtitle ?? store.description ?? "Elegí productos y confirmá por WhatsApp."}
          </p>
        </section>

        {!store.availability.isOpen ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {store.availability.label}
          </section>
        ) : null}

        <section className="sticky top-[73px] z-10 -mx-4 mt-4 bg-[#fffaf4]/95 px-4 py-3 backdrop-blur md:top-[77px]">
          <div className="container-page !w-full !max-w-none">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                className="field !pl-11"
                placeholder="Buscar productos"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                className={`rounded-full px-4 py-2 text-sm font-bold ${category === "all" ? "bg-ink text-white" : "bg-white"}`}
                onClick={() => setCategory("all")}
                type="button"
              >
                Todo
              </button>
              {hasPromos ? (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-bold ${category === "promos" ? "bg-red-600 text-white" : "bg-white text-red-600"}`}
                  onClick={() => setCategory("promos")}
                  type="button"
                >
                  Promos
                </button>
              ) : null}
              {categories.map((item) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-bold ${category === item.slug ? "bg-ink text-white" : "bg-white"}`}
                  key={item.id}
                  onClick={() => setCategory(item.slug)}
                  type="button"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={gridClass}>
          {filteredProducts.map((product) =>
            template === "quick-menu" ? (
              <article key={product.id} className="rounded-[22px] border border-line bg-white p-3 shadow-soft">
                <button
                  className={quickMenuTwoColumns ? "block w-full text-left" : "grid w-full grid-cols-[96px_1fr_auto] items-center gap-3 text-left"}
                  onClick={() => openProduct(product)}
                  type="button"
                >
                  <ProductImage product={product} className="aspect-square rounded-2xl" />
                  <div className={quickMenuTwoColumns ? "mt-3 min-w-0" : "min-w-0"}>
                    <p className="truncate text-base font-black">{product.name}</p>
                    <p className={`${quickMenuTwoColumns ? "hidden" : "mt-1 line-clamp-2"} text-sm leading-5 text-muted`}>{product.description}</p>
                    <div className="mt-2">
                      <PriceBlock product={product} size="sm" />
                    </div>
                  </div>
                  <span className={`${quickMenuTwoColumns ? "mt-3 grid h-9 w-full place-items-center" : "grid h-10 w-10 place-items-center"} rounded-full bg-ink p-2 font-black text-white`}>
                    <Plus size={18} />
                  </span>
                </button>
              </article>
            ) : (
              <article
                key={product.id}
                className={`overflow-hidden rounded-[28px] border border-line bg-white shadow-soft ${template === "premium" ? "lg:min-h-[460px]" : ""}`}
              >
                <button className="block h-full w-full text-left" onClick={() => openProduct(product)} type="button">
                  <ProductImage product={product} className={template === "premium" ? "aspect-square" : "aspect-[4/3]"} />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">
                      {product.category?.name ?? "Producto"}
                    </p>
                    <h2 className="mt-2 text-xl font-black">{product.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{product.description}</p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <PriceBlock product={product} />
                      <span className="rounded-full bg-green-100 px-3 py-2 text-sm font-black text-green-800">
                        Agregar
                      </span>
                    </div>
                  </div>
                </button>
              </article>
            )
          )}
        </section>
      </main>

      {cartCount > 0 ? (
        <button
          className="fixed bottom-4 left-1/2 z-30 flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-center justify-between rounded-full bg-ink px-5 py-4 font-black text-white shadow-2xl"
          onClick={() => setCheckoutOpen(true)}
          type="button"
        >
          <span>{cartCount} producto(s)</span>
          <span>{formatMoney(cartTotal)}</span>
        </button>
      ) : null}

      {activeProduct ? (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-2xl items-end md:items-center">
            <section className="max-h-[92vh] w-full overflow-auto rounded-[32px] bg-white">
              {activeProduct.imageUrls.length ? (
                <div className="bg-surface p-3">
                  <div className="aspect-[4/3] overflow-hidden rounded-[24px] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeImage} alt={activeProduct.name} className="h-full w-full object-cover" />
                  </div>
                  {activeProduct.imageUrls.length > 1 ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {activeProduct.imageUrls.map((url, index) => (
                        <button
                          className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 ${index === activeImageIndex ? "border-[var(--store-primary)]" : "border-transparent"}`}
                          key={`${url}-${index}`}
                          onClick={() => setActiveImageIndex(index)}
                          type="button"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">
                      {activeProduct.category?.name ?? "Producto"}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{activeProduct.name}</h2>
                    <p className="mt-2 text-muted">{activeProduct.description}</p>
                    <div className="mt-4">
                      <PriceBlock product={activeProduct} size="lg" />
                    </div>
                  </div>
                  <button onClick={() => setActiveProduct(null)} type="button">
                    <X />
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  {activeProduct.optionGroups.map((group) => (
                    <fieldset key={group.id}>
                      <legend className="font-black">
                        {group.name} {group.isRequired ? <span className="text-red-600">*</span> : null}
                      </legend>
                      <div className="mt-3 grid gap-2">
                        {group.options.filter((option) => option.isAvailable).map((option) => (
                          <label key={option.id} className="flex items-center justify-between rounded-2xl border border-line p-3">
                            <span>
                              <input
                                className="mr-3"
                                type={group.selectionType === "SINGLE" ? "radio" : "checkbox"}
                                name={group.id}
                                checked={selectedOptionIds.includes(option.id)}
                                onChange={() => toggleOption(group, option.id)}
                              />
                              {option.name}
                            </span>
                            {option.priceDelta ? <span className="font-bold">+{formatMoney(option.priceDelta)}</span> : null}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
                <button className="btn-primary mt-6 w-full" onClick={addActiveProduct} type="button">
                  Agregar · {formatMoney(calculateUnitPrice(activeProduct, selectedOptionIds))}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-xl items-end md:items-center">
            <section className="max-h-[92vh] w-full overflow-auto rounded-[32px] bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Tu pedido</h2>
                <button onClick={() => setCheckoutOpen(false)} type="button">
                  <X />
                </button>
              </div>
              <div className="mt-5 divide-y divide-line">
                {cart.map((item) => (
                  <article key={item.lineId} className="py-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-black">{item.productName}</p>
                        <p className="text-sm text-muted">{item.optionLabels.join(" · ")}</p>
                      </div>
                      <p className="font-black">{formatMoney(item.unitPrice * item.quantity)}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button className="rounded-full border p-2" onClick={() => updateQuantity(item.lineId, -1)} type="button">
                        <Minus size={16} />
                      </button>
                      <span className="font-black">{item.quantity}</span>
                      <button className="rounded-full border p-2" onClick={() => updateQuantity(item.lineId, 1)} type="button">
                        <Plus size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <form className="mt-5 grid gap-3" onSubmit={submitOrder}>
                <input className="field" name="customerName" placeholder="Tu nombre" required />
                <input className="field" name="customerPhone" placeholder="Tu teléfono" required />
                <select className="field" name="fulfillment" defaultValue="Retiro">
                  <option>Retiro</option>
                  <option>Delivery</option>
                  <option>Coordinar por WhatsApp</option>
                </select>
                <textarea className="field min-h-20" name="notes" placeholder="Notas para el comercio" />
                <div className="flex items-center justify-between py-2 text-xl font-black">
                  <span>Total</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>
                {!store.availability.isOpen ? (
                  <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{store.availability.label}</p>
                ) : null}
                {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                <button className="btn-primary w-full" disabled={loading || cart.length === 0 || !store.availability.isOpen}>
                  <MessageCircle size={18} /> {loading ? "Creando pedido..." : store.availability.isOpen ? "Confirmar por WhatsApp" : "Tienda cerrada"}
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
