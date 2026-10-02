import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getMerchantStore } from "@/lib/merchant";
import { categoryTreeVersion, validateCategoryTree } from "@/lib/category-tree";
import { getAdminCategories } from "@/lib/admin-categories";
import { slugify } from "@/lib/slug";
import { deletePublicObject, getPublicObjectKeyFromUrl } from "@/lib/storage";

const schema = z.object({ version: z.string(), categories: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(2).max(80), parentId: z.string().nullable(), sortOrder: z.number().int().min(0), isVisible: z.boolean().default(true) }).strict()).max(1000) }).strict();
export async function GET() { const store = await getMerchantStore(); if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const categories = await getAdminCategories(store.id); return NextResponse.json({ categories, version: categoryTreeVersion(categories) }); }

export async function PUT(request: Request) {
  const store = await getMerchantStore();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los nombres y la estructura de las categorías." }, { status: 400 });
  const { categories, version } = parsed.data;
  try {
    validateCategoryTree(categories);
    const existing = await prisma.category.findMany({ where: { storeId: store.id } });
    if (categoryTreeVersion(existing) !== version) throw new Error("Las categorías cambiaron. Recargá la página antes de guardar.");
    const existingMap = new Map(existing.map(c => [c.id, c]));
    const nextIds = new Set(categories.map(c => c.id));
    const foreignIds = await prisma.category.count({ where: { id: { in: categories.map(c => c.id) }, storeId: { not: store.id } } });
    if (foreignIds) throw new Error("Categoría inválida.");
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Category" WHERE "storeId" = ${store.id} FOR UPDATE`;
      const current = await tx.category.findMany({ where: { storeId: store.id } });
      if (categoryTreeVersion(current) !== version) throw new Error("Las categorías cambiaron. Recargá la página antes de guardar.");
      // Create nodes before linking them so new parents and children can be saved together.
      for (const category of categories) {
        const previous = existingMap.get(category.id);
        if (previous) await tx.category.update({ where: { id: previous.id }, data: { name: category.name, sortOrder: category.sortOrder, isVisible: category.isVisible } });
        else await tx.category.create({ data: { id: category.id, storeId: store.id, name: category.name, slug: `${slugify(category.name) || "categoria"}-${category.id.slice(-8)}`, sortOrder: category.sortOrder, isVisible: category.isVisible } });
      }
      for (const category of categories) await tx.category.update({ where: { id: category.id }, data: { parentId: category.parentId } });
      await tx.category.deleteMany({ where: { storeId: store.id, id: { notIn: [...nextIds] } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const removedImages = existing.filter(category => !nextIds.has(category.id) && category.imageUrl).map(category => getPublicObjectKeyFromUrl(category.imageUrl!)).filter((key): key is string => key !== null && key.startsWith(`categories/${store.id}/`));
    await Promise.all(removedImages.map(key => deletePublicObject(key).catch(() => null)));
    const result = await getAdminCategories(store.id);
    return NextResponse.json({ categories: result, version: categoryTreeVersion(result) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Prisma.PrismaClientKnownRequestError ? "Las categorías cambiaron mientras guardabas. Recargá e intentá nuevamente." : error instanceof Error ? error.message : "No se pudieron guardar las categorías." }, { status: 409 });
  }
}
