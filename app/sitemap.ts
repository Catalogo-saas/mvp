import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { normalizeCheckoutSettings } from "@/lib/commerce-settings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  if (!process.env.DATABASE_URL || process.env.NEXT_PHASE === "phase-production-build") {
    return [];
  }

  try {
    const stores = await prisma.store.findMany({
      where: { isPublished: true, owner: { status: "ACTIVE" } },
      include: { products: { where: { isVisible: true } } }
    });

    return stores
      .filter(store => !normalizeCheckoutSettings(store.checkoutSettings).demoMode)
      .flatMap(store => [
        { url: `${baseUrl}/${store.slug}`, lastModified: store.updatedAt },
        ...store.products.map(product => ({
          url: `${baseUrl}/${store.slug}/producto/${product.slug}`,
          lastModified: product.updatedAt
        }))
      ]);
  } catch {
    return [];
  }
}
