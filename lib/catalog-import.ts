import { z } from "zod";

export const catalogImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(800).default(""),
  basePrice: z.number().int().positive(),
  promoPrice: z.number().int().positive().nullable().default(null),
  categoryName: z.string().trim().max(80).default("Destacados"),
  stockQuantity: z.number().int().min(0).max(999999).nullable().default(null),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
}).refine((row) => row.promoPrice === null || row.promoPrice < row.basePrice, {
  message: "El precio de oferta debe ser menor al precio base.",
  path: ["promoPrice"]
});

export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;

const truthy = new Set(["si", "sí", "yes", "true", "1", "x"]);

function readCell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => names.includes(key.trim().toLowerCase()));
  return match?.[1];
}

function integer(value: unknown, nullable = false) {
  if ((value === null || value === undefined || String(value).trim() === "") && nullable) return null;
  const normalized = String(value ?? "").replace(/[^0-9-]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function normalizeCatalogImportRow(raw: Record<string, unknown>, rowNumber: number) {
  return catalogImportRowSchema.safeParse({
    rowNumber,
    name: String(readCell(raw, ["nombre", "name", "producto"]) ?? ""),
    description: String(readCell(raw, ["descripcion", "descripción", "description"]) ?? ""),
    basePrice: integer(readCell(raw, ["precio", "precio base", "baseprice"])),
    promoPrice: integer(readCell(raw, ["precio oferta", "oferta", "promoprice"]), true),
    categoryName: String(readCell(raw, ["categoria", "categoría", "category"]) ?? "Destacados"),
    stockQuantity: integer(readCell(raw, ["stock", "cantidad", "stockquantity"]), true),
    isVisible: truthy.has(String(readCell(raw, ["visible", "publicado"]) ?? "si").trim().toLowerCase()),
    isFeatured: truthy.has(String(readCell(raw, ["destacado", "featured"]) ?? "no").trim().toLowerCase())
  });
}
