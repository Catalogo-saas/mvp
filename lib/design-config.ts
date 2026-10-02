import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const colorScheme = z.object({ mode: z.enum(["primary", "secondary", "background", "custom"]).default("primary"), background: hex.default("#ffffff"), text: hex.default("#242424") });

export const designConfigSchema = z.object({
  font: z.enum(["template", "serif", "sans", "rounded"]).default("template"),
  iconStyle: z.enum(["thin", "regular", "bold"]).default("regular"),
  headerSticky: z.boolean().default(true),
  logoSize: z.number().int().min(32).max(96).default(44),
  productImageRatio: z.enum(["portrait", "square"]).default("portrait"),
  productImageFit: z.enum(["cover", "contain"]).default("cover"),
  cardRadius: z.number().int().min(0).max(32).default(0),
  quickBuyEnabled: z.boolean().default(false),
  floatingCartEnabled: z.boolean().default(false),
  showSku: z.boolean().default(false),
  footerText: z.string().max(240).default(""),
  primaryContrast: hex.nullable().default(null),
  secondaryContrast: hex.nullable().default(null),
  backgroundColor: hex.default("#ffffff"),
  textColor: hex.default("#242424"),
  headerColors: colorScheme.default({ mode: "background", background: "#ffffff", text: "#242424" }),
  announcementColors: colorScheme.default({ mode: "primary", background: "#ffffff", text: "#242424" }),
  footerColors: colorScheme.default({ mode: "background", background: "#ffffff", text: "#242424" }),
  footerOptions: z.object({ showMenu: z.boolean().default(true), showPaymentMethods: z.boolean().default(true), showDeliveryMethods: z.boolean().default(true), showContact: z.boolean().default(true), showSocials: z.boolean().default(true) }).default({ showMenu: true, showPaymentMethods: true, showDeliveryMethods: true, showContact: true, showSocials: true })
});

export const defaultDesignConfig = designConfigSchema.parse({});
export function normalizeDesignConfig(value: unknown) {
  return designConfigSchema.catch(defaultDesignConfig).parse(value);
}
