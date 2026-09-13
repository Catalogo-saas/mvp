import { ProductForm } from "@/components/product-form";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function GestionProductsPage() {
  const store = await getMerchantStore();
  if (!store) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: {
      category: true,
      optionGroups: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <div className="space-y-6">
      <header className="panel hidden p-6 md:block">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Productos</p>
        <h1 className="mt-2 text-3xl font-black">Productos y opciones</h1>
        <p className="mt-2 text-muted">Gestioná productos, categorías, imágenes, promos, extras y variantes.</p>
      </header>
      <ProductForm products={products} categories={categories} storeTemplate={store.template} />
    </div>
  );
}
