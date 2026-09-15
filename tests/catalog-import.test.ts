import { describe, expect, it } from "vitest";

import { normalizeCatalogImportRow } from "../lib/catalog-import";

describe("catalog import", () => {
  it("normalizes the Spanish template", () => {
    const result = normalizeCatalogImportRow({ Nombre: "Remera", Precio: "$12.500", Categoría: "Remeras", Visible: "Sí", Destacado: "x" }, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ name: "Remera", basePrice: 12500, categoryName: "Remeras", isVisible: true, isFeatured: true });
  });

  it("reports invalid prices before commit", () => {
    const result = normalizeCatalogImportRow({ Nombre: "A", Precio: "0" }, 3);
    expect(result.success).toBe(false);
  });
});
