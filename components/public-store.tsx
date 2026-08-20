"use client";

import { MessageCircle, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/money";

type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  imageUrls: string[];
  category: { id: string; name: string; slug: string } | null;
  optionGroups: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
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
  }, product.basePrice);
}

export function PublicStore({
  store,
  products
}: {
  store: { name: string; slug: string; description: string | null; heroTitle: string | null; heroSubtitle: string | null; logoUrl: string | null; theme: unknown };
  products: StorefrontProduct[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const filteredProducts = products.filter((product) => {
    const matchesQuery = [product.name, product.description ?? ""].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || product.category?.slug === category;
    return matchesQuery && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function toggleOption(group: StorefrontProduct["optionGroups"][number], optionId: string) {
    setSelectedOptionIds((current) => {
      if (group.selectionType === "SINGLE") {
        const withoutGroup = current.filter((id) => !group.options.some((option) => option.id === id));
        return [...withoutGroup, optionId];
      }
      return current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
    });
  }

  function openProduct(product: StorefrontProduct) {
    setActiveProduct(product);
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

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <div style={{ "--store-primary": primary } as React.CSSProperties} className="min-h-screen bg-[#fffaf4]">
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
        <section className="overflow-hidden rounded-[32px] bg-ink p-6 text-white md:p-10">
          <p className="text-sm font-bold text-white/60">Catálogo online</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
            {store.heroTitle ?? store.name}
          </h1>
          <p className="mt-4 max-w-xl text-white/70">{store.heroSubtitle ?? store.description ?? "Elegí productos y confirmá por WhatsApp."}</p>
        </section>

        <section className="sticky top-[73px] z-10 -mx-4 mt-4 bg-[#fffaf4]/95 px-4 py-3 backdrop-blur md:top-[77px]">
          <div className="container-page !w-full !max-w-none">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                className="field pl-11"
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

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-[28px] border border-line bg-white shadow-soft">
              <button className="block w-full text-left" onClick={() => openProduct(product)} type="button">
                <div className="aspect-[4/3] bg-surface">
                  {product.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-muted">Sin imagen</div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--store-primary)]">
                    {product.category?.name ?? "Producto"}
                  </p>
                  <h2 className="mt-2 text-xl font-black">{product.name}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{product.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black">{formatMoney(product.basePrice)}</span>
                    <span className="rounded-full bg-green-100 px-3 py-2 text-sm font-black text-green-800">
                      Agregar
                    </span>
                  </div>
                </div>
              </button>
            </article>
          ))}
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
          <div className="mx-auto flex h-full max-w-xl items-end md:items-center">
            <section className="max-h-[90vh] w-full overflow-auto rounded-[32px] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{activeProduct.name}</h2>
                  <p className="mt-1 text-muted">{activeProduct.description}</p>
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
                Agregar — {formatMoney(calculateUnitPrice(activeProduct, selectedOptionIds))}
              </button>
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
                {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                <button className="btn-primary w-full" disabled={loading || cart.length === 0}>
                  <MessageCircle size={18} /> {loading ? "Creando pedido..." : "Confirmar por WhatsApp"}
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
