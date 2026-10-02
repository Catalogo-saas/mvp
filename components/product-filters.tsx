"use client";

import { useState } from "react";
import { categoryPath } from "@/lib/category-tree";
import { productFilterGroups, productSortOptions } from "@/lib/admin-product-filters";

export function ProductFilters({ query, categories, onApply }: { query: string; categories: Array<{ id: string; name: string; parentId: string | null }>; onApply: (values: Record<string, string>) => void }) {
  const defaults = { category: "all", sort: "default", ...Object.fromEntries(productFilterGroups.map(group => [group.key, "all"])) };
  const [values, setValues] = useState<Record<string, string>>(() => {
    const params = new URLSearchParams(query);
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value]));
  });
  return <form id="product-filters" className="admin-form-grid" onSubmit={event => { event.preventDefault(); onApply(values); }}>
    <label>Ordenar por<select className="field" value={values.sort} onChange={event => setValues({ ...values, sort: event.target.value })}>{productSortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Categoría a filtrar<select className="field" value={values.category} onChange={event => setValues({ ...values, category: event.target.value })}><option value="all">Todas las categorías</option><option value="none">Sin categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{categoryPath(category.id, categories)}</option>)}</select></label>
    {productFilterGroups.map(group => <fieldset className="admin-filter-group" key={group.key}><legend>{group.label}</legend><div>{[["all", "Todos"], ...group.options].map(([value, label]) => <label key={value}><input type="radio" name={group.key} value={value} checked={values[group.key] === value} onChange={() => setValues({ ...values, [group.key]: value })}/>{label}</label>)}</div></fieldset>)}
    <button className="btn-secondary" type="button" onClick={() => setValues(defaults)}>Reiniciar filtros</button>
  </form>;
}
