"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ChevronDown, GripVertical, Eye, EyeOff, ImagePlus, Monitor, Pencil, Plus, Search, Smartphone, Trash2 } from "lucide-react";
import { bannerPositions, createHomeSection, featuredCategoryReferenceLayouts, getBannerItems, homeSectionLabels, homeSectionTypes, isAllowedBannerLink, type BannerItem, type FeaturedCategoryLayout, type HomeSection } from "@/lib/public-page-config";
import { purchaseInfoIcon, purchaseInfoIconOptions } from "@/lib/purchase-info-icon-options";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { AdminDialog } from "@/components/admin-ui";

type Choice = { id: string; name: string; parentId?: string | null };
type CategoryTile = NonNullable<HomeSection["categoryTiles"]>[number];
type Props = {
  sections: HomeSection[];
  categories: Choice[];
  products: Choice[];
  onChange: (sections: HomeSection[]) => void;
  onImage: (sectionId: string, kind: "banner" | "category", target: string, file: File) => void;
  editingSectionId: string | null;
  onEditingSectionChange: (sectionId: string | null) => void;
};

const layoutLabels: Record<FeaturedCategoryLayout, string> = {
  "three-even": "3 categorías · columnas iguales",
  "four-even": "4 categorías · columnas iguales",
  "three-left": "3 categorías · mosaico lateral",
  "four-right-bottom": "4 categorías · mosaico inferior",
  "four-right-top": "4 categorías · mosaico superior",
  five: "5 categorías · mosaico amplio",
  "four-top": "4 categorías · imagen principal arriba (diseño anterior)",
  "four-bottom": "4 categorías · imagen principal abajo (diseño anterior)"
};
const positionLabels: Record<BannerItem["position"], string> = {
  "middle-center": "Al medio centrado", "middle-right": "Al medio derecha", "middle-left": "Al medio izquierda",
  "top-center": "Arriba en el centro", "top-left": "Arriba a la izquierda", "top-right": "Arriba a la derecha",
  "bottom-center": "Abajo en el centro", "bottom-left": "Abajo a la izquierda", "bottom-right": "Abajo a la derecha"
};
const defaultCategoryColors = { mode: "background" as const, background: "#ffffff", text: "#242424" };

