"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

function SortableItem({ id, index, label, disabled, children }: { id: string; index: number; label: string; disabled: boolean; children: (handle: ReactNode) => ReactNode }) {
  const { ref, handleRef, isDragging } = useSortable({ id, index, disabled });
  return <div ref={ref} role="listitem" className={`admin-sortable-item${isDragging ? " is-dragging" : ""}`}>
    {children(<button ref={handleRef} type="button" disabled={disabled} className="admin-drag-handle" aria-label={`Reordenar ${label}`} title="Arrastrá para ordenar. Con teclado: espacio y flechas."><GripVertical size={20}/></button>)}
  </div>;
}

export function AdminSortable<T extends { id: string }>({ items, onChange, label, className, disabled = false, children }: { items: T[]; onChange: (items: T[]) => void; label: (item: T) => string; className?: string; disabled?: boolean; children: (item: T, index: number, handle: ReactNode) => ReactNode }) {
  return <DragDropProvider onDragEnd={event => { if (!event.canceled) onChange(move(items, event)); }}>
    <div className={className} role="list">{items.map((item, index) => <SortableItem key={item.id} id={item.id} index={index} label={label(item)} disabled={disabled}>{handle => children(item, index, handle)}</SortableItem>)}</div>
  </DragDropProvider>;
}
