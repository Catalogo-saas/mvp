import { notFound } from "next/navigation";

import { ProductForm } from "@/components/product-form";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const store = await getMerchantStore();
  if (!store) return null;
  const { productId } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, storeId: store.id }, include: { category: true, assignedCategories: true, optionGroups: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } }),
    prisma.category.findMany({ where: { storeId: store.id }, include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } })
  ]);
  if (!product) notFound();
  return <ProductForm products={[product]} categories={categories} storeTemplate={store.template} showFeatured={store.showFeatured} editorMode={{ type: "edit", productId }} />;
}
