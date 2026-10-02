"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Trash2, X, Check } from "lucide-react";
import { AdminDialog } from "@/components/admin-ui";
import { AdminSortable } from "@/components/admin-sortable";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";

export type VariantProperty = { name: string; selectionType: "SINGLE" | "MULTIPLE"; isRequired: boolean; maxSelections: string; options: Array<{ name: string; priceDelta: string; isAvailable: boolean }> };
export type VariantSuggestion = { name: string; values: string[] };

export function ProductVariantEditor({ groups, suggestions, onChange, onClose }: { groups: VariantProperty[]; suggestions: Record<string, VariantSuggestion[]>; onChange: (groups: VariantProperty[]) => void; onClose: () => void }) {
  const { confirm } = useUnsavedChanges();
  const [step, setStep] = useState<"list" | "pick" | "edit">(groups.length ? "list" : "pick");
  const [index, setIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [custom, setCustom] = useState<string | null>(null);
  const [error, setError] = useState("");
  function edit(groupName: string, groupIndex: number | null) {
    setIndex(groupIndex); setName(groupName); setValues(groupIndex === null ? [] : groups[groupIndex].options.map(option => option.name)); setCustom(null); setError(""); setStep("edit");
  }
  async function leaveEditor(action: () => void) {
    const initialValues = index === null ? [] : groups[index].options.map(option => option.name);
    const changed = step === "edit" && (JSON.stringify(values) !== JSON.stringify(initialValues) || Boolean(custom?.trim()) || index === null && !suggestions[name] && Boolean(name.trim()));
    if (!changed || await confirm({ title: "Descartar cambios", message: "Tenés cambios en esta propiedad sin guardar. ¿Querés descartarlos?", confirmLabel: "Descartar", destructive: true })) action();
  }
  function addCustom() {
    const value = custom?.trim();
    if (!value) { setError("Ingresá un valor para agregarlo."); return; }
    if (values.some(item => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"))) { setError("Ese valor ya está agregado."); return; }
    if (values.length >= 30) { setError("Podés agregar hasta 30 valores por propiedad."); return; }
    setValues([...values, value]); setCustom(null); setError("");
  }
  function save() {
    const finalValues = [...values];
    if (custom?.trim()) {
      if (finalValues.some(value => value.toLocaleLowerCase("es") === custom.trim().toLocaleLowerCase("es"))) { setError("Ese valor ya está agregado."); return; }
      finalValues.push(custom.trim());
    }
    if (!name.trim() || !finalValues.length) { setError("Completá la propiedad y al menos un valor."); return; }
    if (name.trim().length > 60 || finalValues.some(value => value.length > 60) || finalValues.length > 30) { setError("Usá hasta 60 caracteres por nombre y hasta 30 valores."); return; }
    if (groups.some((group, i) => i !== index && group.name.toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es"))) { setError("Ya existe una propiedad con ese nombre."); return; }
    const property: VariantProperty = { name: name.trim(), selectionType: "SINGLE", isRequired: true, maxSelections: "1", options: finalValues.map(value => (index === null ? undefined : groups[index].options.find(option => option.name === value)) ?? { name: value, priceDelta: "", isAvailable: true }) };
    const next = index === null ? [...groups, property] : groups.map((group, i) => i === index ? property : group);
    if (next.reduce((total, group) => total * group.options.length, 1) > 100) { setError("El producto admite hasta 100 combinaciones. Reducí la cantidad de valores."); return; }
    onChange(next); setStep("list"); setError(""); setCustom(null);
  }
  return <AdminDialog fullScreenMobile open title={step === "edit" ? index === null ? "Agregar propiedad" : "Editar propiedad" : "Propiedades"} onClose={() => leaveEditor(onClose)} footer={<button type="button" className="btn-primary" onClick={step === "edit" ? save : onClose}>{step === "edit" ? "Guardar propiedad" : "Listo"}</button>}>
    {step !== "list" && <button type="button" className="admin-inline-link variant-back" onClick={() => leaveEditor(() => { setStep("list"); setError(""); })}><ArrowLeft size={16}/>Volver a propiedades</button>}
    {step === "list" && <div className="variant-property-list">{groups.map((group, groupIndex) => <div className="variant-property-row" key={group.name}><button type="button" onClick={() => edit(group.name, groupIndex)}><span><strong>{group.name}</strong><span className="variant-chips">{group.options.map(option => <span key={option.name}>{option.name}</span>)}</span></span><ChevronRight size={18}/></button><button type="button" className="admin-icon-button" aria-label={`Eliminar ${group.name}`} onClick={() => { void confirm({ title: "Eliminar propiedad", message: `¿Eliminar la propiedad ${group.name}? Las combinaciones que dependan de ella dejarán de estar disponibles al guardar el producto.`, confirmLabel: "Eliminar", destructive: true }).then(accepted => { if (accepted) onChange(groups.filter((_, i) => i !== groupIndex)); }); }}><Trash2 size={17}/></button></div>)}<button type="button" className="btn-secondary" disabled={groups.length >= 12} onClick={() => setStep("pick")}><Plus size={18}/>Agregar nueva propiedad</button></div>}
    {step === "pick" && <div className="variant-preset-list">{[...Object.keys(suggestions), "Personalizada"].map(preset => <button className="variant-preset" type="button" key={preset} disabled={groups.some(group => group.name === preset)} onClick={() => edit(preset === "Personalizada" ? "" : preset, null)}>{preset}<ChevronRight size={18}/></button>)}</div>}
    {step === "edit" && <div className="admin-form-grid">
      <label>Propiedad<input className="field" value={name} maxLength={60} disabled={index !== null || Boolean(suggestions[name])} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); save(); } }}/>{index !== null && <small>El nombre de una propiedad creada no se puede modificar.</small>}</label>
      <div><h3 className="variant-values-heading">Atributos de la propiedad</h3><AdminSortable items={values.map(value => ({ id: value }))} label={item => item.id} onChange={items => setValues(items.map(item => item.id))} className="variant-values">{(item, _, handle) => <div className="variant-value">{handle}<span>{item.id}</span><button className="admin-icon-button" type="button" aria-label={`Quitar ${item.id}`} onClick={() => setValues(values.filter(value => value !== item.id))}><Trash2 size={17}/></button></div>}</AdminSortable>
        {custom === null ? <button className="btn-secondary variant-custom-add" type="button" onClick={() => setCustom("")}><Plus size={18}/>Agregar valor personalizado</button> : <div className="variant-custom-input"><input className="field" aria-label="Valor personalizado" autoFocus maxLength={60} value={custom} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } else if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setCustom(null); setError(""); } }}/><button type="button" className="admin-icon-button" aria-label="Agregar valor" onClick={addCustom}><Check size={18}/></button><button type="button" className="admin-icon-button" aria-label="Cancelar valor personalizado" onClick={() => setCustom(null)}><X size={18}/></button></div>}
      </div>
      {(suggestions[name] ?? []).map(group => <section className="variant-suggestions" key={group.name}><header><h3>{group.name}</h3><button type="button" className="admin-inline-link" onClick={() => setValues([...new Set([...values, ...group.values])].slice(0, 30))}>Seleccionar todo</button></header>{group.values.map(value => <label key={value}><input type="checkbox" checked={values.includes(value)} disabled={!values.includes(value) && values.length >= 30} onChange={() => setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value])}/>{value}</label>)}</section>)}
    </div>}
    {error && <p role="alert" className="admin-notice is-error">{error}</p>}
  </AdminDialog>;
}
