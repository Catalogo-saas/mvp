"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Eye, EyeOff, SlidersHorizontal, ImageIcon, Package, Pencil, Plus, QrCode, Share2, Trash2, Upload, Download, ChevronDown } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { AdminDialog, AdminPageHeader, AdminPagination } from "@/components/admin-ui";
import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { formatMoney } from "@/lib/money";
import { AdminActionMenu, type AdminMenuAction } from "@/components/admin-action-menu";
import { ProductFilters } from "@/components/product-filters";
import { useCatalogSearch } from "@/components/use-catalog-search";
import { normalizeVariants, variantCombinations } from "@/lib/product-variants";
import { getCatalogPrices } from "@/lib/catalog";
import { notifyError, notifySuccess } from "@/lib/internal-notifications";

type Product = { id: string; name: string; slug: string; sku: string | null; imageUrls: string[]; basePrice: number; promoPrice: number | null; stockQuantity: number | null; isVisible: boolean; isFeatured: boolean; updatedAt: string; variants: unknown; assignedCategories: Array<{ id: string; name: string }>; optionGroups: Array<{ name: string; selectionType: string; isRequired: boolean; options: Array<{ name: string }> }> };
type Category = { id: string; name: string; parentId: string | null };
type QuickDraft = { basePrice: string; promoPrice: string; stockQuantity: string; variants: Array<{ key: string; label: string; basePrice: string; promoPrice: string; stockQuantity: string; isVisible: boolean; imageUrl: string | null }> };
type Page = { products: Product[]; total: number; page: number; pageSize: number };

