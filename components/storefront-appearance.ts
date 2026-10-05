import type { CSSProperties } from "react";
import { Libre_Baskerville, Manrope, Poppins, Sora } from "next/font/google";
import { getStoreThemeColors, normalizeStoreTemplate } from "@/lib/catalog";
import { normalizeDesignConfig } from "@/lib/design-config";
import { contrastingTextColor } from "@/lib/storefront-design";
import styles from "./commerce-storefront.module.css";

const roma = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-roma", display: "swap" });
const dana = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-dana", display: "swap" });
const vene = Manrope({ subsets: ["latin"], variable: "--font-vene", display: "swap" });
const veneHeading = Sora({ subsets: ["latin"], variable: "--font-vene-heading", display: "swap" });

/** Shared by the catalog and its secondary pages; does not expose commercial data. */
export function storefrontAppearance(store: { template: string; theme: unknown; designConfig: unknown }) {
  const design = normalizeDesignConfig(store.designConfig);
  const colors = getStoreThemeColors(store.template, store.theme);
  const primaryInk = design.primaryContrast ?? contrastingTextColor(colors.primary);
  const secondaryInk = design.secondaryContrast ?? contrastingTextColor(colors.accent);
  const scheme = (value: typeof design.headerColors) => value.mode === "primary" ? { background: colors.primary, text: primaryInk } : value.mode === "secondary" ? { background: colors.accent, text: secondaryInk } : value.mode === "background" ? { background: design.backgroundColor, text: design.textColor } : { background: value.background, text: value.text };
  const header = scheme(design.headerColors), announcement = scheme(design.announcementColors), footer = scheme(design.footerColors);
  return {
    className: [styles.storefront, roma.variable, dana.variable, vene.variable, veneHeading.variable].join(" "),
    "data-template": normalizeStoreTemplate(store.template),
    "data-font": design.font,
    "data-icon-style": design.iconStyle,
    style: {
      "--store-primary": colors.primary,
      "--store-primary-ink": primaryInk,
      "--store-accent": colors.accent,
      "--store-accent-ink": secondaryInk,
      "--store-background": design.backgroundColor,
      "--store-text": design.textColor,
      "--store-header-background": header.background,
      "--store-header-text": header.text,
      "--store-announcement-background": announcement.background,
      "--store-announcement-text": announcement.text,
      "--store-footer-background": footer.background,
      "--store-footer-text": footer.text,
      "--card-radius": design.cardRadius + "px"
    } as CSSProperties
  };
}
