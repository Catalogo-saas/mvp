import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ storeSlug: string; productSlug: string }>;

async function getProduct(storeSlug: string, productSlug: string) {
  return prisma.product.findFirst({
    where: {
      slug: productSlug,
      isVisible: true,
      store: { slug: storeSlug, isPublished: true }
    },
    include: {
      store: true,
      category: true,
      optionGroups: { include: { options: true } }
    }
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const product = await getProduct(storeSlug, productSlug);
  if (!product) {
    return {};
  }

  return {
    title: `${product.name} · ${product.store.name}`,
    description: product.description ?? `Producto de ${product.store.name}`,
    openGraph: {
      title: product.name,
      description: product.description ?? `Producto de ${product.store.name}`,
      images: product.imageUrls[0] ? [product.imageUrls[0]] : []
    },
    alternates: {
      canonical: `/${product.store.slug}/product/${product.slug}`
    }
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { storeSlug, productSlug } = await params;
  const product = await getProduct(storeSlug, productSlug);
  if (!product) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrls,
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: product.basePrice,
      availability: "https://schema.org/InStock"
    }
  };

  return (
    <main className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href={`/${product.store.slug}`} className="font-bold text-brand">
        ← Volver a {product.store.name}
      </Link>
      <section className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel overflow-hidden">
          {product.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrls[0]} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-muted">Sin imagen</div>
          )}
        </div>
        <div className="panel p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-brand">{product.category?.name ?? "Producto"}</p>
          <h1 className="mt-3 text-4xl font-black">{product.name}</h1>
          <p className="mt-4 text-lg leading-8 text-muted">{product.description}</p>
          <p className="mt-6 text-3xl font-black">{formatMoney(product.basePrice)}</p>
          <div className="mt-8 space-y-4">
            {product.optionGroups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-line p-4">
                <p className="font-black">{group.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {group.options.map((option) => `${option.name}${option.priceDelta ? ` +${formatMoney(option.priceDelta)}` : ""}`).join(", ")}
                </p>
              </div>
            ))}
          </div>
          <Link href={`/${product.store.slug}`} className="btn-primary mt-8">
            Armar pedido
          </Link>
        </div>
      </section>
    </main>
  );
}
