import { CatalogManager } from "@/components/catalog-manager";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function GestionProductsPage() {
  const store = await getMerchantStore();
  if (!store) return null;
  const categories = await prisma.category.findMany({ where: { storeId: store.id }, select: { id: true, name: true, parentId: true }, orderBy: { sortOrder: "asc" } });
  return <CatalogManager categories={categories} storeSlug={store.slug} />;
}
