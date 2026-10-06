import { describe, expect, it } from "vitest";
import { betelFashionBanners } from "../prisma/betel-banners";
import { betelStoreSettings } from "../prisma/betel-seed";

const brand = {
  logoUrl: "https://example.invalid/logo.jpg",
  desktopBannerUrl: "https://example.invalid/desktop.svg",
  mobileBannerUrl: "https://example.invalid/mobile.svg"
};
const images = { desktopBannerUrl: "https://example.invalid/fashion-desktop.jpg", mobileBannerUrl: "https://example.invalid/fashion-mobile.jpg" };

describe("fotos del banner de Betel", () => {
  it("reemplaza solo las fotos y su presentación, sin mutar los originales", () => {
    const current = betelStoreSettings(brand).publicPageConfig;
    const before = structuredClone(current);
    const next = betelFashionBanners(current, images);
    expect(current).toEqual(before);
    expect(next.homeSections.slice(1)).toEqual(before.homeSections.slice(1));
    expect(next.announcement).toEqual(before.announcement);
    expect(next.homeSections[0].bannerAutoplay).toBe(false);
    expect(next.homeSections[0].bannerHeight).toBe("medium");
    expect(next.homeSections[0].bannerItems?.map(item => item.imageUrl)).toEqual(Object.values(images));
    for (const [i, item] of next.homeSections[0].bannerItems!.entries()) {
      expect(item.title).toBe(before.homeSections[0].bannerItems![i].title);
      expect(item.description).toBe(before.homeSections[0].bannerItems![i].description);
      expect(item.link).toBe(before.homeSections[0].bannerItems![i].link);
      expect(item.backgroundColor).toBe("#F8EDE2F2");
      expect(item.fitBackgroundToText).toBe(true);
    }
    expect(next.homeSections[0].bannerItems![0].position).toBe("middle-left");
    expect(next.homeSections[0].bannerItems![1].position).toBe("top-center");
  });

  it("conserva campos futuros y textos editados por el comercio", () => {
    const current = { ...betelStoreSettings(brand).publicPageConfig, futureField: "keep" };
    const hero = current.homeSections[0];
    Object.assign(hero.bannerItems![0], { title: "Texto propio", link: "/contacto", futureBanner: "keep" });
    const next = betelFashionBanners(current, images);
    expect(next).toMatchObject({ futureField: "keep" });
    expect(next.homeSections[0].bannerItems![0]).toMatchObject({ title: "Texto propio", link: "/contacto", futureBanner: "keep" });
  });

  it("es idempotente para las mismas fotos", () => {
    const once = betelFashionBanners(betelStoreSettings(brand).publicPageConfig, images);
    expect(betelFashionBanners(once, images)).toEqual(once);
  });

  it("rechaza banners renombrados sin reconstruir el home", () => {
    const current = betelStoreSettings(brand).publicPageConfig;
    current.homeSections[0].bannerItems![0].id = "custom";
    expect(() => betelFashionBanners(current, images)).toThrow("cambiaron");
  });

  it("rechaza secciones duplicadas y URLs inseguras", () => {
    const current = betelStoreSettings(brand).publicPageConfig;
    expect(() => betelFashionBanners(current, { ...images, mobileBannerUrl: "http://example.invalid/photo.jpg" })).toThrow("HTTPS");
    current.homeSections.push(structuredClone(current.homeSections[0]));
    expect(() => betelFashionBanners(current, images)).toThrow("cambiaron");
  });
});
