import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StorefrontCheckoutPage } from "@/components/storefront-checkout-page";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await prisma.store.findFirst({ where: { slug: storeSlug, isPublished: true, owner: { status: "ACTIVE" } }, select: {
    name: true, slug: true, logoUrl: true, template: true, theme: true, designConfig: true,
    acceptCashPayments: true, acceptTransferPayments: true, whatsappOrdersEnabled: true,
    checkoutSettings: true, deliveryMethods: true, showPricesWithoutTax: true, taxRatePercent: true,
    paymentAlias: true, paymentAccountHolder: true, paymentProvider: true, paymentCbu: true,
    products: { where: { isVisible: true, freeShipping: true }, select: { id: true } }
  } });
  if (!store) notFound();
  return <StorefrontCheckoutPage store={{ ...store, freeShippingProductIds: store.products.map(product => product.id) }}/ >;
}
