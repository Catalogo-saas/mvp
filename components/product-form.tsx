"use client";

import { Download, Eye, EyeOff, Image as ImageIcon, Pencil, Plus, Settings2, Save, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { notifySuccess } from "@/lib/internal-notifications";
import { SaveOverlay } from "@/components/save-overlay";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { AdminDialog } from "@/components/admin-ui";
import { ProductCategoryPaths } from "@/components/product-category-paths";
import { ProductImages } from "@/components/product-images";
import { ProductVariantEditor } from "@/components/product-variant-editor";
import { categoryPath } from "@/lib/category-tree";
import { getImageUploadErrorMessage, prepareImageUploads, uploadImagesDirect, validateSelectedImage } from "@/lib/image-upload-client";
import type { ImageReference } from "@/lib/image-upload-contract";
import { formatMoney } from "@/lib/money";
import { normalizeVariants, variantCombinations } from "@/lib/product-variants";

type CategoryListItem = {
  parentId?: string | null;
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
  updatedAt: Date | string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  imageUrls: string[];
  isVisible: boolean;
  stockQuantity: number | null;
  sku: string | null;
  freeShipping: boolean;
  variants: unknown;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string } | null;
  assignedCategories: Array<{ id: string; name: string; slug: string }>;
  optionGroups: ProductOptionGroup[];
};

type ImageDraft = {
  id: string;
  url: string;
  file?: File;
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
  categoryIds: string[];
  images: ImageDraft[];
  isVisible: boolean;
  isFeatured: boolean;
  variantsEnabled: boolean;
  optionGroups: GroupDraft[];
  stockLimited: boolean;
  stockQuantity: string;
  sku: string;
  freeShipping: boolean;
  variants: Array<{ key: string; stockQuantity: string; basePrice: string; promoPrice: string; isVisible: boolean; imageUrl: string | null }>;
};

type ImportPreview = {
  rows: Array<Record<string, unknown> & { rowNumber: number; name: string; basePrice: number }>;
  errors: Array<{ rowNumber: number; message: string }>;
  total: number;
};

type VariantImagePickerState = {
  variantKey: string;
  selectedUrl: string | null;
};

const colorSuggestions = [
  { name: "Amarillo", color: "#facc15" },
  { name: "Azul", color: "#1d4ed8" },
  { name: "Beige", color: "#ede9d5" },
  { name: "Blanco", color: "#ffffff" },
  { name: "Bordó", color: "#991b1b" },
  { name: "Celeste", color: "#38bdf8" },
  { name: "Fucsia", color: "#e879f9" },
  { name: "Gris", color: "#9ca3af" },
  { name: "Marrón", color: "#92400e" },
  { name: "Naranja", color: "#f97316" },
  { name: "Negro", color: "#020617" },
  { name: "Plata", color: "#d1d5db" }
];