export function HomeSectionsEditor({ sections, categories, products, onChange, onImage, editingSectionId, onEditingSectionChange }: Props) {
  const { confirm } = useUnsavedChanges();
  const [dragging, setDragging] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [editingTile, setEditingTile] = useState<{ id: string; field: "category" | "title" } | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const update = (id: string, patch: Partial<HomeSection>) => onChange(sections.map(section => section.id === id ? { ...section, ...patch } : section));
  const move = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const list = [...sections];
    const source = list.findIndex(section => section.id === dragging);
    const target = list.findIndex(section => section.id === targetId);
    if (source < 0 || target < 0) return;
    list.splice(target, 0, list.splice(source, 1)[0]);
    onChange(list); setDragging(null);
  };
  const selected = sections.find(section => section.id === editingSectionId);
  const bannerItems = selected?.type === "banners" ? getBannerItems(selected) : [];
  const editingBanner = bannerItems.find(item => item.id === editingBannerId);
  const editingBannerNumber = bannerItems.findIndex(item => item.id === editingBannerId) + 1;
  const editableTiles = selected?.type === "featuredCategories"
    ? selected.categoryTiles ?? (selected.categoryIds.length
      ? selected.categoryIds.map((categoryId, index) => ({ id: `legacy-${index + 1}`, categoryId, title: "", imageUrl: selected.categoryImages[categoryId] ?? "" }))
      : categories.filter(category => !category.parentId).map((category, index) => ({ id: `root-${index + 1}-${category.id}`, categoryId: category.id, title: "", imageUrl: selected.categoryImages[category.id] ?? "" })))
    : [];
  const checkboxList = (section: HomeSection, choices: Choice[], key: "categoryIds" | "productIds") => <div className="home-choice-list">{choices.map(choice => <label key={choice.id}><input type="checkbox" checked={section[key].includes(choice.id)} onChange={event => update(section.id, { [key]: event.target.checked ? [...section[key], choice.id] : section[key].filter(id => id !== choice.id) })}/>{choice.name}</label>)}</div>;
  const updateTile = (section: HomeSection, tileId: string, patch: Partial<CategoryTile>) => {
    const tiles = section.categoryTiles ?? editableTiles;
    update(section.id, { categoryTiles: tiles.map(tile => tile.id === tileId ? { ...tile, ...patch } : tile), categoryIds: [] });
  };
  const updateBanner = (section: HomeSection, bannerId: string, patch: Partial<BannerItem>) => {
    update(section.id, { bannerItems: getBannerItems(section).map(item => item.id === bannerId ? { ...item, ...patch } : item), images: [] });
  };

  if (selected) return <div className="home-section-detail">
    <div className="home-section-editor">
      <div className="home-section-editor-head"><h3>{homeSectionLabels[selected.type]}</h3></div>
      {selected.type === "productGroup" && <><label>Título<input className="field" maxLength={100} value={selected.title} onChange={event => update(selected.id, { title: event.target.value })}/></label>
      <label>Descripción<textarea className="field" maxLength={500} value={selected.description} onChange={event => update(selected.id, { description: event.target.value })}/></label></>}
      {selected.type === "banners" && <>
        <h4>Imágenes</h4>
        <div className="home-banner-list">{bannerItems.map((item, index) => <article className="home-banner-card" key={item.id}>
          <div className="home-banner-picture"><img src={item.imageUrl} alt={`Banner ${index + 1}`}/><div className="home-banner-actions"><button type="button" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setEditingBannerId(item.id); }}><Pencil size={15}/>Personalizar</button><button type="button" aria-label={`Eliminar banner ${index + 1}`} onClick={() => { update(selected.id, { bannerItems: bannerItems.filter(entry => entry.id !== item.id), images: [] }); setEditingBannerId(null); }}><Trash2 size={16}/></button></div></div>
          <fieldset className="home-banner-devices"><legend>Mostrar esta imagen en</legend><label><Monitor size={17}/>Escritorio<input type="checkbox" checked={item.desktop} onChange={event => updateBanner(selected, item.id, { desktop: event.target.checked })}/></label><label><Smartphone size={17}/>Celular<input type="checkbox" checked={item.mobile} onChange={event => updateBanner(selected, item.id, { mobile: event.target.checked })}/></label></fieldset>
        </article>)}</div>
        <AdminDialog fullScreenMobile open={Boolean(editingBanner)} onClose={() => setEditingBannerId(null)} title={`Personalizar banner ${editingBannerNumber}`} footer={<button type="button" className="btn-primary" onClick={() => setEditingBannerId(null)}>Listo</button>}>
          {editingBanner && <div className="home-banner-personalize">
            <label>Título<input className="field" maxLength={120} value={editingBanner.title} onChange={event => updateBanner(selected, editingBanner.id, { title: event.target.value })}/></label>
            <label>Descripción<textarea className="field" maxLength={500} value={editingBanner.description} onChange={event => updateBanner(selected, editingBanner.id, { description: event.target.value })}/></label>
            <label>Enlace al hacer clic<input className="field" type="text" maxLength={500} value={editingBanner.link} placeholder="/productos o https://ejemplo.com" aria-invalid={!isAllowedBannerLink(editingBanner.link)} onChange={event => updateBanner(selected, editingBanner.id, { link: event.target.value })}/>{!isAllowedBannerLink(editingBanner.link) && <small className="home-field-error" role="alert">Usá una ruta de la tienda o una dirección http/https.</small>}</label>
            <label>Posición del texto<select className="field" value={editingBanner.position} onChange={event => updateBanner(selected, editingBanner.id, { position: event.target.value as BannerItem["position"] })}>{bannerPositions.map(position => <option key={position} value={position}>{positionLabels[position]}</option>)}</select></label>
            <div className="home-banner-colors"><label>Color del texto<input type="color" value={editingBanner.textColor} onChange={event => updateBanner(selected, editingBanner.id, { textColor: event.target.value })}/></label><label>Color del fondo<input type="color" value={editingBanner.backgroundColor.slice(0,7)} onChange={event => updateBanner(selected, editingBanner.id, { backgroundColor: `${event.target.value}${editingBanner.backgroundColor.slice(7)}` })}/></label></div>
            <label>Opacidad del fondo: {Math.round(parseInt(editingBanner.backgroundColor.slice(7),16)/255*100)} %<input type="range" min={0} max={255} value={parseInt(editingBanner.backgroundColor.slice(7),16)} onChange={event => updateBanner(selected, editingBanner.id, { backgroundColor: `${editingBanner.backgroundColor.slice(0,7)}${Number(event.target.value).toString(16).padStart(2,"0")}` })}/></label>
            <label className="home-inline-check"><input type="checkbox" checked={editingBanner.fitBackgroundToText} onChange={event => updateBanner(selected, editingBanner.id, { fitBackgroundToText: event.target.checked })}/>Ajustar fondo al texto</label>
          </div>}
        </AdminDialog>
        {bannerItems.length < 6 && <label className="design-upload home-banner-upload"><ImagePlus size={20}/>Subir tu imagen<input className="design-upload-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (file) onImage(selected.id,"banner",String(bannerItems.length),file); event.target.value = ""; }}/></label>}
        <p className="home-image-hint">Tamaño recomendado: 1200 × 450 px. Mantené el contenido principal centrado para que se vea completo en celular.</p>
        <fieldset className="home-banner-settings"><legend>Configuración</legend><label>Altura del banner<select className="field" value={selected.bannerHeight} onChange={event => update(selected.id, { bannerHeight: event.target.value as HomeSection["bannerHeight"] })}><option value="small">Pequeño</option><option value="medium">Mediano</option><option value="large">Grande</option><option value="auto">Automático</option></select></label><label>Autoplay<select className="field" value={selected.bannerAutoplay ? "yes" : "no"} onChange={event => update(selected.id, { bannerAutoplay: event.target.value === "yes" })}><option value="yes">Sí</option><option value="no">No</option></select></label>{selected.bannerAutoplay && <label>Tiempo de cambio ({selected.bannerInterval} segundos)<input type="range" min={3} max={10} value={selected.bannerInterval} onChange={event => update(selected.id, { bannerInterval: Number(event.target.value) })}/></label>}</fieldset>
      </>}
      {selected.type === "purchaseInfo" && <div className="home-info-list">
        <label>Cantidad de elementos<select className="field" value={selected.infoItems.length} onChange={event => {
          const count = Number(event.target.value);
          const defaults = createHomeSection("purchaseInfo", "new-info").infoItems;
          const infoItems = selected.infoItems.slice(0, count);
          const usedIcons = new Set(infoItems.map(item => item.icon));
          for (let index = infoItems.length; index < count; index++) {
            const fallback = purchaseInfoIconOptions.find(option => !usedIcons.has(option.value))?.value ?? "truck";
            const template = defaults[index] ?? { icon: fallback, title: `Nuevo elemento ${index + 1}`, text: "" };
            const icon = usedIcons.has(template.icon) ? fallback : template.icon;
            infoItems.push({ ...template, icon });
            usedIcons.add(icon);
          }
          update(selected.id, { infoItems });
        }}>{[1,2,3,4].map(count => <option key={count} value={count}>{["","Un elemento","Dos elementos","Tres elementos","Cuatro elementos"][count]}</option>)}</select></label>
        {selected.infoItems.map((item,index) => { const Icon = purchaseInfoIcon(item.icon); const usedByOtherItems = new Set(selected.infoItems.filter((_,otherIndex) => otherIndex !== index).map(entry => entry.icon)); return <fieldset key={index}><legend>Elemento {index + 1}</legend>
          <label>Ícono<details className="home-icon-picker"><summary><Icon size={20}/><span>{purchaseInfoIconOptions.find(option => option.value === item.icon)?.label ?? "Envío"}</span><ChevronDown size={16}/></summary><div>{purchaseInfoIconOptions.filter(option => !usedByOtherItems.has(option.value)).map(option => { const OptionIcon = option.icon; return <button type="button" key={option.value} aria-pressed={item.icon === option.value} onClick={event => { update(selected.id, { infoItems: selected.infoItems.map((entry,i) => i === index ? { ...entry, icon: option.value } : entry) }); event.currentTarget.closest("details")?.removeAttribute("open"); }}><OptionIcon size={18}/>{option.label}</button>; })}</div></details></label>
          <label>Título<input className="field" maxLength={80} value={item.title} onChange={event => update(selected.id, { infoItems: selected.infoItems.map((entry,i) => i === index ? { ...entry, title: event.target.value } : entry) })}/></label>
          <label>Texto<textarea className="field" maxLength={250} value={item.text} onChange={event => update(selected.id, { infoItems: selected.infoItems.map((entry,i) => i === index ? { ...entry, text: event.target.value } : entry) })}/></label>
        </fieldset>; })}
        <fieldset><legend>Colores</legend><label>Combinación de colores<select className="field" value={selected.infoColors.mode} onChange={event => update(selected.id, { infoColors: { ...selected.infoColors, mode: event.target.value as typeof selected.infoColors.mode } })}><option value="background">Usar color de fondo y texto</option><option value="primary">Usar color primario</option><option value="secondary">Usar color secundario</option><option value="custom">Usar color personalizado</option></select></label>
          {selected.infoColors.mode === "custom" && <div className="home-info-colors"><label>Color de fondo<input className="field" type="color" value={selected.infoColors.background} onChange={event => update(selected.id, { infoColors: { ...selected.infoColors, background: event.target.value } })}/></label><label>Color de texto<input className="field" type="color" value={selected.infoColors.text} onChange={event => update(selected.id, { infoColors: { ...selected.infoColors, text: event.target.value } })}/></label></div>}
        </fieldset>
      </div>}
      {selected.type === "featuredCategories" && <>
        <p>Elegí una distribución, asigná categorías y agregá tantas tarjetas como necesites. Las imágenes se cargan desde tu dispositivo.</p>
        <fieldset className="home-layout-choice"><legend>Diseño</legend><p>Elegí el diseño con la cantidad de categorías que prefieras.</p><div>{[...featuredCategoryReferenceLayouts, ...(["four-top", "four-bottom"] as const).filter(layout => layout === selected.categoryLayout)].map(layout => <button type="button" key={layout} aria-pressed={selected.categoryLayout === layout} aria-label={layoutLabels[layout]} onClick={() => update(selected.id, { categoryLayout: layout })}><span className="home-layout-preview" data-layout={layout}>{Array.from({ length: layout === "five" ? 5 : layout.startsWith("three") ? 3 : 4 }, (_, index) => <i key={index}>{index + 1}</i>)}</span><span>{layoutLabels[layout]}</span></button>)}</div></fieldset>
        <div className="home-category-tile-list" aria-label="Categorías del mosaico">{editableTiles.map((tile, index) => {
          const category = categories.find(item => item.id === tile.categoryId);
          const imageUrl = tile.imageUrl || (tile.categoryId ? selected.categoryImages[tile.categoryId] : "") || "";
          return <article className="home-category-tile" key={tile.id}>
            <div className="home-category-picture">{imageUrl ? <img src={imageUrl} alt={tile.title || category?.name || "Imagen de categoría"}/> : <span><ImagePlus size={24}/>Sin imagen</span>}<div className="home-category-actions"><button type="button" aria-expanded={editingTile?.id === tile.id && editingTile.field === "category"} onClick={() => setEditingTile(current => current?.id === tile.id && current.field === "category" ? null : { id: tile.id, field: "category" })}>Categoría</button><button type="button" aria-expanded={editingTile?.id === tile.id && editingTile.field === "title"} onClick={() => setEditingTile(current => current?.id === tile.id && current.field === "title" ? null : { id: tile.id, field: "title" })}>Título</button><button type="button" aria-label={`Quitar categoría ${index + 1}`} onClick={() => update(selected.id, { categoryTiles: editableTiles.filter(item => item.id !== tile.id), categoryIds: [] })}><Trash2 size={17}/></button></div></div>
            {editingTile?.id === tile.id && <div className="home-category-fields">{editingTile.field === "category" ? <label>Categoría<select className="field" value={tile.categoryId} onChange={event => updateTile(selected, tile.id, { categoryId: event.target.value })}><option value="">Elegí una categoría</option>{categories.map(item => <option key={item.id} value={item.id}>{item.parentId ? `↳ ${item.name}` : item.name}</option>)}</select></label> : <label>Título de la tarjeta<input className="field" maxLength={80} value={tile.title} onChange={event => updateTile(selected, tile.id, { title: event.target.value })}/><small>Dejalo vacío para usar {category?.name ? `“${category.name}”` : "el nombre de la categoría"}.</small></label>}</div>}
            <label className="design-upload"><ImagePlus size={17}/>{imageUrl ? "Cambiar imagen" : "Subir imagen"}<input className="design-upload-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (file) onImage(selected.id,"category",tile.id,file); event.target.value = ""; }}/></label>
          </article>;
        })}</div>
        <button type="button" className="home-category-add" onClick={() => update(selected.id, { categoryTiles: [...editableTiles, { id: crypto.randomUUID(), categoryId: "", title: "", imageUrl: "" }], categoryIds: [] })}><Plus size={18}/>Agregar categoría</button>
        <fieldset className="home-banner-settings"><legend>Visualización</legend><label>Espaciado de fotos<select className="field" value={selected.categorySpacing} onChange={event => update(selected.id, { categorySpacing: event.target.value as HomeSection["categorySpacing"] })}><option value="large">Grande</option><option value="normal">Normal</option><option value="small">Pequeño</option><option value="none">Sin espaciado</option></select></label></fieldset>
        <fieldset className="home-banner-settings"><legend>Colores</legend><label>Combinación de colores<select className="field" value={selected.categoryColors?.mode ?? "legacy"} onChange={event => update(selected.id, { categoryColors: event.target.value === "legacy" ? undefined : { ...(selected.categoryColors ?? defaultCategoryColors), mode: event.target.value as NonNullable<HomeSection["categoryColors"]>["mode"] } })}><option value="legacy">Original de la plantilla</option><option value="background">Usar color de fondo y texto</option><option value="primary">Usar color primario</option><option value="secondary">Usar color secundario</option><option value="custom">Usar color personalizado</option></select></label>{selected.categoryColors?.mode === "custom" && <div className="home-banner-colors"><label>Color de fondo<input type="color" value={selected.categoryColors.background} onChange={event => update(selected.id, { categoryColors: { ...selected.categoryColors!, background: event.target.value } })}/></label><label>Color de texto<input type="color" value={selected.categoryColors.text} onChange={event => update(selected.id, { categoryColors: { ...selected.categoryColors!, text: event.target.value } })}/></label></div>}</fieldset>
      </>}
      {selected.type === "productGroup" && <><div className="home-product-picker"><button type="button" className="home-product-picker-trigger" aria-expanded={productPickerOpen} aria-controls="home-product-options" onClick={() => setProductPickerOpen(open => !open)}><span>Seleccionar productos a mostrar</span><ChevronDown size={22}/></button>{productPickerOpen && <div className="home-product-picker-panel" id="home-product-options"><label className="home-product-search"><input aria-label="Buscar productos" value={productQuery} onChange={event => setProductQuery(event.target.value)}/><Search size={21}/></label><div className="home-product-options">{products.filter(product => product.name.toLocaleLowerCase("es").includes(productQuery.trim().toLocaleLowerCase("es"))).map(product => <label key={product.id}><input type="checkbox" checked={selected.productIds.includes(product.id)} onChange={event => update(selected.id, { productIds: event.target.checked ? [...selected.productIds, product.id] : selected.productIds.filter(id => id !== product.id) })}/><span>{product.name}</span></label>)}{products.length === 0 && <p>No hay productos disponibles.</p>}{products.length > 0 && !products.some(product => product.name.toLocaleLowerCase("es").includes(productQuery.trim().toLocaleLowerCase("es"))) && <p>No encontramos productos.</p>}</div></div>}</div><label>Presentación<select className="field" value={selected.layout} onChange={event => update(selected.id, { layout: event.target.value as "grid" | "carousel" })}><option value="grid">Grilla</option><option value="carousel">Carrusel</option></select></label></>}
    </div>
  </div>;

  return <div className="home-sections-editor">
    <h3>Listado de secciones</h3><p>Arrastrá las secciones para ordenarlas.</p>
    <div className="home-section-list">{sections.map(section => <div className="home-section-row" key={section.id} draggable onDragStart={() => setDragging(section.id)} onDragOver={event => event.preventDefault()} onDrop={() => move(section.id)}>
      <GripVertical size={18} className="home-grip" aria-label="Arrastrar sección"/><span>{homeSectionLabels[section.type]}</span>
      <button type="button" aria-label={(section.enabled ? "Ocultar " : "Mostrar ") + homeSectionLabels[section.type]} onClick={() => update(section.id, { enabled: !section.enabled })}>{section.enabled ? <Eye size={19}/> : <EyeOff size={19}/>}</button>
      <button type="button" aria-label={"Editar " + homeSectionLabels[section.type]} onClick={() => onEditingSectionChange(section.id)}><Pencil size={19}/></button>
      <button type="button" aria-label={"Eliminar " + homeSectionLabels[section.type]} onClick={() => { void confirm({ title: "Eliminar sección", message: "¿Eliminar esta sección de la página de inicio?", confirmLabel: "Eliminar", destructive: true }).then(accepted => { if (accepted) onChange(sections.filter(item => item.id !== section.id)); }); }}><Trash2 size={19}/></button>
    </div>)}</div>
    <button type="button" className="home-section-add" onClick={() => setAdding(!adding)}><Plus size={22}/>Añadir nueva sección</button>
    {adding && <div className="home-section-types">{homeSectionTypes.map(type => <button type="button" key={type} onClick={() => { const section = createHomeSection(type, crypto.randomUUID()); onChange([...sections, type === "featuredCategories" ? { ...section, categoryTiles: [] } : section]); setAdding(false); onEditingSectionChange(section.id); }}>{homeSectionLabels[type]}</button>)}</div>}
  </div>;
}
