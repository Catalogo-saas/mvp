import type { Prisma } from "@/lib/generated/prisma/client";
import { categoryDescendantIds } from "@/lib/category-tree";
import { getCatalogPrices, getDiscountPercent } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const publicProductPageSize = 12;

export const publicProductInclude = {
  category: true,
  assignedCategories: true,
  optionGroups: { include: { options: { orderBy: { sortOrder: "asc" as const } } }, orderBy: { sortOrder: "asc" as const } }
};

export function publicProductWhere(storeId: string, categories: Array<{ id: string; slug: string; parentId: string | null }>, query: string, category: string): Prisma.ProductWhereInput {
  const q = query.trim().slice(0, 100);
  const selected = categories.find(item => item.slug === category);
  const ids = selected ? [...categoryDescendantIds(selected.id, categories)] : [];
  return {
    storeId, isVisible: true,
    ...(q ? { OR: [ { name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }, { assignedCategories: { some: { name: { contains: q, mode: "insensitive" } } } } ] } : {}),
    ...(selected ? { AND: [{ OR: [ { categoryId: { in: ids } }, { assignedCategories: { some: { id: { in: ids } } } } ] }] } : {})
  };
}

export function publicProductOrder(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "price-asc") return [{ basePrice: "asc" }, { id: "asc" }];
  if (sort === "price-desc") return [{ basePrice: "desc" }, { id: "asc" }];
  if (sort === "name") return [{ name: "asc" }, { id: "asc" }];
  return [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }];
}

export async function getPublicProductPage(input: { storeId: string; categories: Array<{ id: string; slug: string; parentId: string | null }>; query: string; category: string; sort: string; page: number; take?: number }) {
  const { storeId, categories, query, category, sort, page } = input;
  const take = input.take ?? publicProductPageSize;
  const where = publicProductWhere(storeId, categories, query, category);
  if (category === "promos" || sort === "price-asc" || sort === "price-desc") {
    const summaries = await prisma.product.findMany({ where, select: { id: true, basePrice: true, promoPrice: true, variants: true, sortOrder: true } });
    const matching = category === "promos" ? summaries.filter(product => getDiscountPercent(product) !== null) : summaries;
    matching.sort((a, b) => sort === "price-asc" ? getCatalogPrices(a).effective - getCatalogPrices(b).effective || a.id.localeCompare(b.id) : sort === "price-desc" ? getCatalogPrices(b).effective - getCatalogPrices(a).effective || a.id.localeCompare(b.id) : a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const ids = matching.slice((page - 1) * publicProductPageSize, (page - 1) * publicProductPageSize + take).map(product => product.id);
    const records = await prisma.product.findMany({ where: { id: { in: ids }, storeId }, include: publicProductInclude });
    const byId = new Map(records.map(product => [product.id, product]));
    return { products: ids.map(id => byId.get(id)).filter((product): product is NonNullable<typeof product> => Boolean(product)), total: matching.length };
  }
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, include: publicProductInclude, orderBy: publicProductOrder(sort), skip: (page - 1) * publicProductPageSize, take })
  ]);
  return { products, total };
}
