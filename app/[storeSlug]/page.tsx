import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ storeSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) {
    return {};
  }

  return {
    title: store.name,
    description: store.description ?? store.heroSubtitle ?? `Catálogo online de ${store.name}`,
    openGraph: {
      title: store.name,
      description: store.description ?? store.heroSubtitle ?? `Catálogo online de ${store.name}`,
      images: store.logoUrl ? [store.logoUrl] : []
    },
    alternates: {
      canonical: `/${store.slug}`
    }
  };
}

export default async function StorePage({ params }: { params: Params }) {
  const { storeSlug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    include: {
      products: {
        where: { isVisible: true },
        include: {
          category: true,
          optionGroups: {
            include: {
              options: { orderBy: { sortOrder: "asc" } }
            },
            orderBy: { sortOrder: "asc" }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!store?.isPublished) {
    notFound();
  }

  return (
    <PublicStore
      store={{
        name: store.name,
        slug: store.slug,
        description: store.description,
        heroTitle: store.heroTitle,
        heroSubtitle: store.heroSubtitle,
        logoUrl: store.logoUrl,
        theme: store.theme
      }}
      products={store.products}
    />
  );
}
