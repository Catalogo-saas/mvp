import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";

import { normalizeCatalogImportRow, type CatalogImportRow } from "@/lib/catalog-import";
import { getMerchantStore } from "@/lib/merchant";

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Seleccioná un archivo CSV o XLSX de hasta 8 MB." }, { status: 400 });
  }

  let rawRows: Record<string, unknown>[];
  try {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await file.arrayBuffer());
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    const worksheet = isCsv ? await workbook.csv.read(Readable.from(buffer)) : (await workbook.xlsx.load(buffer as never)).worksheets[0];
    const headers = worksheet?.getRow(1).values as unknown[] | undefined;
    rawRows = [];
    worksheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const data: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        const header = String(headers?.[column] ?? "").trim();
        if (header) data[header] = typeof cell.value === "number" ? cell.value : cell.text;
      });
      if (Object.values(data).some((value) => String(value).trim())) rawRows.push(data);
    });
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo." }, { status: 400 });
  }

  if (!rawRows.length || rawRows.length > 500) {
    return NextResponse.json({ error: rawRows.length ? "El máximo es 500 productos por importación." : "El archivo no tiene filas para importar." }, { status: 400 });
  }

  const rows: CatalogImportRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];
  rawRows.forEach((raw, index) => {
    const result = normalizeCatalogImportRow(raw, index + 2);
    if (result.success) rows.push(result.data);
    else errors.push({ rowNumber: index + 2, message: result.error.issues.map((issue) => issue.message).join(" ") });
  });

  return NextResponse.json({ rows, errors, total: rawRows.length });
}