function quickDraft(product: Product): QuickDraft {
  const labels = new Map(variantCombinations(product.optionGroups).map(v => [v.key, v.label]));
  return { basePrice: String(product.basePrice), promoPrice: product.promoPrice === null ? "" : String(product.promoPrice), stockQuantity: product.stockQuantity === null ? "" : String(product.stockQuantity), variants: normalizeVariants(product.variants).map(v => ({ key: v.key, label: labels.get(v.key) ?? v.key, basePrice: v.basePrice === null ? "" : String(v.basePrice), promoPrice: v.promoPrice === null ? "" : String(v.promoPrice), stockQuantity: v.stockQuantity === null ? "" : String(v.stockQuantity), isVisible: v.isVisible, imageUrl: v.imageUrl })) };
}
function catalogSummary(product: Product) {
  const variants = normalizeVariants(product.variants);
  const prices = getCatalogPrices(product);
  return {
    hasVariants: variants.length > 0,
    price: `${variants.length ? "Desde " : ""}${formatMoney(prices.effective)}`,
    regular: prices.regular > prices.effective ? formatMoney(prices.regular) : null,
    stock: variants.length ? "Por variante" : product.stockQuantity === null ? "Ilimitado" : `${product.stockQuantity} unidades`,
  };
}
export function CatalogManager({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const { confirm } = useUnsavedChanges();
  const router = useRouter();
  const params = useSearchParams();
  const queryString = params.toString();
  const [query, setQuery] = useCatalogSearch(queryString);
  const [page, setPage] = useState<Page>({ products: [], total: 0, page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [quick, setQuick] = useState<Product | null>(null);
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<Product | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<{ rows: Array<Record<string, unknown> & { rowNumber: number; name: string; basePrice: number }>; errors: Array<{ rowNumber: number; message: string }> } | null>(null);
  const dirty = Boolean(quick && draft && JSON.stringify(draft) !== JSON.stringify(quickDraft(quick)));
  useDirtyForm(dirty);
  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams(queryString); if (!search.has("page")) search.set("page", "1");
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    fetch(`/api/admin/products?${search}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!controller.signal.aborted) { setPage(data); setSelected([]); } }).catch(error => { if (error.name !== "AbortError") notifyError(error.message || "No se pudo cargar el catálogo."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [queryString, revision]);
  function navigate(values: Record<string, string>) { const search = new URLSearchParams(queryString); search.set("page", "1"); Object.entries(values).forEach(([key, value]) => value && value !== "all" && value !== "default" ? search.set(key, value) : search.delete(key)); router.push(`/gestion/productos?${search}`, { scroll: false }); }
  function openQuick(product: Product) { setQuick(product); setDraft(quickDraft(product)); }
  async function closeQuick() { if (busy) return; if (dirty && !await confirm({ title: "Descartar cambios", message: "¿Descartar los cambios de este producto?", confirmLabel: "Descartar", destructive: true })) return; setQuick(null); setDraft(null); }
  function productUrl(product: Product) { return `${window.location.origin}/${storeSlug}/producto/${encodeURIComponent(product.slug)}`; }
  function downloadProductQr() {
    if (!qr || !qrCanvasRef.current) return;
    try {
      const link = document.createElement("a");
      link.href = qrCanvasRef.current.toDataURL("image/png");
      link.download = `qr-${qr.slug}.png`;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (failure) {
      notifyError(failure instanceof Error ? failure.message : "No se pudo descargar el código QR.");
    }
  }
  async function request(url: string, method: string, body?: unknown) { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo completar la acción."); return data; }
  async function mutate(product: Product, changes: Record<string, unknown>) { setBusy(true); try { await request(`/api/admin/products/${product.id}`, "PATCH", { expectedUpdatedAt: product.updatedAt, ...changes }); setRevision(v => v + 1); notifySuccess("Producto actualizado."); return true; } catch (error) { notifyError(error instanceof Error ? error.message : "No hay conexión."); return false; } finally { setBusy(false); } }
  async function saveQuick(event: React.FormEvent) { event.preventDefault(); if (!quick || !draft) return; const nullable = (value: string) => value === "" ? null : Number(value); const changes = draft.variants.length ? { variants: draft.variants.map(v => ({ key: v.key, basePrice: nullable(v.basePrice), promoPrice: nullable(v.promoPrice), stockQuantity: nullable(v.stockQuantity), isVisible: v.isVisible, imageUrl: v.imageUrl })) } : { basePrice: Number(draft.basePrice), promoPrice: nullable(draft.promoPrice), stockQuantity: nullable(draft.stockQuantity) }; const ok = await mutate(quick, changes); if (ok) { setQuick(null); setDraft(null); } }
  async function bulk(action: string) { setBusy(true); try { await request("/api/admin/products/bulk", "POST", { productIds: selected, action }); setRevision(v => v + 1); notifySuccess("Selección actualizada."); } catch (error) { notifyError(String(error)); } finally { setBusy(false); } }
  async function duplicate(product: Product) { setBusy(true); try { const result = await request(`/api/admin/products/${product.id}/duplicate`, "POST"); notifySuccess("Producto duplicado."); router.push(`/gestion/productos/${result.product.id}/editar`); } catch (error) { notifyError(String(error)); } finally { setBusy(false); } }
  async function remove(product: Product) { if (!await confirm({ title: "Eliminar producto", message: `¿Eliminar “${product.name}”? Esta acción no se puede deshacer.`, confirmLabel: "Eliminar", destructive: true })) return; setBusy(true); try { await request(`/api/admin/products/${product.id}`, "DELETE"); setRevision(v => v + 1); notifySuccess("Producto eliminado."); } catch (error) { notifyError(String(error)); } finally { setBusy(false); } }
  async function share(product: Product) { try { if (navigator.share) await navigator.share({ title: product.name, url: productUrl(product) }); else { await navigator.clipboard.writeText(productUrl(product)); notifySuccess("Enlace copiado."); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) notifyError("No se pudo compartir el enlace."); } }
  async function previewImport(file?: File) { if (!file) return; setBusy(true); try { const body = new FormData(); body.append("file", file); const response = await fetch("/api/admin/products/import/preview", { method: "POST", body }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setImportData(data); } catch (error) { notifyError(String(error)); } finally { setBusy(false); } }
  async function importProducts() { if (!importData) return; setBusy(true); try { await request("/api/admin/products/import/commit", "POST", { rows: importData.rows }); setImportOpen(false); setImportData(null); setRevision(v => v + 1); notifySuccess("Productos importados."); } catch (error) { notifyError(String(error)); } finally { setBusy(false); } }
  function productActions(product: Product): AdminMenuAction[] {
    return [
      { label: "Duplicar producto", icon: Copy, disabled: busy, onSelect: () => void duplicate(product) },
      { label: "Editar producto", icon: Pencil, href: `/gestion/productos/${product.id}/editar` },
      { label: "Editar precio y stock", icon: Pencil, onSelect: () => openQuick(product) },
      ...(product.isVisible ? [
        { label: "Ver producto", icon: Eye, href: `/${storeSlug}/producto/${encodeURIComponent(product.slug)}`, external: true },
        { label: "Compartir producto", icon: Share2, onSelect: () => void share(product) },
      { label: "Generar QR", icon: QrCode, onSelect: () => setQr(product) }
      ] : []),
      { label: product.isVisible ? "Ocultar producto" : "Mostrar producto", icon: product.isVisible ? EyeOff : Eye, disabled: busy, onSelect: () => void mutate(product, { isVisible: !product.isVisible }) },
      { label: "Borrar producto", icon: Trash2, danger: true, disabled: busy, onSelect: () => void remove(product) }
    ];
  }
  return <>
    <AdminPageHeader title="Productos" description="Tu catálogo, simple y a mano." action={<><AdminActionMenu label="Más opciones de productos" items={[{ label: "Importar productos", icon: Upload, onSelect: () => setImportOpen(true) }, { label: "Exportar productos", icon: Download, href: "/api/admin/products/export", download: true }]}/><Link className="btn-primary" href="/gestion/productos/nuevo"><Plus size={18} />Agregar producto</Link></>} />
    <section className="panel catalog-panel" aria-busy={loading}><div className="admin-toolbar"><label className="admin-search catalog-search"><input className="field" type="search" aria-label="Buscar productos" placeholder="Buscá por nombre, SKU o categoría" value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" className="admin-icon-button" aria-label="Filtrar productos" onClick={() => setFilters(true)}><SlidersHorizontal size={20}/></button></div>
    <div className="catalog-selection"><label><input type="checkbox" aria-label="Seleccionar página actual" checked={page.products.length > 0 && selected.length === page.products.length} onChange={e => setSelected(e.target.checked ? page.products.map(p => p.id) : [])} />{selected.length ? `${selected.length} seleccionados en esta página` : `${page.total} productos`}</label><Link href="/gestion/categorias">Administrar categorías</Link></div>
    {selected.length > 0 && <div className="catalog-bulk">{[["show", "Mostrar"], ["hide", "Ocultar"]].map(([value, label]) => <button key={value} disabled={busy} className="btn-secondary" onClick={() => void bulk(value)}>{label}</button>)}</div>}
    <div className="catalog-columns"><span>Producto</span><span>Precio / oferta</span><span>Stock</span><span>Acciones</span></div>
    {loading ? <div className="admin-empty">Cargando catálogo…</div> : page.products.length === 0 ? <div className="admin-empty"><Package size={36} /><h2>{queryString ? "No encontramos productos" : "Tu catálogo empieza acá"}</h2><p>{queryString ? "Probá otra búsqueda o cambiá los filtros." : "Agregá tu primer producto para empezar a vender."}</p><Link className="btn-primary" href="/gestion/productos/nuevo">Agregar producto</Link></div> : page.products.map(product => {
      const summary = catalogSummary(product);
      const variants = quickDraft(product).variants;
      return <div key={product.id} className="catalog-entry"><article className="catalog-row"><input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.includes(product.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, product.id] : ids.filter(id => id !== product.id))} /><Link href={`/gestion/productos/${product.id}/editar`} className="catalog-product"><span className="catalog-thumb">{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt="" /> : <ImageIcon size={23} />}</span><span><strong>{product.name}</strong>{product.sku && <small>SKU {product.sku}</small>}<small className={product.isVisible ? "catalog-visibility is-visible" : "catalog-visibility"}>{product.isVisible ? <Eye size={15}/> : <EyeOff size={15}/>} {product.isVisible ? "Visible" : "Oculto"}</small></span></Link><button className="catalog-value" onClick={() => openQuick(product)} aria-label={`Editar precio de ${product.name}`}><strong>{summary.price}</strong>{summary.regular && <del>{summary.regular}</del>}<Pencil size={12} /></button><button className="catalog-value" onClick={() => openQuick(product)} aria-label={`Editar stock de ${product.name}`}><span className={`admin-badge ${!summary.hasVariants && product.stockQuantity === 0 ? "danger" : "success"}`}>{summary.stock}</span></button><div className="catalog-actions"><Link className="admin-icon-button catalog-edit" aria-label={`Editar ${product.name}`} href={`/gestion/productos/${product.id}/editar`}><Pencil size={16} /></Link><AdminActionMenu label={`Acciones de ${product.name}`} items={productActions(product)} disabled={busy}/></div></article>{variants.length > 0 && <div className="catalog-variants"><button onClick={() => setExpanded(ids => ids.includes(product.id) ? ids.filter(id => id !== product.id) : [...ids, product.id])} aria-expanded={expanded.includes(product.id)}><ChevronDown size={14} />{expanded.includes(product.id) ? "Ocultar" : "Ver"} {variants.length} variantes</button>{expanded.includes(product.id) && variants.map(v => <div key={v.key}><span>{v.label}{!v.isVisible ? " · Oculta" : ""}</span><span>{formatMoney(Number(v.promoPrice || v.basePrice || product.basePrice))}</span><span>{v.stockQuantity === "" ? "Ilimitado" : `${v.stockQuantity} u.`}</span><button className="admin-icon-button" aria-label={`Editar variante ${v.label}`} onClick={() => openQuick(product)}><Pencil size={14} /></button></div>)}</div>}</div>;
    })}
    <AdminPagination page={page.page} pageSize={page.pageSize} total={page.total} onChange={(next, size) => navigate({ page: String(next), pageSize: String(size) })} /></section>
    <AdminDialog title="Filtrar productos" fullScreenMobile open={filters} onClose={() => setFilters(false)} footer={<button form="product-filters" type="submit" className="btn-primary">Aplicar filtros</button>}><ProductFilters query={queryString} categories={categories} onApply={values => { navigate(values); setFilters(false); }}/></AdminDialog>
    <AdminDialog title="Precio e inventario" open={Boolean(quick)} onClose={closeQuick} footer={<><button className="btn-secondary" disabled={busy} onClick={closeQuick}>Cancelar</button><button form="quick-product" type="submit" className="btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></>}>
      {draft && <form id="quick-product" className="admin-form-grid" onSubmit={saveQuick}>
        <p className="font-semibold">{quick?.name}</p>
        {draft.variants.length === 0 && ([ ["basePrice", "Precio"], ["promoPrice", "Oferta"], ["stockQuantity", "Stock"] ] as const).map(([key, label]) => <label key={key}>{label}<input className="field" type="number" min={key === "promoPrice" ? 1 : 0} step="1" required={key === "basePrice"} value={draft[key]} placeholder={key === "stockQuantity" ? "Ilimitado" : "Sin oferta"} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        {draft.variants.map((variant, index) => <fieldset key={variant.key} className="admin-card admin-form-grid"><legend>{variant.label}</legend>{([ ["basePrice", "Precio"], ["promoPrice", "Oferta"], ["stockQuantity", "Stock"] ] as const).map(([key, label]) => <label key={key}>{label}<input className="field" type="number" min="0" step="1" value={variant[key]} placeholder={key === "stockQuantity" ? "Ilimitado" : key === "basePrice" ? "Heredar precio" : "Sin oferta"} onChange={e => setDraft({ ...draft, variants: draft.variants.map((v, i) => i === index ? { ...v, [key]: e.target.value } : v) })} /></label>)}<label>Foto de la variante<select className="field" value={variant.imageUrl ?? ""} onChange={e => setDraft({ ...draft, variants: draft.variants.map((v, i) => i === index ? { ...v, imageUrl: e.target.value || null } : v) })}><option value="">Imagen principal</option>{quick?.imageUrls.map((url, photoIndex) => <option key={url} value={url}>Foto {photoIndex + 1}</option>)}</select></label><label className="admin-check"><input type="checkbox" checked={variant.isVisible} onChange={e => setDraft({ ...draft, variants: draft.variants.map((v, i) => i === index ? { ...v, isVisible: e.target.checked } : v) })} />Visible en la tienda</label></fieldset>)}
      </form>}
    </AdminDialog>
    <AdminDialog title="Compartir producto" open={Boolean(qr)} centeredMobile onClose={() => setQr(null)}>{qr && <div className="grid justify-items-center gap-5"><QRCodeCanvas ref={qrCanvasRef} value={productUrl(qr)} size={880} style={{ height: 220, width: 220 }} includeMargin title={`Código QR de ${qr.name}`} /><p>{qr.name}</p><button className="btn-primary" type="button" onClick={downloadProductQr}><Download size={17} />Descargar</button></div>}</AdminDialog>
    <AdminDialog title="Importar productos" open={importOpen} fullScreenMobile onClose={() => { if (!busy) setImportOpen(false); }} footer={importData ? <button className="btn-primary" disabled={busy || !importData.rows.length || importData.errors.length > 0} onClick={() => void importProducts()}>Importar {importData.rows.length} productos</button> : undefined}><div className="admin-form-grid"><p>Descargá la plantilla, completá tus productos y revisá los datos antes de importarlos.</p><a download href="/api/admin/products/export?mode=template" className="btn-secondary">Descargar plantilla</a><label>Seleccionar archivo<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={e => void previewImport(e.target.files?.[0])} /></label>{importData && <><p>{importData.rows.length} productos listos para importar</p>{importData.errors.map(e => <p key={e.rowNumber} className="text-red-600">Fila {e.rowNumber}: {e.message}</p>)}{importData.rows.slice(0, 20).map(row => <p key={row.rowNumber}>{row.name} · {formatMoney(row.basePrice)}</p>)}</>}</div></AdminDialog>
  </>;
}
