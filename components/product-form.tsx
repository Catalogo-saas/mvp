"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProductListItem = {
  id: string;
  name: string;
  basePrice: number;
  isVisible: boolean;
  category: { name: string } | null;
  optionGroups: Array<{ name: string; options: Array<{ name: string; priceDelta: number }> }>;
};

function parseOptionGroups(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, selection = "SINGLE", required = "optional", rawOptions = ""] = line.split("|").map((part) => part.trim());
      return {
        name,
        selectionType: selection === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
        isRequired: required === "required",
        options: rawOptions
          .split(",")
          .map((raw) => raw.trim())
          .filter(Boolean)
          .map((raw) => {
            const [optionName, price = "0"] = raw.split(":").map((part) => part.trim());
            return { name: optionName, priceDelta: Number(price) || 0 };
          })
      };
    });
}

export function ProductForm({ products }: { products: ProductListItem[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "products");
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "No se pudo subir la imagen");
    }
    setImageUrl(data.url);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        basePrice: form.get("basePrice"),
        imageUrl,
        categoryName: form.get("categoryName"),
        isVisible: form.get("isVisible") === "on",
        optionGroups: parseOptionGroups(String(form.get("optionGroups") ?? ""))
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo crear el producto.");
      setLoading(false);
      return;
    }

    event.currentTarget.reset();
    setImageUrl("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form onSubmit={onSubmit} className="panel grid gap-4 p-6">
        <div>
          <h2 className="text-2xl font-black">Nuevo producto</h2>
          <p className="mt-1 text-sm text-muted">
            Opciones por línea: <code>Extras|MULTIPLE|optional|Papas:1800,Bacon:1200</code>
          </p>
        </div>
        <input className="field" name="name" placeholder="Nombre" required />
        <input className="field" name="categoryName" placeholder="Categoría" defaultValue="Destacados" required />
        <input className="field" name="basePrice" type="number" min="0" placeholder="Precio base" required />
        <textarea className="field min-h-24" name="description" placeholder="Descripción" />
        <input
          className="field"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              uploadImage(file).catch((err) => setError(err.message));
            }
          }}
        />
        {imageUrl ? <p className="text-sm font-bold text-green-700">Imagen subida.</p> : null}
        <textarea
          className="field min-h-28 font-mono text-sm"
          name="optionGroups"
          placeholder={"Extras|MULTIPLE|optional|Papas:1800,Bacon:1200\nTalle|SINGLE|required|S:0,M:0,L:0"}
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input name="isVisible" type="checkbox" defaultChecked /> Visible
        </label>
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        <button className="btn-primary" disabled={loading}>
          {loading ? "Guardando..." : "Guardar producto"}
        </button>
      </form>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-2xl font-black">Productos</h2>
        </div>
        <div className="divide-y divide-line">
          {products.length === 0 ? (
            <p className="p-5 text-muted">Todavía no cargaste productos.</p>
          ) : (
            products.map((product) => (
              <article key={product.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black">{product.name}</p>
                    <p className="text-sm text-muted">{product.category?.name ?? "Sin categoría"} · ${product.basePrice}</p>
                  </div>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                    {product.isVisible ? "Visible" : "Oculto"}
                  </span>
                </div>
                {product.optionGroups.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.optionGroups.map((group) => (
                      <span key={group.name} className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
                        {group.name}: {group.options.map((option) => option.name).join(", ")}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
