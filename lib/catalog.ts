import { normalizeVariants } from "@/lib/product-variants";

export const storeTemplates = [
  "roma",
  "dana",
  "vene"
] as const;

export const publicStoreTemplates = ["roma", "dana", "vene"] as const;

export type StoreTemplate = (typeof storeTemplates)[number];

export const storeTemplateLabels: Record<StoreTemplate, string> = {
  roma: "Roma · Clásica",
  dana: "Dana · Editorial",
  vene: "Vene · Moderna"
};

export const defaultCategoryTitles: Record<StoreTemplate, string> = {
  roma: "Descubrí nuestras categorías",
  dana: "Categorías",
  vene: "Explorá la tienda"
};

export function getDefaultCategoryTitle(template: string | null | undefined) {
  return defaultCategoryTitles[normalizeStoreTemplate(template)];
}

type StoreColors = { primary: string; accent: string };

export const templateOriginalColors: Partial<Record<StoreTemplate, StoreColors>> = {
  roma: { primary: "#d99195", accent: "#f2e4e4" },
  dana: { primary: "#176877", accent: "#f5c4d4" },
  vene: { primary: "#ee7947", accent: "#191919" }
};

export function supportsOriginalTemplateColors(template: string | null | undefined) {
  return Boolean(templateOriginalColors[normalizeStoreTemplate(template)]);
}

export function getStoreThemeColors(template: string | null | undefined, theme: unknown) {
  const normalizedTemplate = normalizeStoreTemplate(template);
  const values = theme && typeof theme === "object" ? theme as Record<string, unknown> : {};
  const custom = {
    primary: typeof values.primary === "string" ? values.primary : "#16a34a",
    accent: typeof values.accent === "string" ? values.accent : "#f97316"
  };
  const original = templateOriginalColors[normalizedTemplate];
  const useTemplateColors = values.useTemplateColors === true && Boolean(original);
  const effective = useTemplateColors && original ? original : custom;

  return {
    ...effective,
    customPrimary: custom.primary,
    customAccent: custom.accent,
    useTemplateColors,
    originalColors: original ?? null
  };
}

export function isPanelStorefrontTemplate(template: StoreTemplate) {
  return template === "roma" || template === "dana" || template === "vene";
}

export function getCatalogPrices(product: { basePrice: number; promoPrice?: number | null; variants?: unknown }) {
  const variants = normalizeVariants(product.variants).filter(variant => variant.isVisible);
  if (variants.length) {
    const prices = variants.map(variant => {
      const regular = variant.basePrice ?? product.basePrice;
      const effective = variant.promoPrice !== null && variant.promoPrice > 0 && variant.promoPrice < regular ? variant.promoPrice : regular;
      return { regular, effective };
    });
    return prices.reduce((best, current) => current.effective < best.effective ? current : best);
  }
  const effective = product.promoPrice && product.promoPrice > 0 && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
  return { regular: product.basePrice, effective };
}

export function getEffectiveProductPrice(product: { basePrice: number; promoPrice?: number | null; variants?: unknown }) {
  return getCatalogPrices(product).effective;
}

export function getDiscountPercent(product: { basePrice: number; promoPrice?: number | null; variants?: unknown }) {
  const { regular, effective } = getCatalogPrices(product);
  if (effective >= regular) {
    return null;
  }
  return Math.round((1 - effective / regular) * 100);
}

export function normalizeStoreTemplate(template: string | null | undefined): StoreTemplate {
  return storeTemplates.includes(template as StoreTemplate) ? (template as StoreTemplate) : "roma";
}
