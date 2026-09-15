import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { prisma } from "@/lib/prisma";
import { publicStoreCanonicalUrl } from "@/lib/public-store-url";
import { getStoreAvailability } from "@/lib/store-settings";

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

export default async function StorePage({ params }: { params: Params }) {
  const { storeSlug } = await params;
  const store = await prisma.store.findFirst({
    where: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } },
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
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

  if (!store) {
    notFound();
  }

  const availability = getStoreAvailability({
    restrictBySchedule: store.restrictBySchedule,
    businessHours: store.businessHours
  });

  return (
    <PublicStore
      store={{
        name: store.name,
        slug: store.slug,
        whatsappPhone: store.whatsappPhone,
        description: store.description,
        heroTitle: store.heroTitle,
        heroSubtitle: store.heroSubtitle,
        logoUrl: store.logoUrl,
        template: store.template,
        theme: store.theme,
        mobileProductColumns: store.mobileProductColumns,
        heroImageUrls: store.heroImageUrls,
        showCategories: store.showCategories,
        showFeatured: store.showFeatured,
        freeShippingEnabled: store.freeShippingEnabled,
        freeShippingThreshold: store.freeShippingThreshold,
        acceptTransferPayments: store.acceptTransferPayments,
        paymentAccountHolder: store.acceptTransferPayments ? store.paymentAccountHolder : null,
        paymentProvider: store.acceptTransferPayments ? store.paymentProvider : null,
        paymentAlias: store.acceptTransferPayments ? store.paymentAlias : null,
        paymentCbu: store.acceptTransferPayments ? store.paymentCbu : null,
        address: store.address,
        businessHoursText: store.businessHoursText,
        publicPageConfig: store.publicPageConfig,
        availability
      }}
      products={store.products}
      categories={store.categories}
    />
  );
}
