import { ProductForm } from "@/components/product-form";
import { getMerchantStore } from "@/lib/merchant";
import { prisma } from "@/lib/prisma";

export default async function AdminProductsPage() {
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

  return (
    <div className="space-y-6">
      <header className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Catálogo</p>
        <h1 className="mt-2 text-3xl font-black">Productos y opciones</h1>
        <p className="mt-2 text-muted">Cargá productos con colores, talles, extras o agregados.</p>
      </header>
      <ProductForm products={products} />
    </div>
  );
}
