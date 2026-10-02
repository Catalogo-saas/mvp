import type { Prisma } from "@/lib/generated/prisma/client";

export function paginationQuery(params: URLSearchParams) {
  const raw = Number(params.get("page") || 1);
  const page = Number.isSafeInteger(raw) ? Math.max(1, raw) : 1;
  const pageSize = [10, 25, 50].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 25;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export function productListWhere(storeId: string, params: URLSearchParams): Prisma.ProductWhereInput {
  const q = params.get("q")?.trim();
  const category = params.get("category");
  const visibility = params.get("visibility");
  return { storeId, AND: [
    ...(q ? [{ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }, { category: { name: { contains: q, mode: "insensitive" as const } } }, { assignedCategories: { some: { name: { contains: q, mode: "insensitive" as const } } } }] }] : []),
    ...(category && category !== "all" ? [category === "none" ? { categoryId: null, assignedCategories: { none: {} } } : { OR: [{ category: { OR: [{ id: category }, { parentId: category }, { parent: { parentId: category } }] } }, { assignedCategories: { some: { OR: [{ id: category }, { parentId: category }, { parent: { parentId: category } }] } } }] }] : []),
    ...(visibility === "visible" || visibility === "hidden" ? [{ isVisible: visibility === "visible" }] : [])
  ] };
}
