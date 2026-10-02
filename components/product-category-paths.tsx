"use client";

import { ArrowDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

type Category = { id: string; name: string; parentId?: string | null };
function Path({ categories, value, onChange, onRemove, number }: { categories: Category[]; value: string; onChange: (id: string) => void; onRemove: () => void; number: number }) {
  const id = useId();
  const byId = new Map(categories.map(category => [category.id, category]));
  const path: string[] = [];
  let node = byId.get(value);
  while (node && path.length < 3) { path.unshift(node.id); node = node.parentId ? byId.get(node.parentId) : undefined; }
  return <div className="product-category-path">
    <div className="product-category-path-head"><span>Categoría {number}</span><button type="button" className="admin-icon-button" aria-label={`Quitar ruta de categoría ${number}`} onClick={onRemove}><X size={16}/></button></div>
    {[0, 1, 2].map(level => {
      if (level > 0 && !path[level - 1]) return null;
      const parentId = level === 0 ? null : path[level - 1];
      const choices = categories.filter(category => (category.parentId ?? null) === parentId);
      return <div className="product-category-level" key={level}>
        {level > 0 && <ArrowDown size={22} aria-hidden="true"/>}
        <label className="sr-only" htmlFor={`${id}-${level}`}>{level === 0 ? "Categoría" : `Subcategoría nivel ${level + 1}`} de ruta {number}</label>
        <div><select id={`${id}-${level}`} className="field" disabled={!choices.length} value={path[level] ?? ""} onChange={event => onChange(event.target.value || (level > 0 ? path[level - 1] : ""))}>
          <option value="">{!choices.length ? "No hay más categorías disponibles" : level === 0 ? "Seleccionar categoría" : "Seleccionar subcategoría"}</option>
          {choices.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>{path[level] && <button type="button" className="category-clear" aria-label={`Quitar ${byId.get(path[level])?.name} de ruta ${number}`} onClick={() => onChange(level > 0 ? path[level - 1] : "")}><X size={17}/></button>}</div>
      </div>;
    })}
  </div>;
}

export function ProductCategoryPaths({ categories, primary, selected, onChange }: { categories: Category[]; primary: string; selected: string[]; onChange: (ids: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const ids = [...new Set([primary, ...selected].filter(Boolean))];
  const paths = ids.length ? [...ids, ...(adding ? [""] : [])] : [""];
  return <section className="product-section">
    <h3>Categorías y subcategorías</h3>
    <p>Para modificar o agregar una categoría, dirigite a <Link className="admin-inline-link" href="/gestion/categorias">Categorías</Link>.</p>
    {paths.map((value, index) => <Path key={index} categories={categories} value={value} number={index + 1} onRemove={() => { onChange(ids.filter((_, i) => i !== index)); setAdding(false); setError(""); }} onChange={next => {
      if (next && ids.some((id, i) => i !== index && id === next)) { setError("Esta categoría ya está vinculada al producto."); return; }
      const nextIds = [...ids]; nextIds[index] = next;
      onChange(nextIds.filter(Boolean)); setError(""); if (next) setAdding(false);
    }}/>) }
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {categories.length > 0 ? <button type="button" className="btn-secondary" disabled={adding || !ids.length || ids.length >= 30} onClick={() => setAdding(true)}><Plus size={18}/>Mostrar en otra categoría más</button> : <p>Todavía no hay categorías. Crealas desde la sección Categorías.</p>}
  </section>;
}
