"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDownUp, Eye, EyeOff, FolderTree, Minus, Plus, Search, Trash2 } from "lucide-react";
import { AdminDialog, AdminNotice } from "@/components/admin-ui";
import { AdminSortable } from "@/components/admin-sortable";
import { AdminActionMenu } from "@/components/admin-action-menu";
import { categoryDescendantIds, categoryPath, categoryTreeVersion, validateCategoryTree } from "@/lib/category-tree";
import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { notifyError, notifySuccess } from "@/lib/internal-notifications";
import "./category-manager.css";

type Category = { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; count: number; imageUrl: string | null; isVisible: boolean; updatedAt: string };

function CategoryName({ category, autoFocus, disabled, onChange }: { category: Category; autoFocus: boolean; disabled: boolean; onChange: (name: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => { field.style.height = "0px"; field.style.height = `${field.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    if (field.parentElement) observer.observe(field.parentElement);
    return () => observer.disconnect();
  }, [category.name]);
  return <textarea ref={ref} disabled={disabled} className="category-name-input" aria-label={`Nombre de ${category.name}`} rows={1} maxLength={80} value={category.name} autoFocus={autoFocus} onChange={event => onChange(event.target.value.replace(/[\r\n]+/g, " "))} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); } }}/>;
}
export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { confirm } = useUnsavedChanges();
  const [saved, setSaved] = useState(initialCategories);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [examples, setExamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signature = (list: Category[]) => JSON.stringify(list.map(({id,name,parentId,sortOrder,isVisible})=>({id,name,parentId,sortOrder,isVisible})));
  const dirty = signature(categories) !== signature(saved);
  useDirtyForm(dirty);
  function newCategory(parentId: string | null = null) { const id = crypto.randomUUID(); setCategories(current => [...current,{ id, name: "Nueva categoría", slug: "", parentId, sortOrder: current.filter(c => c.parentId === parentId).length, count: 0, imageUrl: null, isVisible: true, updatedAt: "" }]); if (parentId) setCollapsed(current => current.filter(item => item !== parentId)); setFocusId(id); setError(""); }
  function reorder(siblings: Category[]) { const positions = new Map(siblings.map((category, index) => [category.id, index])); setCategories(current => current.map(category => positions.has(category.id) ? { ...category, sortOrder: positions.get(category.id)! } : category)); }
  async function remove(category: Category) { if (!await confirm({ title: "Eliminar categoría", message: `¿Eliminar “${category.name}” y todas sus subcategorías? Los productos se conservan.`, confirmLabel: "Eliminar", destructive: true })) return; const ids = categoryDescendantIds(category.id,categories); setCategories(current => current.filter(item => !ids.has(item.id))); setCollapsed(current => current.filter(id => !ids.has(id))); }
  async function save() { setBusy(true); setError(""); try { validateCategoryTree(categories); const response = await fetch("/api/admin/categories/tree", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:categoryTreeVersion(saved),categories:categories.map(c=>({id:c.id,name:c.name.trim(),parentId:c.parentId,sortOrder:c.sortOrder,isVisible:c.isVisible}))})}); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCategories(result.categories); setSaved(result.categories); notifySuccess("Categorías guardadas."); } catch(error) { const message = error instanceof Error ? error.message : "No hay conexión. Tus cambios se conservan."; setError(message); notifyError(message); } finally {setBusy(false);} }
  function addExamples() {
    const next = [...categories];
    const branch = (name: string, parentId: string | null, sortOrder: number) => {
      const id = crypto.randomUUID();
      next.push({ id, name, slug: "", parentId, sortOrder, count: 0, imageUrl: null, isVisible: true, updatedAt: "" });
      return id;
    };
    const examples = [
      { name: "Ropa", children: [{ name: "Mujer", children: ["Vestidos", "Pantalones", "Zapatos"] }, { name: "Hombre", children: ["Remeras", "Pantalones", "Zapatos"] }, { name: "Niños", children: [] }] },
      { name: "Accesorios", children: [{ name: "Joyería", children: ["Anillos", "Collares", "Pulseras"] }, { name: "Relojes", children: [] }] },
      { name: "Hogar", children: [{ name: "Decoración", children: ["Cuadros", "Velas", "Textiles"] }, { name: "Organización", children: [] }] },
      { name: "Calzado", children: [{ name: "Hombre", children: ["Zapatos", "Urbanas"] }, { name: "Mujer", children: ["Tacones", "Panchas"] }] }
    ];
    examples.forEach((example, index) => {
      const rootId = branch(example.name, null, categories.filter(item => item.parentId === null).length + index);
      example.children.forEach((child, childIndex) => {
        const childId = branch(child.name, rootId, childIndex);
        child.children.forEach((leaf, leafIndex) => branch(leaf, childId, leafIndex));
      });
    });
    try { validateCategoryTree(next); setCategories(next); setExamples(false); } catch (error) { notifyError(String(error)); }
  }
  function renderBranch(parentId: string | null, depth = 0): React.ReactNode {
    const siblings = categories.filter(c=>c.parentId===parentId).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)).filter(c=>!query || categoryPath(c.id,categories).toLowerCase().includes(query.toLowerCase()) || categories.some(child=>categoryPath(child.id,categories).includes(categoryPath(c.id,categories))&&child.name.toLowerCase().includes(query.toLowerCase())));
    return <AdminSortable items={siblings} onChange={reorder} disabled={Boolean(query.trim()) || busy} label={category => category.name} className={parentId === null ? "category-tree" : "category-children"}>{(c, _index, handle) => {
      const hasChildren=categories.some(child=>child.parentId===c.id); const isCollapsed=collapsed.includes(c.id)&&!query;
      const descendants = categoryDescendantIds(c.id,categories);
      return <><div className={`category-row${c.isVisible ? "" : " is-hidden"}`}>
        {handle}
        <div className="category-name-field"><CategoryName category={c} disabled={busy} autoFocus={focusId === c.id} onChange={name => setCategories(current => current.map(item => item.id === c.id ? { ...item, name } : item))}/><button type="button" disabled={busy} className="admin-icon-button category-visibility" aria-label={`${c.isVisible ? "Ocultar" : "Mostrar"} ${c.name}${hasChildren ? " y subcategorías" : ""}`} aria-pressed={c.isVisible} onClick={() => setCategories(current => current.map(item => descendants.has(item.id) ? { ...item, isVisible: !c.isVisible } : item))}>{c.isVisible ? <Eye size={20}/> : <EyeOff size={20}/>}</button></div>
        <small className="category-product-count">{c.count} productos</small>
        {hasChildren && <button type="button" disabled={busy} className="category-toggle" aria-label={`${isCollapsed ? "Expandir" : "Contraer"} ${c.name}`} aria-expanded={!isCollapsed} onClick={() => setCollapsed(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])}>{isCollapsed ? <Plus size={18}/> : <Minus size={18}/>}</button>}
        <div className="category-action-wrap"><AdminActionMenu disabled={busy} label={`Acciones de ${categoryPath(c.id, categories)}`} items={[...(depth < 2 ? [{ label: "Crear subcategoría", icon: Plus, onSelect: () => newCategory(c.id) }] : []), { label: "Eliminar", icon: Trash2, danger: true, onSelect: () => void remove(c) }]}/></div>
      </div>{!isCollapsed && hasChildren && renderBranch(c.id, depth + 1)}</>;
    }}</AdminSortable>;
  }
  return <><section className="panel category-panel" aria-busy={busy}>
    <div className="admin-toolbar category-toolbar"><div className="category-toolbar-head"><h1>Categorías</h1><div>
      <button type="button" disabled={busy} className="btn-primary" onClick={()=>newCategory()}><Plus size={20}/>Agregar categoría</button>
      <button type="button" disabled={busy} className="btn-secondary" onClick={()=>setCategories(categories.map(c=>({...c,sortOrder:categories.filter(s=>s.parentId===c.parentId).sort((a,b)=>a.name.localeCompare(b.name)).findIndex(s=>s.id===c.id)})))}><ArrowDownUp size={18}/>Ordenar alfabéticamente</button>
    </div></div><label className="admin-search"><Search size={20}/><input className="field" aria-label="Buscar categorías" placeholder="Buscá por nombre de categoría" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    <AdminNotice error>{error}</AdminNotice>{categories.length ? <><div className="category-list-label">Nombre <span>Hasta 3 niveles</span></div>{renderBranch(null)}</> : <div className="admin-empty"><FolderTree size={40}/><h2>Un lugar para cada producto</h2><p>Creá categorías y agrupá tu catálogo en una estructura clara.</p><button disabled={busy} className="btn-primary" onClick={()=>newCategory()}>Crear mi primera categoría</button><button disabled={busy} className="text-sm text-brand" onClick={()=>setExamples(true)}>Ver categorías de ejemplo</button></div>}
    {dirty&&<div className="admin-save-bar category-save-bar"><span>Tenés cambios sin guardar</span><div><button className="btn-secondary" disabled={busy} onClick={()=>{void confirm({title:"Revertir cambios",message:"¿Revertir los cambios sin guardar?",confirmLabel:"Revertir",destructive:true}).then(accepted=>{if(accepted)setCategories(saved);});}}>Revertir cambios</button><button className="btn-primary" disabled={busy} onClick={()=>void save()}>{busy?"Guardando…":"Guardar cambios"}</button></div></div>}
    </section>
    <AdminDialog title="Categorías de ejemplo" open={examples} onClose={()=>setExamples(false)} footer={<button className="btn-primary" onClick={addExamples}>Usar este ejemplo</button>}><p className="mb-4 text-sm text-muted">Se incorporan a tu borrador. Podés editarlas antes de guardar.</p><div className="grid gap-2 sm:grid-cols-2">{["Ropa · Mujer, Hombre, Niños", "Accesorios · Joyería, Relojes", "Hogar · Decoración, Organización", "Calzado · Hombre, Mujer"].map(text=><p className="admin-card" key={text}>{text}</p>)}</div></AdminDialog>
  </>;
}
