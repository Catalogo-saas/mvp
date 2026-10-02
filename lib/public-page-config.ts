import { z } from "zod";

export const publicSectionIds = ["featured", "categories", "catalog", "info"] as const;
export type PublicSectionId = (typeof publicSectionIds)[number];

export const publicSectionLabels: Record<PublicSectionId, string> = {
  featured: "Productos destacados",
  categories: "Categorías",
  catalog: "Productos",
  info: "Información útil"
};

export const homeSectionTypes = ["banners", "purchaseInfo", "featuredCategories", "productGroup"] as const;
export type HomeSectionType = (typeof homeSectionTypes)[number];
export const homeSectionLabels: Record<HomeSectionType, string> = {
  banners: "Banners", purchaseInfo: "Información de compra", featuredCategories: "Categorías destacadas", productGroup: "Grupo de productos"
};
export const purchaseInfoIcons = ["truck", "card", "shield", "onlinePayment", "securePayment", "home", "discount", "return", "store", "email", "phone", "whatsapp", "transfer", "cash"] as const;
export type PurchaseInfoIcon = (typeof purchaseInfoIcons)[number];
export const featuredCategoryLayouts = ["three-even", "four-even", "three-left", "four-right-bottom", "four-right-top", "five", "four-top", "four-bottom"] as const;
export type FeaturedCategoryLayout = (typeof featuredCategoryLayouts)[number];
export const featuredCategoryLayoutSlots: Record<FeaturedCategoryLayout, number> = {
  "three-even": 3,
  "four-even": 4,
  "three-left": 3,
  "four-right-bottom": 4,
  "four-right-top": 4,
  "four-top": 4,
  "four-bottom": 4,
  five: 5
};
export const featuredCategoryReferenceLayouts = featuredCategoryLayouts.slice(0, 6);
export const categorySpacingOptions = ["large", "normal", "small", "none"] as const;
export const bannerPositions = ["middle-center", "middle-right", "middle-left", "top-center", "top-left", "top-right", "bottom-center", "bottom-left", "bottom-right"] as const;
export function isAllowedBannerLink(value: string): boolean {
  const link = value.trim();
  if (!link) return true;
  if (link.startsWith("/") && !link.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(link).protocol); }
  catch { return false; }
}
const bannerItemSchema = z.object({
  id: z.string().min(1), imageUrl: z.string().url(), desktop: z.boolean().default(true), mobile: z.boolean().default(true),
  title: z.string().trim().max(120).default(""), description: z.string().trim().max(500).default(""),
  link: z.string().trim().max(500).refine(isAllowedBannerLink, "Usá una ruta de la tienda o una dirección http/https.").default(""),
  position: z.enum(bannerPositions).default("bottom-center"), textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{8}$/).default("#0000004D"), fitBackgroundToText: z.boolean().default(false)
});
export type BannerItem = z.infer<typeof bannerItemSchema>;
export function createBannerItem(imageUrl: string, id: string): BannerItem {
  return bannerItemSchema.parse({ id, imageUrl });
}
export function getBannerItems(section: HomeSection): BannerItem[] {
  return section.bannerItems ?? section.images.map((imageUrl, index) => createBannerItem(imageUrl, `legacy-banner-${index + 1}`));
}
export function safeBannerLink(value: string, slug: string): string {
  const link = value.trim();
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//")) return `/${slug}${link === "/" ? "" : link}`;
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch { return ""; }
}
const featuredCategoryTileSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().default(""),
  title: z.string().trim().max(80).default(""),
  imageUrl: z.string().url().or(z.literal("")).default("")
});
const purchaseInfoColorsSchema = z.object({
  mode: z.enum(["primary", "secondary", "background", "custom"]).default("background"),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#242424")
}).default({ mode: "background", background: "#ffffff", text: "#242424" });
const homeSectionSchema = z.object({
  id: z.string().min(1).max(100), type: z.enum(homeSectionTypes), enabled: z.boolean(),
  title: z.string().trim().max(100), description: z.string().trim().max(500),
  images: z.array(z.string().url()).max(6), categoryImages: z.record(z.string(), z.string().url()).default({}),
  bannerItems: z.array(bannerItemSchema).max(6).optional(),
  bannerHeight: z.enum(["small", "medium", "large", "auto"]).default("auto"),
  bannerAutoplay: z.boolean().default(true), bannerInterval: z.number().int().min(3).max(10).default(5),
  categoryIds: z.array(z.string()),
  categoryTiles: z.array(featuredCategoryTileSchema).optional(),
  categoryLayout: z.enum(featuredCategoryLayouts).default("three-left"),
  categorySpacing: z.enum(categorySpacingOptions).default("small"),
  categoryColors: purchaseInfoColorsSchema.optional(),
  productIds: z.array(z.string()).max(24),
  layout: z.enum(["grid", "carousel"]).default("grid"),
  infoColors: purchaseInfoColorsSchema,
  infoItems: z.array(z.object({ icon: z.enum(purchaseInfoIcons), title: z.string().max(80), text: z.string().max(250) })).max(4)
}).superRefine((section, context) => {
  if (section.type === "purchaseInfo" && section.infoItems.length < 1) context.addIssue({ code: "custom", path: ["infoItems"], message: "La información de compra debe mostrar al menos un elemento." });
});
export type HomeSection = z.infer<typeof homeSectionSchema>;

