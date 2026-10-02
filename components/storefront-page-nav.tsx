"use client";

import type { StorefrontStore } from "@/components/public-store";
import { StorefrontHeader } from "./storefront-header";

export function StorefrontPageNav({ store, categories, signedIn = false, cartCount, onCart }: {
  store: Pick<StorefrontStore, "name" | "slug" | "logoUrl" | "designConfig">;
  categories: Array<{ id: string; name: string; slug: string; parentId?: string | null }>;
  signedIn?: boolean;
  cartCount?: number;
  onCart?: () => void;
}) {
  return <StorefrontHeader store={{ ...store, signedIn }} categories={categories} cartCount={cartCount} onCart={onCart}/>;
}
