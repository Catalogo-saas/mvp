export const storeTemplates = [
  "ecommerce",
  "food",
  "boutique-soft",
  "premium-minimal",
  "beauty-pop",
  "baby-natural",
  "baby-atelier",
  "baby-mini",
  "baby-cielito",
  "baby-bosque",
  "baby-abrazo"
] as const;

export type StoreTemplate = (typeof storeTemplates)[number];

export const storeTemplateLabels: Record<StoreTemplate, string> = {
  ecommerce: "Ecommerce",
  food: "Comida",
  "boutique-soft": "Boutique Soft",
  "premium-minimal": "Premium Minimal",
  "beauty-pop": "Beauty Pop",
  "baby-natural": "Nido Natural",
  "baby-atelier": "Petit Atelier",
  "baby-mini": "Mundo Mini",
  "baby-cielito": "Cielito",
  "baby-bosque": "Bosque de Sueños",
  "baby-abrazo": "Dulce Abrazo"
};

type StoreColors = { primary: string; accent: string };

export const templateOriginalColors: Partial<Record<StoreTemplate, StoreColors>> = {
  ecommerce: { primary: "#1e4f43", accent: "#e6ff54" },
  "boutique-soft": { primary: "#e8a5ad", accent: "#cbd6c0" },
  "premium-minimal": { primary: "#9d1f36", accent: "#276346" },
  "beauty-pop": { primary: "#f44599", accent: "#efff63" },
  "baby-natural": { primary: "#677d67", accent: "#d59b74" },
  "baby-atelier": { primary: "#873f43", accent: "#c89570" },
  "baby-mini": { primary: "#4b67d1", accent: "#ff6d55" },
  "baby-cielito": { primary: "#9987c5", accent: "#f1a6b0" },
  "baby-bosque": { primary: "#70866b", accent: "#ca8f64" },
  "baby-abrazo": { primary: "#d57979", accent: "#65a99b" }
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

export function isFashionTemplate(template: StoreTemplate) {
  return template === "boutique-soft" || template === "premium-minimal" || template === "beauty-pop";
}

export function isBabyTemplate(template: StoreTemplate): template is Extract<StoreTemplate, `baby-${string}`> {
  return template === "baby-natural"
    || template === "baby-atelier"
    || template === "baby-mini"
    || template === "baby-cielito"
    || template === "baby-bosque"
    || template === "baby-abrazo";
}

export function isPanelStorefrontTemplate(template: StoreTemplate) {
  return isFashionTemplate(template) || isBabyTemplate(template);
}

export function getEffectiveProductPrice(product: { basePrice: number; promoPrice?: number | null }) {
  return product.promoPrice && product.promoPrice > 0 && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
}

export function getDiscountPercent(product: { basePrice: number; promoPrice?: number | null }) {
  const effectivePrice = getEffectiveProductPrice(product);
  if (effectivePrice >= product.basePrice) {
    return null;
  }
  return Math.round((1 - effectivePrice / product.basePrice) * 100);
}

export function normalizeStoreTemplate(template: string | null | undefined): StoreTemplate {
  if (template === "quick-menu") return "food";
  return storeTemplates.includes(template as StoreTemplate) ? (template as StoreTemplate) : "ecommerce";
}
