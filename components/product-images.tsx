"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ArrowLeft, ImagePlus, Images, Pencil, Trash2, ZoomIn } from "lucide-react";
import { AdminDialog } from "@/components/admin-ui";
import { AdminSortable } from "@/components/admin-sortable";

export type ProductImageDraft = { id: string; url: string; file?: File };
export function ProductImages({ images, onChange, onRemove, onAdd, error }: { images: ProductImageDraft[]; onChange: (images: ProductImageDraft[]) => void; onRemove: (index: number) => void; onAdd: (files: FileList | null) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const add = (compact = false) => <label className={compact ? "product-image-add" : "product-image-upload"}>
    <ImagePlus size={compact ? 26 : 36}/><span>{compact ? "Agregar imagen" : "Presioná acá para subir tus fotos"}</span>
    <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={compact ? "Agregar imagen a la galería" : "Subir fotos del producto"} multiple disabled={images.length >= 6} onChange={event => { onAdd(event.currentTarget.files); event.currentTarget.value = ""; }}/>
  </label>;
  return <section className="product-section product-images">
    <header><h3>Imágenes</h3><span>{images.length} de 6 fotos</span></header>
    {add()}
    <div className="product-image-summary">{images.slice(0, images.length > 3 ? 2 : 3).map((image, index) => <div key={image.id}>
      <button type="button" aria-label={`Ver foto ${index + 1}`} onClick={() => { setPreview(image.url); setOpen(true); }}><img src={image.url} alt={`Foto ${index + 1} del producto`}/>{index === 0 && <span className="image-cover-label">Portada</span>}</button>
      <button type="button" className="image-delete" aria-label={`Eliminar foto ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={17}/></button>
    </div>)}{images.length > 3 && <button type="button" className="product-image-more" aria-label={`Ver las ${images.length} fotos`} onClick={() => { setPreview(null); setOpen(true); }}><img src={images[2].url} alt=""/><span>+{images.length - 2}</span></button>}</div>
    <button type="button" className="admin-inline-link product-images-edit" onClick={() => { setPreview(null); setOpen(true); }}><Pencil size={18}/>Editar y ordenar fotos</button>
    <p className="product-image-help">La primera foto es la portada. Podés subir hasta 6 imágenes. Los cambios se guardan junto con el producto.</p>
    <AdminDialog open={open} fullScreenMobile title={preview ? "Vista de la foto" : "Editar y ordenar fotos"} onClose={() => { setOpen(false); setPreview(null); }} footer={<button type="button" className="btn-primary" onClick={() => { setOpen(false); setPreview(null); }}>Listo</button>}>
      {preview ? <div className="product-image-preview"><button type="button" className="admin-inline-link" onClick={() => setPreview(null)}><ArrowLeft size={16}/>Volver a las fotos</button><img src={preview} alt="Vista ampliada del producto"/></div> : <>
        <p className="image-sort-help"><Images size={20}/>Arrastrá las fotos desde el asa para ordenarlas. La primera será la portada.</p>
        <AdminSortable items={images} onChange={onChange} label={item => `foto ${images.findIndex(image => image.id === item.id) + 1}`} className="product-image-gallery">{(image, index, handle) => <div className="product-gallery-tile"><img src={image.url} alt={`Foto ${index + 1} del producto`}/><div className="product-gallery-tools">{handle}<button type="button" className="admin-icon-button" aria-label={`Ampliar foto ${index + 1}`} onClick={() => setPreview(image.url)}><ZoomIn size={17}/></button><button type="button" className="admin-icon-button" aria-label={`Eliminar foto ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={17}/></button></div><button type="button" className="product-image-cover" disabled={index === 0} onClick={() => onChange([image, ...images.filter(item => item.id !== image.id)])}>{index === 0 ? "Portada" : "Hacer portada"}</button></div>}</AdminSortable>
        {images.length < 6 && add(true)}
        {error && <p role="alert" className="admin-notice is-error">{error}</p>}
      </>}
    </AdminDialog>
  </section>;
}