function uniquePurchaseInfoItems(items: HomeSection["infoItems"]) {
  const usedIcons = new Set<PurchaseInfoIcon>();
  return items.map((item) => {
    if (!usedIcons.has(item.icon)) {
      usedIcons.add(item.icon);
      return item;
    }

    const replacement = purchaseInfoIcons.find((icon) => !usedIcons.has(icon));
    if (!replacement) return item;
    usedIcons.add(replacement);
    return { ...item, icon: replacement };
  });
}

export function createHomeSection(type: HomeSectionType, id: string): HomeSection {
  return { id, type, enabled: true, title: homeSectionLabels[type], description: "", images: [], bannerHeight: "auto", bannerAutoplay: true, bannerInterval: 5, categoryImages: {}, categoryIds: [], categoryLayout: "three-left", categorySpacing: "small", productIds: [], layout: "grid", infoItems: type === "purchaseInfo" ? [
    { icon: "truck", title: "Envíos", text: "Recibí tu pedido donde quieras" },
    { icon: "onlinePayment", title: "Medios de pago", text: "Elegí cómo pagar" },
    { icon: "securePayment", title: "Compra segura", text: "Comprá con confianza" }
  ] : [], infoColors: { mode: "background", background: "#ffffff", text: "#242424" } };
}
export const defaultHomeSections: HomeSection[] = [
  createHomeSection("banners", "home-banners"), createHomeSection("purchaseInfo", "home-info"),
  createHomeSection("featuredCategories", "home-categories"), createHomeSection("productGroup", "home-products")
];

const optionalUrl = z.string().trim().url().or(z.literal(""));
const announcementSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().trim().max(120).default("")
}).default({ enabled: false, text: "" });
const infoSchema = z.object({
  enabled: z.boolean().default(false),
  shipping: z.string().trim().max(500).default(""),
  returns: z.string().trim().max(500).default(""),
  sizeGuide: z.string().trim().max(700).default("")
}).default({ enabled: false, shipping: "", returns: "", sizeGuide: "" });
const socialsSchema = z.object({
  instagram: optionalUrl.default(""),
  tiktok: optionalUrl.default(""),
  facebook: optionalUrl.default("")
}).default({ instagram: "", tiktok: "", facebook: "" });

export const publicPageConfigSchema = z.object({
  version: z.literal(3).default(3),
  sections: z.array(z.enum(publicSectionIds)).max(publicSectionIds.length).default([...publicSectionIds]),
  homeSections: z.array(homeSectionSchema).max(20).default(defaultHomeSections),
  announcement: announcementSchema,
  info: infoSchema,
  socials: socialsSchema,
  featuredTitle: z.string().trim().max(80).default("Elegidos para vos"),
  categoriesTitle: z.string().trim().max(80).default("")
});

const legacyPublicPageConfigSchema = z.object({
  version: z.literal(1),
  sections: z.array(z.string()).default([]),
  announcement: announcementSchema,
  info: infoSchema,
  socials: socialsSchema,
  featuredTitle: z.string().trim().max(80).default("Elegidos para vos")
});
const v2PublicPageConfigSchema = publicPageConfigSchema.omit({ version: true, homeSections: true }).extend({ version: z.literal(2) });

export type PublicPageConfig = z.infer<typeof publicPageConfigSchema>;

export const defaultPublicPageConfig: PublicPageConfig = {
  version: 3,
  sections: [...publicSectionIds],
  homeSections: structuredClone(defaultHomeSections),
  announcement: { enabled: false, text: "" },
  info: { enabled: false, shipping: "", returns: "", sizeGuide: "" },
  socials: { instagram: "", tiktok: "", facebook: "" },
  featuredTitle: "Elegidos para vos",
  categoriesTitle: ""
};

function completeSections(sections: readonly string[]) {
  const valid = sections.filter((section): section is PublicSectionId => publicSectionIds.includes(section as PublicSectionId));
  const unique = valid.filter((section, index) => valid.indexOf(section) === index);
  return [...unique, ...publicSectionIds.filter((section) => !unique.includes(section))];
}

export function normalizePublicPageConfig(value: unknown): PublicPageConfig {
  const parsed = publicPageConfigSchema.safeParse(value);
  if (parsed.success) {
    return {
      ...parsed.data,
      sections: completeSections(parsed.data.sections),
      homeSections: parsed.data.homeSections.map((section) => {
        if (section.type === "purchaseInfo") return { ...section, infoItems: uniquePurchaseInfoItems(section.infoItems) };
        if (section.type !== "featuredCategories" || section.categoryTiles !== undefined || !section.categoryIds.length) return section;
        return {
          ...section,
          categoryTiles: section.categoryIds.map((categoryId, index) => ({
            id: `legacy-${index + 1}`,
            categoryId,
            title: "",
            imageUrl: section.categoryImages[categoryId] ?? ""
          }))
        };
      })
    };
  }

  const v2 = v2PublicPageConfigSchema.safeParse(value);
  if (v2.success) return { ...v2.data, version: 3, homeSections: structuredClone(defaultHomeSections), sections: completeSections(v2.data.sections) };

  const legacy = legacyPublicPageConfigSchema.safeParse(value);
  if (legacy.success) {
    return {
      version: 3,
      sections: completeSections(legacy.data.sections),
      homeSections: structuredClone(defaultHomeSections),
      announcement: legacy.data.announcement,
      info: legacy.data.info,
      socials: legacy.data.socials,
      featuredTitle: legacy.data.featuredTitle,
      categoriesTitle: ""
    };
  }

  return structuredClone(defaultPublicPageConfig);
}

export function safeSocialUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
