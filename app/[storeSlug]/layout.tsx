import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { normalizeCheckoutSettings } from "@/lib/commerce-settings";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { checkoutSettings: true } });
  return store && normalizeCheckoutSettings(store.checkoutSettings).demoMode ? { robots: { index: false, follow: false } } : {};
}

export default function StoreLayout({ children }: { children: ReactNode }) { return children; }
