import { publicPageConfigSchema, type PublicPageConfig } from "../lib/public-page-config";
import { betelBrandSchema, betelPalette } from "./betel-seed";

export const betelFashionSources = {
  desktop: {
    file: "desktop.jpg",
    author: "Jessica Povoa",
    origin: "https://www.pexels.com/photo/brown-and-beige-skirts-hanging-on-coathangers-24380104/",
    download: "https://images.pexels.com/photos/24380104/pexels-photo-24380104.jpeg?auto=compress&fit=crop&w=2000&h=800",
    width: 2000, height: 800
  },
  mobile: {
    file: "mobile.jpg",
    author: "RDNE Stock project",
    origin: "https://www.pexels.com/photo/clothes-hanging-on-a-clothing-rack-8581406/",
    download: "https://images.pexels.com/photos/8581406/pexels-photo-8581406.jpeg?auto=compress&fit=crop&w=1000&h=1200",
    width: 1000, height: 1200
  }
};

export function betelFashionBanners(value: unknown, images: { desktopBannerUrl: string; mobileBannerUrl: string }) {
  publicPageConfigSchema.parse(value);
  const urls = betelBrandSchema.pick({ desktopBannerUrl: true, mobileBannerUrl: true }).parse(images);
  // Validate the configuration, but transform the original to preserve unrelated
  // and future editor fields rather than persisting a schema-stripped object.
  const current = value as PublicPageConfig;
  const heroes = current.homeSections.filter(section => section.id === "betel-hero" && section.type === "banners");
  const items = heroes[0]?.bannerItems ?? [];
  if (heroes.length !== 1 || ["betel-desktop", "betel-mobile"].some(id => items.filter(item => item.id === id).length !== 1)) {
    throw new Error("Los banners originales de Betel cambiaron. No se reemplazó ninguna sección.");
  }
  return {
    ...current,
    homeSections: current.homeSections.map(section => section !== heroes[0] ? section : {
      ...section,
      bannerHeight: "medium" as const,
      bannerItems: items.map(item => {
        if (item.id !== "betel-desktop" && item.id !== "betel-mobile") return item;
        const desktop = item.id === "betel-desktop";
        return {
          ...item,
          imageUrl: desktop ? urls.desktopBannerUrl : urls.mobileBannerUrl,
          desktop, mobile: !desktop,
          position: desktop ? "middle-left" as const : "top-center" as const,
          textColor: betelPalette.text,
          backgroundColor: `${betelPalette.background}F2`,
          fitBackgroundToText: true
        };
      })
    })
  };
}
