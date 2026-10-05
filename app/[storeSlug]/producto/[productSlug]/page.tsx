import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicProductInclude, publicProductOrder } from "@/lib/public-product-query";
import { visibleCategories } from "@/lib/public-categories";
import { getEffectiveProductPrice } from "@/lib/catalog";
import { publicStoreCanonicalUrl } from "@/lib/public-store-url";
import { getStoreCustomer } from "@/lib/customer-auth";
import { StorefrontProductPage } from "@/components/storefront-product-page";
import { normalizeCheckoutSettings } from "@/lib/commerce-settings";

type Params = Promise<{ storeSlug: string; productSlug: string }>;

async function load(storeSlug: string, productSlug: string) {
  return prisma.product.findFirst({
    where: { slug: productSlug, isVisible: true, store: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } } },
    include: { ...publicProductInclude, store: { include: { categories: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } } }
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const product = await load(storeSlug, productSlug);
  if (!product) return {};
  const description = product.description?.trim() || `Comprá ${product.name} en ${product.store.name}.`;
  const image = product.imageUrls[0];
  const url = publicStoreCanonicalUrl(product.store, `/producto/${product.slug}`);
  return {
    title: `${product.name} · ${product.store.name}`, description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: product.name, description, url, siteName: product.store.name, images: image ? [{ url: image, alt: product.name }] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.name, description, images: image ? [image] : [] }
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { storeSlug, productSlug } = await params;
  const product = await load(storeSlug, productSlug);
  if (!product) notFound();
  const [related, customer] = await Promise.all([
    prisma.product.findMany({ where: { storeId: product.storeId, isVisible: true, id: { not: product.id }, categoryId: product.categoryId || undefined }, include: publicProductInclude, orderBy: publicProductOrder("default"), take: 4 }),
    getStoreCustomer(storeSlug)
  ]);
  const store = product.store;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description || undefined, image: product.imageUrls, offers: { "@type": "Offer", priceCurrency: "ARS", price: getEffectiveProductPrice(product), availability: product.stockQuantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: publicStoreCanonicalUrl(store, `/producto/${product.slug}`) } };
  return <>
    {!normalizeCheckoutSettings(store.checkoutSettings).demoMode && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>}
    <StorefrontProductPage product={product} related={related} categories={visibleCategories(store.categories)} signedIn={Boolean(customer)} store={{
      name: store.name, slug: store.slug, whatsappPhone: store.whatsappPhone, description: store.description,
      heroTitle: store.heroTitle, heroSubtitle: store.heroSubtitle, logoUrl: store.logoUrl, template: store.template,
      theme: store.theme, designConfig: store.designConfig, mobileProductColumns: store.mobileProductColumns,
      heroImageUrls: store.heroImageUrls, showCategories: store.showCategories, showFeatured: store.showFeatured,
      freeShippingEnabled: store.freeShippingEnabled, freeShippingThreshold: store.freeShippingThreshold,
      acceptTransferPayments: store.acceptTransferPayments, acceptCashPayments: store.acceptCashPayments,
      whatsappOrdersEnabled: store.whatsappOrdersEnabled, checkoutSettings: store.checkoutSettings,
      deliveryMethods: store.deliveryMethods, menuConfig: store.menuConfig, taxRatePercent: store.taxRatePercent,
      showPricesWithoutTax: store.showPricesWithoutTax, paymentAccountHolder: store.paymentAccountHolder,
      paymentProvider: store.paymentProvider, paymentAlias: store.paymentAlias, paymentCbu: store.paymentCbu,
      address: store.address, businessHoursText: store.businessHoursText, publicPageConfig: store.publicPageConfig,
      availability: { isOpen: true, label: "" }
    }}/>
  </>;
}
