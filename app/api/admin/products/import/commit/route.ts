import { NextResponse } from "next/server";
import { z } from "zod";

import { catalogImportRowSchema } from "@/lib/catalog-import";
import { makeUniqueProductSlug } from "@/lib/admin-catalog";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const schema = z.object({ rows: z.array(catalogImportRowSchema).min(1).max(500) });

export async function POST(request: Request) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "La vista previa ya no es válida." }, { status: 400 });

  const categories = new Map<string, string>();
  for (const row of result.data.rows) {
    const name = row.categoryName || "Destacados";
    const key = slugify(name) || "destacados";
    if (!categories.has(key)) {
      const category = await prisma.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: key } },
        update: { name },
        create: { storeId: store.id, name, slug: key }
      });
      categories.set(key, category.id);
    }
  }

  const usedSlugs = new Set<string>();
  const rowsWithSlugs = [];
  for (const row of result.data.rows) {
    let slug = await makeUniqueProductSlug(store.id, row.name);
    while (usedSlugs.has(slug)) slug = await makeUniqueProductSlug(store.id, row.name);
    usedSlugs.add(slug);
    rowsWithSlugs.push({ row, slug });
  }

  await prisma.$transaction(rowsWithSlugs.map(({ row, slug }) => prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: categories.get(slugify(row.categoryName || "Destacados") || "destacados"),
      name: row.name,
      slug,
      description: row.description || null,
      basePrice: row.basePrice,
      promoPrice: row.promoPrice,
      stockQuantity: row.stockQuantity,
      isVisible: row.isVisible,
      isFeatured: row.isFeatured
    }
  })));

  return NextResponse.json({ imported: result.data.rows.length });
}
