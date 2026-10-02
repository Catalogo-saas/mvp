"use client";

import { useEffect, useState } from "react";

import { PublicStore, type StorefrontCategory, type StorefrontProduct, type StorefrontStore } from "@/components/public-store";

export function DesignPreviewBridge({ store, products, categories }: { store: StorefrontStore; products: StorefrontProduct[]; categories: StorefrontCategory[] }) {
  const [draft, setDraft] = useState<Partial<StorefrontStore>>({});
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== window.location.origin || !event.data || event.data.type !== "design-preview") return;
      const data = event.data as Record<string, unknown>;
      setDraft({
        name: typeof data.name === "string" ? data.name : store.name,
        logoUrl: data.logoUrl === null ? null : typeof data.logoUrl === "string" ? data.logoUrl : store.logoUrl,
        heroTitle: typeof data.heroTitle === "string" ? data.heroTitle : store.heroTitle,
        heroSubtitle: typeof data.heroSubtitle === "string" ? data.heroSubtitle : store.heroSubtitle,
        heroImageUrls: Array.isArray(data.heroImageUrls) ? data.heroImageUrls.filter((value): value is string => typeof value === "string") : store.heroImageUrls,
        theme: { ...(typeof store.theme === "object" && store.theme ? store.theme : {}), primary: data.primary, accent: data.accent, useTemplateColors: data.useTemplateColors },
        template: typeof data.template === "string" ? data.template : store.template,
        designConfig: data.designConfig ?? store.designConfig,
        publicPageConfig: data.publicPageConfig ?? store.publicPageConfig,
        showCategories: typeof data.showCategories === "boolean" ? data.showCategories : store.showCategories,
        showFeatured: typeof data.showFeatured === "boolean" ? data.showFeatured : store.showFeatured,
        mobileProductColumns: data.mobileProductColumns === 1 || data.mobileProductColumns === 2 ? data.mobileProductColumns : store.mobileProductColumns
      });
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [store]);
  return <PublicStore store={{ ...store, ...draft, isPreview: true }} products={products} categories={categories} />;
}
