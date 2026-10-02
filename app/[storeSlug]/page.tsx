import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { publicStoreCanonicalUrl } from "@/lib/public-store-url";
import { renderStorePage } from "@/lib/render-public-store-page";

type Params = Promise<{ storeSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await prisma.store.findFirst({ where: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } } });
  if (!store) {
    return {};
  }

  return {
    title: store.name,
    description: store.description ?? store.heroSubtitle ?? `Catálogo online de ${store.name}`,
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
    openGraph: {
      title: store.name,
      description: store.description ?? store.heroSubtitle ?? `Catálogo online de ${store.name}`,
      images: store.logoUrl ? [store.logoUrl] : []
    },
    alternates: {
      canonical: publicStoreCanonicalUrl(store)
    }
  };
}

export default async function StorePage({ params, searchParams }: { params: Params; searchParams: Promise<{ pagina?: string; categoria?: string; q?: string; orden?: string; producto?: string }> }) {
  return renderStorePage({ params, searchParams, mode: "home" });
}
