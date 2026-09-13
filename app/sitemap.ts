import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  if (!process.env.DATABASE_URL || process.env.NEXT_PHASE === "phase-production-build") {
    return [{ url: baseUrl, lastModified: new Date() }];
  }

  try {
    const stores = await prisma.store.findMany({
      where: { isPublished: true, owner: { status: "ACTIVE" } },
      include: { products: { where: { isVisible: true } } }
    });

    return [
      { url: baseUrl, lastModified: new Date() },
      ...stores.flatMap((store) => [
        { url: `${baseUrl}/${store.slug}`, lastModified: store.updatedAt },
        ...store.products.map((product) => ({
          url: `${baseUrl}/${store.slug}/product/${product.slug}`,
          lastModified: product.updatedAt
        }))
      ])
    ];
  } catch {
    return [{ url: baseUrl, lastModified: new Date() }];
  }
}
