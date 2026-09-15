export const catalogWorkbookColumns = [
  { header: "Nombre", key: "Nombre", width: 28 },
  { header: "Descripción", key: "Descripción", width: 42 },
  { header: "Precio", key: "Precio", width: 16 },
  { header: "Precio oferta", key: "Precio oferta", width: 16 },
  { header: "Categoría", key: "Categoría", width: 22 },
  { header: "Stock", key: "Stock", width: 12 },
  { header: "Visible", key: "Visible", width: 12 },
  { header: "Destacado", key: "Destacado", width: 14 }
] as const;

export const catalogWorkbookExample = {
  Nombre: "Remera Oversize Negra",
  Descripción: "Remera unisex de algodón",
  Precio: 25000,
  "Precio oferta": 22000,
  Categoría: "Remeras",
  Stock: 10,
  Visible: "Sí",
  Destacado: "No"
};
