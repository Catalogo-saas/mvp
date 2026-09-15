import { z } from "zod";

export const publicSectionIds = ["featured", "categories", "catalog", "info"] as const;
export type PublicSectionId = (typeof publicSectionIds)[number];

export const publicSectionLabels: Record<PublicSectionId, string> = {
  featured: "Productos destacados",
  categories: "Categorías",
  catalog: "Productos",
  info: "Información útil"
};

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
  version: z.literal(2).default(2),
  sections: z.array(z.enum(publicSectionIds)).max(publicSectionIds.length).default([...publicSectionIds]),
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

export type PublicPageConfig = z.infer<typeof publicPageConfigSchema>;

export const defaultPublicPageConfig: PublicPageConfig = {
  version: 2,
  sections: [...publicSectionIds],
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
    return { ...parsed.data, sections: completeSections(parsed.data.sections) };
  }

  const legacy = legacyPublicPageConfigSchema.safeParse(value);
  if (legacy.success) {
    return {
      version: 2,
      sections: completeSections(legacy.data.sections),
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
