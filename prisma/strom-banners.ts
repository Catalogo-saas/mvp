import { publicPageConfigSchema } from "../lib/public-page-config";

export const stromBannerSources = {
  desktop: {
    file: "desktop.jpg",
    contentType: "image/jpeg",
    author: "Anete Lusina",
    source: "https://www.pexels.com/photo/a-bottle-with-a-protein-shake-standing-on-a-machine-at-the-gym-16513595/",
    download: "https://images.pexels.com/photos/16513595/pexels-photo-16513595/free-photo-of-a-bottle-with-a-protein-shake-standing-on-a-machine-at-the-gym.jpeg?auto=compress&cs=tinysrgb&w=2000&h=700&fit=crop",
    width: 2000,
    height: 700
  },
  mobile: {
    file: "mobile.jpg",
    contentType: "image/jpeg",
    author: "Krzysztof Biernat",
    source: "https://www.pexels.com/photo/close-up-of-preparing-protein-shake-with-powder-15120889/",
    download: "https://images.pexels.com/photos/15120889/pexels-photo-15120889/free-photo-of-close-up-of-preparing-protein-shake-with-powder.jpeg?auto=compress&cs=tinysrgb&w=900&h=1360&fit=crop",
    width: 900,
    height: 1360
  }
} as const;

export const stromBannerIdentity = {
  slug: "strom",
  ownerEmail: "strom-demo@landing.test",
  storeId: "cmuvdti9600019pyj3zfcnruy",
  desktopBannerId: "strom-desktop",
  mobileBannerId: "strom-mobile",
  sectionId: "strom-hero"
} as const;

export function updateStromBannerUrls(value: unknown, urls: { desktop: string; mobile: string }) {
  publicPageConfigSchema.parse(value);
  const config = structuredClone(value) as Record<string, unknown>;
  const sections = config.homeSections;
  if (!Array.isArray(sections)) throw new Error("/strom no tiene una lista de secciones válida.");

  const heroes = sections.filter((section) => isRecord(section) && section.id === stromBannerIdentity.sectionId && section.type === "banners");
  if (heroes.length !== 1) throw new Error("Se esperaba una única sección strom-hero. No se modificó la portada.");
  const bannerItems = (heroes[0] as Record<string, unknown>).bannerItems;
  if (!Array.isArray(bannerItems)) throw new Error("La sección strom-hero no tiene banners configurados.");

  for (const [id, imageUrl, position] of [
    [stromBannerIdentity.desktopBannerId, urls.desktop, "middle-left"],
    [stromBannerIdentity.mobileBannerId, urls.mobile, "bottom-left"]
  ] as const) {
    const matches = bannerItems.filter((item) => isRecord(item) && item.id === id);
    if (matches.length !== 1) throw new Error(`Se esperaba un único banner ${id}. No se modificó la portada.`);
    Object.assign(matches[0] as Record<string, unknown>, {
      imageUrl,
      textColor: "#FFFFFF",
      backgroundColor: "#151515CC",
      fitBackgroundToText: true,
      position
    });
  }

  // Parsing confirms validity; writing the transformed original retains future editor fields.
  return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
