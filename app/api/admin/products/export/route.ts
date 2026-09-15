import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { catalogWorkbookColumns, catalogWorkbookExample } from "@/lib/catalog-workbook";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const templateOnly = new URL(request.url).searchParams.get("mode") === "template";
  const products = templateOnly ? [] : await prisma.product.findMany({ where: { storeId: store.id }, include: { category: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  const rows = products.map((product) => ({
    Nombre: product.name,
    Descripción: product.description ?? "",
    Precio: product.basePrice,
    "Precio oferta": product.promoPrice ?? "",
    Categoría: product.category?.name ?? "",
    Stock: product.stockQuantity ?? "",
    Visible: product.isVisible ? "Sí" : "No",
    Destacado: product.isFeatured ? "Sí" : "No"
  }));
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Productos");
  worksheet.columns = catalogWorkbookColumns.map((column) => ({ ...column }));
  (templateOnly ? [catalogWorkbookExample] : rows).forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: "A1", to: "H1" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const output = await workbook.xlsx.writeBuffer();
  const filename = templateOnly ? "plantilla-productos.xlsx" : `catalogo-${store.slug}.xlsx`;
  return new NextResponse(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"` } });
}
