import { getCatalogPrices } from "@/lib/catalog";
import { normalizeVariants } from "@/lib/product-variants";

export const productSortOptions = [
  ["default", "Orden del catálogo"], ["newest", "Más nuevo a más viejo"], ["oldest", "Más viejo a más nuevo"],
  ["name", "Nombre: A - Z"], ["name-desc", "Nombre: Z - A"], ["price", "Precio: menor a mayor"],
  ["price-desc", "Precio: mayor a menor"], ["sku", "SKU: A - Z"], ["sku-desc", "SKU: Z - A"]
] as const;
export const productFilterGroups = [
  { key: "stock", label: "Disponibilidad en stock", options: [["available", "Con stock"], ["out", "Sin stock"]] },
  { key: "offer", label: "Tipo de precio", options: [["yes", "Con oferta"], ["no", "Sin oferta"]] },
  { key: "variants", label: "Tipo de variante", options: [["yes", "Con variante"], ["no", "Sin variante"]] },
  { key: "images", label: "Imagen", options: [["yes", "Con imagen"], ["no", "Sin imagen"]] },
  { key: "visibility", label: "Visibilidad en la tienda", options: [["visible", "Visibles"], ["hidden", "Ocultos"]] }
] as const;
export type ProductFilterSummary = {
  id: string; name: string; sku: string | null; basePrice: number; promoPrice: number | null;
  stockQuantity: number | null; variants: unknown; imageUrls: string[]; sortOrder: number; createdAt: Date;
};

export function matchesProductFilters(product: ProductFilterSummary, params: URLSearchParams) {
  const variants = normalizeVariants(product.variants);
  const visible = variants.filter(variant => variant.isVisible);
  const hasStock = variants.length ? visible.some(variant => variant.stockQuantity === null || variant.stockQuantity > 0) : product.stockQuantity === null || product.stockQuantity > 0;
  const hasOffer = variants.length ? visible.some(variant => variant.promoPrice !== null && variant.promoPrice > 0 && variant.promoPrice < (variant.basePrice ?? product.basePrice)) : product.promoPrice !== null && product.promoPrice > 0 && product.promoPrice < product.basePrice;
  return !(params.get("stock") === "available" && !hasStock || params.get("stock") === "out" && hasStock)
    && !(params.get("offer") === "yes" && !hasOffer || params.get("offer") === "no" && hasOffer)
    && !(params.get("variants") === "yes" && !variants.length || params.get("variants") === "no" && variants.length)
    && !(params.get("images") === "yes" && !product.imageUrls.length || params.get("images") === "no" && product.imageUrls.length);
}

export function compareProducts(a: ProductFilterSummary, b: ProductFilterSummary, sort: string) {
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  let result = 0;
  switch (sort) {
    case "newest": result = b.createdAt.getTime() - a.createdAt.getTime(); break;
    case "oldest": result = a.createdAt.getTime() - b.createdAt.getTime(); break;
    case "name": result = collator.compare(a.name, b.name); break;
    case "name-desc": result = collator.compare(b.name, a.name); break;
    case "sku": result = collator.compare(a.sku ?? "", b.sku ?? ""); break;
    case "sku-desc": result = collator.compare(b.sku ?? "", a.sku ?? ""); break;
    case "price": result = getCatalogPrices(a).effective - getCatalogPrices(b).effective; break;
    case "price-desc": result = getCatalogPrices(b).effective - getCatalogPrices(a).effective; break;
    default: result = a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime();
  }
  return result || a.id.localeCompare(b.id);
}
