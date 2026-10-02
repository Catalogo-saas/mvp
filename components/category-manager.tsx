"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, FolderTree, GripVertical, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { AdminDialog, AdminNotice, AdminPageHeader } from "@/components/admin-ui";
import { categoryDescendantIds, categoryPath, categoryTreeVersion, validateCategoryTree } from "@/lib/category-tree";
import { useDirtyForm } from "@/components/use-dirty-form";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/internal-notifications";

type Category = { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; count: number; imageUrl: string | null; isVisible: boolean; updatedAt: string };
export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { confirm } = useUnsavedChanges();
  const [saved, setSaved] = useState(initialCategories);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [menu, setMenu] = useState<Category | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [examples, setExamples] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signature = (list: Category[]) => JSON.stringify(list.map(({id,name,parentId,sortOrder,isVisible})=>({id,name,parentId,sortOrder,isVisible})));
  const dirty = signature(categories) !== signature(saved);
  useDirtyForm(dirty);
  function newCategory(parentId: string | null = null) { const id = crypto.randomUUID(); setCategories(current => [...current,{ id, name: "Nueva categoría", slug: "", parentId, sortOrder: current.filter(c => c.parentId === parentId).length, count: 0, imageUrl: null, isVisible: true, updatedAt: "" }]); if (parentId) setCollapsed(current => current.filter(item => item !== parentId)); setMenu(null); setFocusId(id); setError(""); }
  function drop(target: Category) { if (!drag || drag === target.id) return; const node = categories.find(c => c.id === drag); if (!node || node.parentId !== target.parentId) { notifyWarning("Solo podés reordenar categorías dentro del mismo nivel."); return; } const siblings = categories.filter(c => c.parentId === node.parentId).sort((a,b) => a.sortOrder-b.sortOrder).filter(c => c.id !== drag); siblings.splice(siblings.findIndex(c => c.id === target.id),0,node); const positions = new Map(siblings.map((c,i) => [c.id,i])); setCategories(categories.map(c => positions.has(c.id) ? {...c,sortOrder:positions.get(c.id)!} : c)); setDrag(null); }
  async function remove(category: Category) { if (!await confirm({ title: "Eliminar categoría", message: `¿Eliminar “${category.name}” y todas sus subcategorías? Los productos se conservan.`, confirmLabel: "Eliminar", destructive: true })) return; const ids = categoryDescendantIds(category.id,categories); setCategories(current => current.filter(item => !ids.has(item.id))); setCollapsed(current => current.filter(id => !ids.has(id))); setMenu(null); }
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
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest(".category-action-wrap")) setMenu(null); };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", keydown); };
  }, [menu]);
  function renderBranch(parentId: string | null, depth = 0): React.ReactNode {
    return categories.filter(c=>c.parentId===parentId).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)).filter(c=>!query || categoryPath(c.id,categories).toLowerCase().includes(query.toLowerCase()) || categories.some(child=>categoryPath(child.id,categories).includes(categoryPath(c.id,categories))&&child.name.toLowerCase().includes(query.toLowerCase()))).map(c=> {
      const hasChildren=categories.some(child=>child.parentId===c.id); const isCollapsed=collapsed.includes(c.id)&&!query;
      const descendants = categoryDescendantIds(c.id,categories);
      const depthOf = categoryPath(c.id,categories).split(" / ").length;
      return <li key={c.id}><div className={`category-row${c.isVisible?"":" is-hidden"}`} style={{paddingLeft:12+depth*20}} draggable={!query} onDragStart={()=>setDrag(c.id)} onDragOver={event=>event.preventDefault()} onDrop={()=>drop(c)}><GripVertical size={15} className="category-grip" /><button className="category-toggle" aria-label={`${isCollapsed?"Expandir":"Contraer"} ${c.name}`} disabled={!hasChildren} aria-expanded={hasChildren?!isCollapsed:undefined} onClick={()=>setCollapsed(ids=>ids.includes(c.id)?ids.filter(id=>id!==c.id):[...ids,c.id])}>{hasChildren ? isCollapsed?<ChevronRight size={16}/>:<ChevronDown size={16}/>:<span/>}</button><input className="category-name-input" aria-label={`Nombre de ${c.name}`} maxLength={80} value={c.name} autoFocus={focusId===c.id} onFocus={()=>setFocusId(c.id)} onBlur={()=>setFocusId(current=>current===c.id?null:current)} onChange={event=>setCategories(current=>current.map(item=>item.id===c.id?{...item,name:event.target.value}:item))} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur();}}/><small className="category-product-count">{c.count} productos</small><button className="admin-icon-button category-visibility" aria-label={`${c.isVisible?"Ocultar":"Mostrar"} ${c.name}${hasChildren?" y subcategorías":""}`} aria-pressed={c.isVisible} onClick={()=>setCategories(current=>current.map(item=>descendants.has(item.id)?{...item,isVisible:!c.isVisible}:item))}>{c.isVisible?<Eye size={18}/>:<EyeOff size={18}/>}</button><div className="category-action-wrap"><button className="admin-icon-button category-more" aria-label={`Acciones de ${categoryPath(c.id,categories)}`} aria-haspopup="menu" aria-expanded={menu?.id===c.id} onClick={()=>setMenu(current=>current?.id===c.id?null:c)}><MoreVertical size={18}/></button>{menu?.id===c.id&&<div className="category-actions-menu" role="menu">{depthOf<3&&<button type="button" role="menuitem" onClick={()=>newCategory(c.id)}><Plus size={20}/>Crear subcategoría</button>}<button type="button" role="menuitem" className="danger" onClick={()=>void remove(c)}><Trash2 size={20}/>Eliminar</button></div>}</div></div>{!isCollapsed&&hasChildren&&<ul>{renderBranch(c.id,depth+1)}</ul>}</li>;
    });
  }
  return <><AdminPageHeader title="Categorías" description="Organizá tus productos para que sea fácil encontrarlos."/><section className="panel"><div className="admin-toolbar category-toolbar"><div className="category-toolbar-head"><h2>Categorías</h2><div><button className="btn-secondary" onClick={()=>setCategories(categories.map(c=>({...c,sortOrder:categories.filter(s=>s.parentId===c.parentId).sort((a,b)=>a.name.localeCompare(b.name)).findIndex(s=>s.id===c.id)})))}>↕ Ordenar alfabéticamente</button><button className="btn-primary" onClick={()=>newCategory()}><Plus size={18}/>Agregar categoría</button></div></div><label className="admin-search"><Search size={17}/><input className="field" aria-label="Buscar categorías" placeholder="Buscá una categoría" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><AdminNotice error>{error}</AdminNotice>{categories.length ? <><div className="category-list-label">Nombre <span>Hasta 3 niveles</span></div><ul className="category-tree">{renderBranch(null)}</ul></> : <div className="admin-empty"><FolderTree size={40}/><h2>Un lugar para cada producto</h2><p>Creá categorías y agrupá tu catálogo en una estructura clara.</p><button className="btn-primary" onClick={()=>newCategory()}>Crear mi primera categoría</button><button className="text-sm text-brand" onClick={()=>setExamples(true)}>Ver categorías de ejemplo</button></div>}</section>{dirty&&<div className="admin-save-bar"><span>Tenés cambios sin guardar</span><div><button className="btn-secondary" disabled={busy} onClick={()=>{void confirm({title:"Revertir cambios",message:"¿Revertir los cambios sin guardar?",confirmLabel:"Revertir",destructive:true}).then(accepted=>{if(accepted)setCategories(saved);});}}>Revertir cambios</button><button className="btn-primary" disabled={busy} onClick={()=>void save()}>{busy?"Guardando…":"Guardar cambios"}</button></div></div>}
    <AdminDialog title="Categorías de ejemplo" open={examples} onClose={()=>setExamples(false)} footer={<button className="btn-primary" onClick={addExamples}>Usar este ejemplo</button>}><p className="mb-4 text-sm text-muted">Se incorporan a tu borrador. Podés editarlas antes de guardar.</p><div className="grid gap-2 sm:grid-cols-2">{["Ropa · Mujer, Hombre, Niños", "Accesorios · Joyería, Relojes", "Hogar · Decoración, Organización", "Calzado · Hombre, Mujer"].map(text=><p className="admin-card" key={text}>{text}</p>)}</div></AdminDialog>
  </>;
}
