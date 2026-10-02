import { ProductForm } from "@/components/product-form";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function NewProductPage() {
  const store = await getMerchantStore();
  if (!store) return null;
  const categories = await prisma.category.findMany({ where: { storeId: store.id }, include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } });
  return <ProductForm products={[]} categories={categories} storeTemplate={store.template} showFeatured={store.showFeatured} editorMode={{ type: "new" }} />;
}