const sizeGroups = [
  { name: "Talles comunes", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { name: "Niños", values: ["2", "4", "6", "8", "10", "12", "14"] },
  { name: "Calzados", values: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"] }
];

function uniqueId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatInteger(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return Number(digits).toLocaleString("es-AR");
}

function unformatInteger(value: string) {
  return value.replace(/\D/g, "");
}

function imageDraftFromUrl(url: string): ImageDraft {
  return { id: url, url };
}

function revokeImagePreviews(images: ImageDraft[]) {
  images.forEach((image) => {
    if (image.file) {
      URL.revokeObjectURL(image.url);
    }
  });
}

function emptyDraft(): ProductDraft {
  return {
    name: "",
    description: "",
    basePrice: "",
    promoPrice: "",
    categoryId: "",
    categoryIds: [],
    images: [],
    isVisible: true,
    isFeatured: false,
    variantsEnabled: false,
    optionGroups: [],
    stockLimited: false,
    stockQuantity: "",
    sku: "",
    freeShipping: false,
    variants: []
  };
}

function productToDraft(product: ProductListItem): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? "",
    basePrice: formatInteger(product.basePrice),
    promoPrice: product.promoPrice ? formatInteger(product.promoPrice) : "",
    categoryId: product.category?.id ?? "",
    categoryIds: product.assignedCategories?.map((category) => category.id) ?? (product.category ? [product.category.id] : []),
    images: product.imageUrls.map(imageDraftFromUrl),
    isVisible: product.isVisible,
    isFeatured: product.isFeatured,
    variantsEnabled: product.optionGroups.some(group => group.selectionType === "SINGLE"),
    optionGroups: product.optionGroups.filter(group => group.selectionType === "SINGLE").map((group) => ({
      name: group.name,
      selectionType: "SINGLE",
      isRequired: true,
      maxSelections: "1",
      options: group.options.map((option) => ({
        name: option.name,
        priceDelta: "",
        isAvailable: option.isAvailable
      }))
    })),
    stockLimited: product.stockQuantity !== null,
    stockQuantity: product.stockQuantity === null ? "" : formatInteger(product.stockQuantity),
    sku: product.sku ?? "",
    freeShipping: product.freeShipping,
    variants: normalizeVariants(product.variants).map((variant) => ({ key: variant.key, stockQuantity: variant.stockQuantity === null ? "" : String(variant.stockQuantity), basePrice: variant.basePrice === null ? "" : formatInteger(variant.basePrice), promoPrice: variant.promoPrice === null ? "" : formatInteger(variant.promoPrice), isVisible: variant.isVisible, imageUrl: variant.imageUrl }))
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
    basePrice: unformatInteger(draft.basePrice) || unformatInteger(draft.variants.find((item) => item.basePrice)?.basePrice ?? "") || "0",
    promoPrice: !draft.variantsEnabled && draft.promoPrice ? unformatInteger(draft.promoPrice) : null,
    categoryId: draft.categoryId || null,
    categoryIds: draft.categoryIds,
    images: draft.images.filter((image) => !image.file).map((image) => ({ kind: "stored", url: image.url } satisfies ImageReference)),
    isVisible: draft.isVisible,
    isFeatured: draft.isFeatured,
    stockQuantity: draft.variantsEnabled || draft.stockQuantity === "" ? null : unformatInteger(draft.stockQuantity),
    sku: draft.sku || null,
    freeShipping: draft.freeShipping,
    variants: draft.variantsEnabled ? variantCombinations(draft.optionGroups).map(({ key }) => {
      const variant = draft.variants.find((item) => item.key === key);
      const imageIndex = draft.images.findIndex((image) => image.url === variant?.imageUrl);
      return { key, stockQuantity: variant?.stockQuantity ? Number(unformatInteger(variant.stockQuantity)) : null, basePrice: variant?.basePrice ? Number(unformatInteger(variant.basePrice)) : Number(unformatInteger(draft.basePrice)) || null, promoPrice: variant?.promoPrice ? Number(unformatInteger(variant.promoPrice)) : null, isVisible: variant?.isVisible ?? true, imageUrl: imageIndex < 0 || variant?.imageUrl?.startsWith("blob:") ? null : variant?.imageUrl ?? null, imageIndex: imageIndex < 0 ? undefined : imageIndex };
    }) : [],
    optionGroups: draft.variantsEnabled
      ? draft.optionGroups
          .map((group) => ({
            name: group.name.trim(),
            selectionType: "SINGLE" as const,
            isRequired: true as const,
            maxSelections: 1 as const,
            options: group.options
              .map((option) => ({
                name: option.name.trim(),
                priceDelta: "0" as const,
                isAvailable: option.isAvailable
              }))
              .filter((option) => option.name)
          }))
          .filter((group) => group.name && group.options.length > 0)
      : []
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

function stockLabel(product: ProductListItem) {
  if (product.stockQuantity === null) {
    return "Stock ilimitado";
  }
  if (product.stockQuantity <= 0) {
    return "Sin stock";
  }
  return `Stock: ${product.stockQuantity}`;
}

function PriceInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  tone = "default",
  required = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  tone?: "default" | "promo";
  required?: boolean;
}) {
  return (
    <div className="relative">
      <span className={`pointer-events-none absolute inset-y-0 left-4 flex items-center pb-px font-black ${tone === "promo" ? "text-red-600" : "text-ink"}`}>$</span>
      <input
        className={`field !pl-9 ${tone === "promo" ? "border-red-200 text-red-700" : ""}`}
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        required={required}
        onChange={(event) => onChange(formatInteger(event.target.value))}
      />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
      <span>
        <span className="block font-black">{label}</span>
        {description ? <span className="mt-1 block text-sm font-semibold text-muted">{description}</span> : null}
      </span>
      <button
        className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? "bg-brand" : "bg-slate-300"}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export function ProductForm({
  products: initialProducts,
  categories: initialCategories,
  editorMode
}: {
  products: ProductListItem[];
  categories: CategoryListItem[];
  storeTemplate: string;
  showFeatured: boolean;
  editorMode?: { type: "new" } | { type: "edit"; productId: string };
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLFormElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const observer = new ResizeObserver(() => editorRef.current?.style.setProperty("--product-footer-height", `${footer.getBoundingClientRect().height}px`));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const { setHasUnsavedChanges, confirm, confirmNavigation } = useUnsavedChanges();
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState<ProductDraft>(() => editorMode?.type === "edit" ? productToDraft(initialProducts.find((product) => product.id === editorMode.productId)!) : emptyDraft());
  const [initialDraft] = useState(() => JSON.stringify(draft));
  const [didSave, setDidSave] = useState(false);
  useDirtyForm(!didSave && JSON.stringify(draft) !== initialDraft);
  const [editingProductId, setEditingProductId] = useState<string | null>(editorMode?.type === "edit" ? editorMode.productId : null);
  const [isProductModalOpen, setProductModalOpen] = useState(Boolean(editorMode));
  const [variantEditorOpen, setVariantEditorOpen] = useState(false);
  const [variantImagePicker, setVariantImagePicker] = useState<VariantImagePickerState | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  useLockBodyScroll((isProductModalOpen && !editorMode) || variantEditorOpen || Boolean(variantImagePicker) || isImportModalOpen);

  const variantCombinationsList = useMemo(() => variantCombinations(draft.optionGroups), [draft.optionGroups]);

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
    try {
      const response = await fetch("/api/admin/categories");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setCategories(data.categories);
    } catch {
      // The product was already saved; the next refresh will reconcile categories.
    }
  }

  function replaceDraft(nextDraft: ProductDraft) {
    setDraft((current) => {
      revokeImagePreviews(current.images);
      return nextDraft;
    });
  }

  function resetDraft() {
    setEditingProductId(null);
    replaceDraft(emptyDraft());
    setVariantEditorOpen(false);
    setError("");
  }

  function openNewProduct() {
    router.push("/gestion/productos/nuevo");
  }

  function openEditProduct(product: ProductListItem) {
    if (!editorMode) { router.push(`/gestion/productos/${product.id}/editar`); return; }
    setEditingProductId(product.id);
    replaceDraft(productToDraft(product));
    setVariantEditorOpen(false);
    setError("");
    setProductModalOpen(true);
  }

  async function closeProductModal() {
    if (editorMode) { if (await confirmNavigation()) router.push("/gestion/productos"); return; }
    setProductModalOpen(false);
    resetDraft();
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateVariant(key: string, patch: Partial<ProductDraft["variants"][number]>) {
    setDraft((current) => {
      const existing = current.variants.find((variant) => variant.key === key) ?? { key, stockQuantity: "", basePrice: current.basePrice, promoPrice: current.promoPrice, isVisible: true, imageUrl: null };
      return { ...current, variants: [...current.variants.filter((variant) => variant.key !== key), { ...existing, ...patch }] };
    });
  }

  function openVariantImagePicker(variantKey: string) {
    const variant = draft.variants.find((item) => item.key === variantKey);
    setVariantImagePicker({ variantKey, selectedUrl: variant?.imageUrl ?? null });
  }

  function applyVariantImageSelection() {
    if (!variantImagePicker) return;
    updateVariant(variantImagePicker.variantKey, { imageUrl: variantImagePicker.selectedUrl });
    setVariantImagePicker(null);
  }

  function removeImage(index: number) {
    setDraft((current) => {
      const image = current.images[index];
      if (image?.file) {
        URL.revokeObjectURL(image.url);
      }
      return {
        ...current,
        images: current.images.filter((_, imageIndex) => imageIndex !== index),
        variants: current.variants.map(variant => variant.imageUrl === image?.url ? { ...variant, imageUrl: null } : variant)
      };
    });
  }

  function addImageFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const availableSlots = 6 - draft.images.length;
    if (availableSlots <= 0) {
      setError("El máximo es 6 imágenes por producto.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots);
    const invalidFile = selectedFiles.find((file) => validateSelectedImage(file));
    if (invalidFile) {
      setError(validateSelectedImage(invalidFile) ?? "Imagen inválida.");
      return;
    }

    prepareImageUploads(selectedFiles.map((file) => ({ scope: "products", file })));

    const nextImages = selectedFiles
      .map((file) => ({
        id: uniqueId(),
        url: URL.createObjectURL(file),
        file
      }));

    setError("");
    setDraft((current) => ({ ...current, images: [...current.images, ...nextImages].slice(0, 6) }));
  }

  function toggleVariants(checked: boolean) {
    setDraft((current) => ({ ...current, variantsEnabled: checked }));
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const combinations = draft.variantsEnabled ? variantCombinations(draft.optionGroups) : [];
    if (draft.variantsEnabled && draft.optionGroups.some((group) => group.selectionType === "SINGLE") && !combinations.length) {
      setError("Hay más de 100 combinaciones o falta completar una propiedad.");
      return;
    }
    if (!unformatInteger(draft.basePrice) && (!combinations.length || combinations.some(({ key }) => !unformatInteger(draft.variants.find((variant) => variant.key === key)?.basePrice ?? "")))) {
      setError("Ingresá un precio para cada combinación.");
      return;
    }
    if (!draft.variantsEnabled && draft.promoPrice && Number(unformatInteger(draft.promoPrice)) >= Number(unformatInteger(draft.basePrice))) {
      setError("El precio de oferta debe ser menor al precio base.");
      return;
    }
    for (const combination of combinations) {
      const variant = draft.variants.find((item) => item.key === combination.key);
      const price = Number(unformatInteger(variant?.basePrice || draft.basePrice));
      const offer = Number(unformatInteger(variant?.promoPrice || ""));
      if (offer && offer >= price) {
        setError(`La oferta de ${combination.label} debe ser menor que su precio.`);
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const pendingImages = draft.images.filter((image): image is ImageDraft & { file: File } => Boolean(image.file));
      const uploadedImages = await uploadImagesDirect(
        pendingImages.map((image) => ({ scope: "products", file: image.file }))
      );
      let uploadedIndex = 0;
      const images: ImageReference[] = draft.images.map((image) =>
        image.file
          ? uploadedImages[uploadedIndex++]
          : { kind: "stored", url: image.url }
      );

      const payload = { ...draftToPayload(draft), images, ...(editingProductId ? {expectedUpdatedAt: new Date(products.find(product=>product.id===editingProductId)!.updatedAt).toISOString()} : {}) };
      const response = await fetch(editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "No pudimos guardar el producto. Intentá nuevamente.");
        return;
      }

      setProducts((current) =>
        editingProductId ? current.map((product) => (product.id === editingProductId ? data.product : product)) : [data.product, ...current]
      );
      void refreshCategories();
      setDidSave(true);
      setHasUnsavedChanges(false);
      resetDraft();
      setProductModalOpen(false);
      if (editorMode) router.push("/gestion/productos");
      router.refresh();
      notifySuccess(editingProductId ? "Producto actualizado." : "Producto creado.");
    } catch (saveError) {
      setError(getImageUploadErrorMessage(saveError) ?? "No pudimos guardar el producto. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
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
    notifySuccess(product.isVisible ? "Producto oculto." : "Producto visible.");
  }

  async function deleteProduct(product: ProductListItem) {
    if (!await confirm({ title: "Eliminar producto", message: `¿Eliminar ${product.name}?`, confirmLabel: "Eliminar", destructive: true })) {
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
    notifySuccess("Producto eliminado.");
  }

  async function previewImport(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/products/import/preview", { method: "POST", body: form });
    const data = await response.json().catch(() => null);
    setImporting(false);
    if (!response.ok) { setError(data?.error ?? "No se pudo leer el archivo."); return; }
    setImportPreview(data);
  }

  function closeImportModal() {
    if (importing) return;
    setImportPreview(null);
    setImportModalOpen(false);
    setError("");
  }

  async function commitImport() {
    if (!importPreview?.rows.length) return;
    setImporting(true);
    const response = await fetch("/api/admin/products/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: importPreview.rows }) });
    const data = await response.json().catch(() => null);
    setImporting(false);
    if (!response.ok) { setError(data?.error ?? "No se pudo importar el catálogo."); return; }
    setImportPreview(null);
    setImportModalOpen(false);
    router.refresh();
    window.location.reload();
  }

  async function applyBulkAction(action: "show" | "hide") {
    if (!selectedProductIds.length) return;
    const response = await fetch("/api/admin/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: selectedProductIds, action }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "No se pudieron actualizar los productos."); return; }
    setProducts((current) => current.map((product) => selectedProductIds.includes(product.id) ? { ...product, isVisible: action === "show" } : product));
    setSelectedProductIds([]);
    notifySuccess(action === "show" ? "Productos visibles." : "Productos ocultos.");
  }

  return (
    <div className="grid gap-6">
      <section className={editorMode ? "hidden" : "panel overflow-hidden"}>
        <div className="grid gap-3 border-b border-line p-4 sm:p-5 md:grid-cols-[1fr_220px_auto]">
          <label className="grid gap-2 text-sm font-bold">
            Buscar
            <input className="field" placeholder="Producto o categoría" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Categoría
            <select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas las categorías</option>
              <option value="none">Sin categoría</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {categoryPath(category.id,categories.map(c=>({...c,parentId:c.parentId??null})))}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 md:mt-auto md:flex md:justify-end"><button className="btn-secondary w-full !px-3" type="button" onClick={() => { setError(""); setImportPreview(null); setImportModalOpen(true); }}><Upload size={16} /> Importar</button><Link className="btn-secondary w-full !px-3" href="/api/admin/products/export"><Download size={16} /> Exportar</Link><button className="btn-primary col-span-2 w-full whitespace-nowrap md:w-auto" type="button" onClick={openNewProduct}><Plus size={17} /> Nuevo</button></div>
        </div>

        {selectedProductIds.length ? <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface p-3 text-sm"><strong>{selectedProductIds.length} seleccionados</strong><button className="btn-secondary !px-3 !py-2" type="button" onClick={() => applyBulkAction("show")}>Mostrar</button><button className="btn-secondary !px-3 !py-2" type="button" onClick={() => applyBulkAction("hide")}>Ocultar</button><button className="ml-auto text-sm font-black text-muted" type="button" onClick={() => setSelectedProductIds([])}>Cancelar</button></div> : null}

        {error && !isProductModalOpen ? <p className="border-b border-line bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="divide-y divide-line">
          {filteredProducts.length === 0 ? (
            <p className="p-5 text-muted">Todavía no hay productos para mostrar.</p>
          ) : (
            filteredProducts.map((product) => {
              const label = discountLabel(product);
              return (
                <article key={product.id} className="grid gap-4 p-4 sm:p-5 md:grid-cols-[auto_112px_1fr_auto] md:items-center">
                  <input className="h-5 w-5" type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />
                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface md:aspect-square">
                    {product.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-muted">Sin imagen</div>
                    )}
                    {label ? (
                      <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[11px] font-black text-white">
                        {label}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black leading-tight md:truncate">{product.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${product.isVisible ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {product.isVisible ? "Visible" : "Oculto"}
                      </span>
                      {product.stockQuantity === 0 ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700">Sin stock</span> : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {product.category?.name ?? "Sin categoría"} · {product.imageUrls.length} imagen(es) · {product.optionGroups.length} variante(s) · {stockLabel(product)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <strong className={label ? "text-2xl text-red-600" : "text-2xl"}>{formatMoney(effectivePrice(product))}</strong>
                      {label ? <span className="font-bold text-muted line-through">{formatMoney(product.basePrice)}</span> : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
                    <button className="btn-secondary !px-3" type="button" onClick={() => toggleProductVisibility(product)} aria-label={product.isVisible ? "Ocultar producto" : "Mostrar producto"}>
                      {product.isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                    <button className="btn-secondary !px-3" type="button" onClick={() => openEditProduct(product)}>
                      <Pencil size={17} /> Editar
                    </button>
                    <button className="btn-secondary !px-3 !text-red-600" type="button" onClick={() => deleteProduct(product)} aria-label="Eliminar producto">
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
        <div className={editorMode ? "product-editor-page" : "fixed inset-0 z-50 flex items-end bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"}>
          <form ref={editorRef} onSubmit={saveProduct} aria-busy={loading} className="product-editor-form panel grid h-[100dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden !rounded-none p-5 sm:h-auto sm:max-h-[calc(100dvh-32px)] sm:!rounded-[24px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black">{editingProductId ? "Editar producto" : "Nuevo producto"}</h1>
              </div>
              <button className="rounded-full border border-line p-2" type="button" onClick={closeProductModal} aria-label="Cerrar producto">
                <X size={18} />
              </button>
            </div>

            <div className="product-editor-body grid gap-4 overflow-y-auto pb-6 pr-1">
              <label className="grid gap-2 text-sm font-bold">
                Nombre
                <input className="field" placeholder="Zapatillas urbanas" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Descripción
                <textarea className="field min-h-20" placeholder="Detalle breve del producto" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">SKU (opcional)<input className="field" value={draft.sku} onChange={(event) => updateDraft("sku", event.target.value)} /></label>
              <Switch checked={draft.freeShipping} onChange={(checked) => updateDraft("freeShipping", checked)} label="Envío gratis para este producto" description="Si todos los productos del carrito tienen esta opción, la entrega será gratis." />

              {!draft.variantsEnabled || !variantCombinations(draft.optionGroups).length ? <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold">
                  Precio
                  <PriceInput value={draft.basePrice} onChange={(value) => updateDraft("basePrice", value)} placeholder="Precio de venta" />
                </label>
                <label className="grid gap-2 text-sm font-bold">Oferta<PriceInput value={draft.promoPrice} onChange={(value) => updateDraft("promoPrice", value)} placeholder="Precio de venta con oferta" tone="promo" /></label>
                <label className="grid gap-2 text-sm font-bold">Stock<input className="field" inputMode="numeric" placeholder="Infinito ∞" value={draft.stockQuantity} onChange={(event) => updateDraft("stockQuantity", formatInteger(event.target.value))} /><small className="font-normal text-muted">Si se deja vacío, se considerará como stock ilimitado.</small></label>
                <Switch checked={draft.isVisible} onChange={(checked) => updateDraft("isVisible", checked)} label="Visibilidad" description="Mostrar este producto en la tienda." />
              </div> : null}

              <ProductCategoryPaths categories={categories} primary={draft.categoryId} selected={draft.categoryIds} onChange={ids => setDraft(current => ({ ...current, categoryId: ids[0] ?? "", categoryIds: ids }))}/>
              <ProductImages images={draft.images} onChange={images => updateDraft("images", images)} onRemove={removeImage} onAdd={addImageFiles} error={error}/>

              <Switch
                checked={draft.variantsEnabled}
                onChange={toggleVariants}
                label="Variantes"
                description="Usá color, talle o presentación para que el cliente elija una variante."
              />

              {draft.variantsEnabled ? (
                <section className="product-section product-variant-section">
                  <h3>Propiedades</h3>
                  <div className="variant-property-summary">{draft.optionGroups.map(group => <div key={group.name}><h4>{group.name}</h4><div className="variant-chips">{group.options.map(option => <span key={option.name}>{option.name}</span>)}</div></div>)}</div>
                  {!draft.optionGroups.length && <p>Agregá propiedades como talle o color para crear las variantes.</p>}
                  <button className="btn-primary variant-edit-button" type="button" onClick={() => setVariantEditorOpen(true)}><Settings2 size={18}/>{draft.optionGroups.length ? "Editar variantes" : "Agregar variantes"}</button>

                  {variantCombinationsList.length ? <div className="variant-combinations">
                    <header className="variant-combinations-header">
                      <div>
                        <h3>Variantes creadas</h3>
                        <p id="variant-stock-help">Stock vacío = ilimitado. La oferta es opcional.</p>
                      </div>
                      <span>{variantCombinationsList.length.toLocaleString("es-AR")} {variantCombinationsList.length === 1 ? "variante" : "variantes"}</span>
                    </header>
                    <p className="variant-scroll-hint">Deslizá la tabla para ver todas las columnas.</p>
                    <div className="variant-table-scroll" role="region" aria-label="Tabla de variantes" tabIndex={0}>
                      <table className="variant-table">
                        <caption className="sr-only">Stock, precio, oferta, foto y visibilidad de cada variante</caption>
                        <thead>
                          <tr>
                            <th scope="col">Foto</th>
                            <th scope="col">Variante</th>
                            <th scope="col">Stock</th>
                            <th scope="col">Precio</th>
                            <th scope="col">Oferta</th>
                            <th scope="col">Visible</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantCombinationsList.map((combination) => {
                            const value = draft.variants.find((variant) => variant.key === combination.key);
                            const selectedImage = value?.imageUrl
                              ? draft.images.find((image) => image.url === value.imageUrl)
                              : draft.images[0];
                            return <tr key={combination.key}>
                              <td>
                                <div className="variant-photo-control">
                                  <button className="variant-photo-button" type="button" aria-label={`Seleccionar foto para ${combination.label}`} onClick={() => openVariantImagePicker(combination.key)}>
                                    <span className="variant-photo-preview">
                                      {selectedImage ? <Image src={selectedImage.url} alt="" width={42} height={42} sizes="42px" /> : <ImageIcon size={19} aria-hidden="true" />}
                                    </span>
                                  </button>
                                </div>
                              </td>
                              <th scope="row" className="variant-name">{combination.label}</th>
                              <td>
                                <input className="field" inputMode="numeric" aria-label={`Stock de ${combination.label}`} aria-describedby="variant-stock-help" value={value?.stockQuantity ?? ""} onChange={(event) => updateVariant(combination.key, { stockQuantity: formatInteger(event.target.value) })} placeholder="∞" />
                              </td>
                              <td>
                                <PriceInput value={value?.basePrice ?? draft.basePrice} onChange={(price) => updateVariant(combination.key, { basePrice: price })} placeholder="Precio" ariaLabel={`Precio de ${combination.label}`} />
                              </td>
                              <td>
                                <PriceInput value={value?.promoPrice ?? draft.promoPrice} onChange={(price) => updateVariant(combination.key, { promoPrice: price })} placeholder="Sin oferta" tone="promo" ariaLabel={`Oferta de ${combination.label}`} />
                              </td>
                              <td>
                                <label className="variant-visible-control">
                                  <input type="checkbox" aria-label={`Mostrar ${combination.label} en la tienda`} checked={value?.isVisible ?? true} onChange={(event) => updateVariant(combination.key, { isVisible: event.target.checked })} />
                                  <span>Visible</span>
                                </label>
                              </td>
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div> : null}
                </section>
              ) : null}

            </div>

            <div ref={footerRef} className="product-editor-footer -mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              {error ? <p className="mb-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
              <button className="btn-primary w-full" disabled={loading}>
                <Save size={18} /> {editingProductId ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isImportModalOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Importar productos">
          <section className="panel product-import-dialog grid max-h-[90dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <header className="flex items-start justify-between gap-4 border-b border-line p-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Importar catálogo</p><h2 className="mt-1 text-2xl font-black">{importPreview ? "Revisá antes de confirmar" : "Subí tus productos"}</h2>{importPreview ? <p className="mt-1 text-sm text-muted">{importPreview.rows.length} listos · {importPreview.errors.length} con errores · {importPreview.total} filas</p> : <p className="mt-1 text-sm text-muted">Descargá la plantilla, completala y seleccioná el archivo.</p>}</div><button className="btn-secondary !h-10 !w-10 !p-0" type="button" onClick={closeImportModal} aria-label="Cerrar importación"><X size={17} /></button></header>
            {importPreview ? <div className="overflow-auto p-5"><div className="grid gap-2">{importPreview.rows.slice(0, 100).map((row) => <div key={row.rowNumber} className="grid grid-cols-[54px_1fr_auto] gap-3 rounded-xl border border-line p-3 text-sm"><span className="text-muted">Fila {row.rowNumber}</span><strong className="truncate">{row.name}</strong><span>{formatMoney(row.basePrice)}</span></div>)}</div>{importPreview.rows.length > 100 ? <p className="mt-3 text-sm text-muted">Se muestran las primeras 100 filas válidas.</p> : null}{importPreview.errors.length ? <div className="mt-5 rounded-2xl bg-red-50 p-4"><h3 className="font-black text-red-800">Filas a corregir</h3><ul className="mt-2 grid gap-1 text-sm text-red-700">{importPreview.errors.slice(0, 20).map((item) => <li key={item.rowNumber}>Fila {item.rowNumber}: {item.message}</li>)}</ul></div> : null}</div> : <div className="grid gap-4 overflow-auto p-5"><Link className="btn-secondary w-full" href="/api/admin/products/export?mode=template"><Download size={17} /> Descargar plantilla</Link><label className="grid cursor-pointer place-items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface p-8 text-center"><Upload className="text-brand" size={28} /><span className="font-black">{importing ? "Leyendo archivo..." : "Seleccionar archivo"}</span><span className="text-sm text-muted">Excel o CSV · hasta 500 productos</span><input className="sr-only" type="file" accept=".csv,.xlsx,.xls" disabled={importing} onChange={(event) => { void previewImport(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>{error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}</div>}
            {importPreview ? <footer className="grid gap-2 border-t border-line bg-white p-4 sm:grid-cols-2"><button className="btn-secondary" type="button" onClick={() => { setImportPreview(null); setError(""); }}>Elegir otro archivo</button><button className="btn-primary" type="button" disabled={importing || !importPreview.rows.length || Boolean(importPreview.errors.length)} onClick={commitImport}>{importing ? "Importando..." : `Importar ${importPreview.rows.length} productos`}</button></footer> : <footer className="border-t border-line bg-white p-4"><button className="btn-secondary w-full" type="button" onClick={closeImportModal}>Cancelar</button></footer>}
          </section>
        </div>
      ) : null}

      {variantEditorOpen && <ProductVariantEditor groups={draft.optionGroups} suggestions={{ Talle: sizeGroups, Color: [{ name: "Colores sugeridos", values: colorSuggestions.map(color => color.name) }], Presentación: [{ name: "Presentaciones", values: ["Unidad", "Pack x2", "Pack x3"] }] }} onChange={optionGroups => setDraft(current => ({ ...current, variantsEnabled: true, optionGroups }))} onClose={() => setVariantEditorOpen(false)}/>}
      {variantImagePicker && <AdminDialog
        open
        title="Selecciona una imagen"
        centeredMobile
        wide
        onClose={() => setVariantImagePicker(null)}
        footer={<button className="btn-primary" type="button" onClick={applyVariantImageSelection}>Aceptar</button>}
      >
        {draft.images.length ? <div className="variant-image-picker" role="group" aria-label="Imágenes del producto">
          {draft.images.map((image, index) => {
            const isSelected = variantImagePicker.selectedUrl === image.url || (variantImagePicker.selectedUrl === null && index === 0);
            return <button
              key={image.id}
              type="button"
              className={`variant-image-option${isSelected ? " is-selected" : ""}`}
              aria-label={`Foto ${index + 1}${index === 0 ? ", imagen principal" : ""}`}
              aria-pressed={isSelected}
              onClick={() => setVariantImagePicker((current) => current ? { ...current, selectedUrl: image.url } : current)}
            >
              <Image src={image.url} alt="" width={640} height={840} sizes="(max-width: 767px) 320px, 25vw" />
            </button>;
          })}
        </div> : <p className="variant-image-picker-empty">Agregá fotos al producto para elegir una imagen para esta variante.</p>}
      </AdminDialog>}
      {loading ? <SaveOverlay title="Guardando producto…" /> : null}
    </div>
  );
}
