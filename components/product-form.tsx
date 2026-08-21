"use client";

import { Eye, EyeOff, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/money";

type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
};

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  maxSelections: number | null;
  options: ProductOption[];
};

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  imageUrls: string[];
  isVisible: boolean;
  category: { id: string; name: string; slug: string } | null;
  optionGroups: ProductOptionGroup[];
};

type OptionDraft = {
  name: string;
  priceDelta: string;
  isAvailable: boolean;
};

type GroupDraft = {
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  maxSelections: string;
  options: OptionDraft[];
};

type ProductDraft = {
  name: string;
  description: string;
  basePrice: string;
  promoPrice: string;
  categoryId: string;
  categoryName: string;
  imageUrls: string[];
  isVisible: boolean;
  optionGroups: GroupDraft[];
};

function emptyDraft(categories: CategoryListItem[]): ProductDraft {
  return {
    name: "",
    description: "",
    basePrice: "",
    promoPrice: "",
    categoryId: categories[0]?.id ?? "",
    categoryName: "",
    imageUrls: [],
    isVisible: true,
    optionGroups: []
  };
}

function productToDraft(product: ProductListItem): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? "",
    basePrice: String(product.basePrice),
    promoPrice: product.promoPrice ? String(product.promoPrice) : "",
    categoryId: product.category?.id ?? "",
    categoryName: "",
    imageUrls: product.imageUrls,
    isVisible: product.isVisible,
    optionGroups: product.optionGroups.map((group) => ({
      name: group.name,
      selectionType: group.selectionType,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections ? String(group.maxSelections) : "",
      options: group.options.map((option) => ({
        name: option.name,
        priceDelta: String(option.priceDelta),
        isAvailable: option.isAvailable
      }))
    }))
  };
}

function productToPayload(product: ProductListItem, overrides: Partial<ProductDraft> = {}) {
  const draft = { ...productToDraft(product), ...overrides };
  return draftToPayload(draft);
}

function draftToPayload(draft: ProductDraft) {
  return {
    name: draft.name,
    description: draft.description,
    basePrice: draft.basePrice,
    promoPrice: draft.promoPrice || null,
    categoryId: draft.categoryId === "__new" ? null : draft.categoryId || null,
    categoryName: draft.categoryId === "__new" ? draft.categoryName : undefined,
    imageUrls: draft.imageUrls,
    isVisible: draft.isVisible,
    optionGroups: draft.optionGroups
      .map((group) => ({
        name: group.name.trim(),
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        maxSelections: group.maxSelections || null,
        options: group.options
          .map((option) => ({
            name: option.name.trim(),
            priceDelta: option.priceDelta || "0",
            isAvailable: option.isAvailable
          }))
          .filter((option) => option.name)
      }))
      .filter((group) => group.name && group.options.length > 0)
  };
}

function effectivePrice(product: ProductListItem) {
  return product.promoPrice && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
}

function discountLabel(product: ProductListItem) {
  if (!product.promoPrice || product.promoPrice >= product.basePrice) {
    return null;
  }
  return `${Math.round((1 - product.promoPrice / product.basePrice) * 100)}% OFF`;
}

