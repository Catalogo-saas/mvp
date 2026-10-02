import { prisma } from "@/lib/prisma";

export async function getAdminCategories(storeId: string) {
  const categories = await prisma.category.findMany({ where: { storeId }, include: { assignedProducts: { select: { id: true } }, products: { select: { id: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return categories.map(({ assignedProducts, products, ...category }) => ({ ...category, updatedAt: category.updatedAt.toISOString(), createdAt: category.createdAt.toISOString(), count: new Set([...assignedProducts, ...products].map(p => p.id)).size }));
}