export function ProductForm({
  products: initialProducts,
  categories: initialCategories
}: {
  products: ProductListItem[];
  categories: CategoryListItem[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState<ProductDraft>(() => emptyDraft(initialCategories));
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = [product.name, product.description ?? "", product.category?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none" && !product.category) ||
        product.category?.id === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [categoryFilter, products, query]);

  async function refreshCategories() {
    const response = await fetch("/api/admin/categories");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setCategories(data.categories);
  }

  function resetDraft(nextCategories = categories) {
    setEditingProductId(null);
    setDraft(emptyDraft(nextCategories));
    setError("");
  }

  function openNewProduct() {
    resetDraft();
    setProductModalOpen(true);
  }

  function openEditProduct(product: ProductListItem) {
    setEditingProductId(product.id);
    setDraft(productToDraft(product));
    setError("");
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    resetDraft();
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateGroup(index: number, patch: Partial<GroupDraft>) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group))
    }));
  }

  function updateOption(groupIndex: number, optionIndex: number, patch: Partial<OptionDraft>) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              ...group,
              options: group.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? { ...option, ...patch } : option
              )
            }
          : group
      )
    }));
  }

  function addGroup() {
    setDraft((current) => ({
      ...current,
      optionGroups: [
        ...current.optionGroups,
        {
          name: "",
          selectionType: "MULTIPLE",
          isRequired: false,
          maxSelections: "",
          options: [{ name: "", priceDelta: "0", isAvailable: true }]
        }
      ]
    }));
  }

  function removeGroup(index: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.filter((_, groupIndex) => groupIndex !== index)
    }));
  }

  function addOption(groupIndex: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? { ...group, options: [...group.options, { name: "", priceDelta: "0", isAvailable: true }] }
          : group
      )
    }));
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? { ...group, options: group.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) }
          : group
      )
    }));
  }

  function setCover(index: number) {
    setDraft((current) => {
      const next = [...current.imageUrls];
      const [selected] = next.splice(index, 1);
      return { ...current, imageUrls: selected ? [selected, ...next] : next };
    });
  }

  function removeImage(index: number) {
    setDraft((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((_, imageIndex) => imageIndex !== index)
    }));
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const availableSlots = 6 - draft.imageUrls.length;
    if (availableSlots <= 0) {
      setError("El máximo es 6 imágenes por producto.");
      return;
    }

    setUploading(true);
    setError("");
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files).slice(0, availableSlots)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("scope", "products");
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "No se pudo subir la imagen");
        }
        uploadedUrls.push(data.url);
      }
      setDraft((current) => ({ ...current, imageUrls: [...current.imageUrls, ...uploadedUrls].slice(0, 6) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron subir las imágenes.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.categoryId === "__new" && !draft.categoryName.trim()) {
      setError("Ingresá el nombre de la nueva categoría.");
      return;
    }

    setLoading(true);
    setError("");
    const response = await fetch(editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
      method: editingProductId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftToPayload(draft))
    });
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo guardar el producto.");
      return;
    }

    setProducts((current) =>
      editingProductId ? current.map((product) => (product.id === editingProductId ? data.product : product)) : [data.product, ...current]
    );
    await refreshCategories();
    resetDraft();
    setProductModalOpen(false);
    router.refresh();
  }

  async function toggleProductVisibility(product: ProductListItem) {
    setError("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productToPayload(product, { isVisible: !product.isVisible }))
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el producto.");
      return;
    }
    setProducts((current) => current.map((item) => (item.id === product.id ? data.product : item)));
    router.refresh();
  }

  async function deleteProduct(product: ProductListItem) {
    if (!window.confirm(`Eliminar ${product.name}?`)) {
      return;
    }
    setError("");
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo eliminar el producto.");
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    await refreshCategories();
    if (editingProductId === product.id) {
      resetDraft();
      setProductModalOpen(false);
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-3 border-b border-line p-5 md:grid-cols-[1fr_220px_auto]">
          <input className="field" placeholder="Buscar producto o categoría" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="btn-primary whitespace-nowrap" type="button" onClick={openNewProduct}>
            <Plus size={17} /> Nuevo producto
          </button>
        </div>

        {error && !isProductModalOpen ? <p className="border-b border-line bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="divide-y divide-line">
          {filteredProducts.length === 0 ? (
            <p className="p-5 text-muted">Todavía no hay productos para mostrar.</p>
          ) : (
            filteredProducts.map((product) => {
              const label = discountLabel(product);
              return (
                <article key={product.id} className="grid gap-4 p-5 md:grid-cols-[88px_1fr_auto] md:items-center">
                  <div className="relative h-24 overflow-hidden rounded-2xl bg-surface md:h-22">
                    {product.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-muted">Sin imagen</div>
                    )}
                    {label ? (
                      <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[11px] font-black text-white">
                        {label}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black">{product.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${product.isVisible ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {product.isVisible ? "Visible" : "Oculto"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {product.category?.name ?? "Sin categoría"} · {product.imageUrls.length} imagen(es) · {product.optionGroups.length} grupo(s)
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <strong className={label ? "text-xl text-red-600" : "text-xl"}>{formatMoney(effectivePrice(product))}</strong>
                      {label ? <span className="font-bold text-muted line-through">{formatMoney(product.basePrice)}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button className="btn-secondary !px-3" type="button" onClick={() => toggleProductVisibility(product)}>
                      {product.isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                    <button
                      className="btn-secondary !px-3"
                      type="button"
                      onClick={() => openEditProduct(product)}
                    >
                      <Pencil size={17} /> Editar
                    </button>
                    <button className="btn-secondary !px-3 !text-red-600" type="button" onClick={() => deleteProduct(product)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {isProductModalOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 p-4 backdrop-blur-sm">
            <div className="mx-auto flex h-full max-w-3xl items-end md:items-center">
              <form onSubmit={saveProduct} className="panel max-h-[92vh] w-full overflow-auto p-5">
                <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{editingProductId ? "Editar" : "Nuevo"}</p>
              <h2 className="text-2xl font-black">Producto</h2>
            </div>
            <button className="rounded-full border border-line p-2" type="button" onClick={closeProductModal}>
              <X size={18} />
            </button>
          </div>

          <input className="field" placeholder="Nombre" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
          <textarea
            className="field min-h-20"
            placeholder="Descripción"
            value={draft.description}
            onChange={(event) => updateDraft("description", event.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              inputMode="numeric"
              placeholder="Precio base"
              value={draft.basePrice}
              onChange={(event) => updateDraft("basePrice", event.target.value)}
              required
            />
            <input
              className="field border-red-200 text-red-700"
              inputMode="numeric"
              placeholder="Precio promo"
              value={draft.promoPrice}
              onChange={(event) => updateDraft("promoPrice", event.target.value)}
            />
          </div>

          <select className="field" value={draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="__new">+ Nueva categoría</option>
          </select>
          {draft.categoryId === "__new" ? (
            <input
              className="field"
              placeholder="Nombre de categoría"
              value={draft.categoryName}
              onChange={(event) => updateDraft("categoryName", event.target.value)}
            />
          ) : null}

          <section className="rounded-2xl border border-line p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-black">Imágenes</h3>
              <label className="btn-secondary !px-3">
                <ImagePlus size={17} /> Subir
                <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => uploadImages(event.currentTarget.files)} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {draft.imageUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-1 bottom-1 flex gap-1">
                    <button
                      className="flex-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-black"
                      type="button"
                      onClick={() => setCover(index)}
                    >
                      {index === 0 ? "Portada" : "Portada"}
                    </button>
                    <button className="rounded-full bg-white/90 px-2 py-1 text-red-600" type="button" onClick={() => removeImage(index)}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {draft.imageUrls.length === 0 ? <div className="col-span-3 rounded-xl bg-surface p-4 text-center text-sm font-bold text-muted">Sin imágenes</div> : null}
            </div>
            {uploading ? <p className="mt-2 text-sm font-bold text-brand">Subiendo imágenes...</p> : null}
          </section>

          <section className="rounded-2xl border border-line p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-black">Extras / variantes</h3>
              <button className="btn-secondary !px-3" type="button" onClick={addGroup}>
                <Plus size={16} /> Grupo
              </button>
            </div>

            <div className="grid gap-3">
              {draft.optionGroups.map((group, groupIndex) => (
                <article key={groupIndex} className="rounded-2xl border border-line p-3">
                  <div className="grid gap-2">
                    <input className="field" placeholder="Grupo" value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className="field"
                        value={group.selectionType}
                        onChange={(event) => updateGroup(groupIndex, { selectionType: event.target.value as "SINGLE" | "MULTIPLE" })}
                      >
                        <option value="SINGLE">Una opción</option>
                        <option value="MULTIPLE">Varias opciones</option>
                      </select>
                      <input
                        className="field"
                        inputMode="numeric"
                        placeholder="Máximo"
                        value={group.maxSelections}
                        disabled={group.selectionType === "SINGLE"}
                        onChange={(event) => updateGroup(groupIndex, { maxSelections: event.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input type="checkbox" checked={group.isRequired} onChange={(event) => updateGroup(groupIndex, { isRequired: event.target.checked })} />
                      Requerido
                    </label>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {group.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="grid grid-cols-[1fr_92px_auto] gap-2">
                        <input
                          className="field !px-3 !py-2"
                          placeholder="Opción"
                          value={option.name}
                          onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })}
                        />
                        <input
                          className="field !px-3 !py-2"
                          placeholder="+$"
                          value={option.priceDelta}
                          onChange={(event) => updateOption(groupIndex, optionIndex, { priceDelta: event.target.value })}
                        />
                        <button className="rounded-xl border border-line px-2 text-red-600" type="button" onClick={() => removeOption(groupIndex, optionIndex)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => addOption(groupIndex)}>
                      <Plus size={15} /> Opción
                    </button>
                    <button className="btn-secondary !px-3 !py-2 text-sm !text-red-600" type="button" onClick={() => removeGroup(groupIndex)}>
                      <Trash2 size={15} /> Grupo
                    </button>
                  </div>
                </article>
              ))}
              {draft.optionGroups.length === 0 ? <p className="rounded-xl bg-surface p-3 text-sm font-bold text-muted">Sin extras ni variantes.</p> : null}
            </div>
          </section>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={draft.isVisible} onChange={(event) => updateDraft("isVisible", event.target.checked)} /> Visible
          </label>

          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

          <button className="btn-primary w-full" disabled={loading || uploading}>
            <Save size={18} /> {loading ? "Guardando..." : editingProductId ? "Guardar cambios" : "Crear producto"}
          </button>
                </div>
              </form>
            </div>
          </div>
      ) : null}
    </div>
  );
}
