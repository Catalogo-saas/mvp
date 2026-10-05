import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../lib/generated/prisma/client";
import { betelIdentity, betelPalette, betelStoreSettings, seedBetel } from "../prisma/betel-seed";
import { normalizePaymentMethods, strictDeliveryMethods } from "../lib/commerce-settings";
import { getStoreThemeColors } from "../lib/catalog";

const brand = {
  logoUrl: "https://example.invalid/betel-logo.jpeg",
  desktopBannerUrl: "https://example.invalid/betel-desktop.svg",
  mobileBannerUrl: "https://example.invalid/betel-mobile.svg"
};

function fixture(user: unknown = null, store: unknown = null) {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn().mockResolvedValue(user), create: vi.fn() },
    store: { findUnique: vi.fn().mockResolvedValue(store), create: vi.fn(), update: vi.fn() },
    category: { createMany: vi.fn() }
  };
  const client = { $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) } as unknown as PrismaClient;
  const prepareBrand = vi.fn().mockResolvedValue(brand);
  return { tx, client, prepareBrand };
}

describe("aislamiento de Betel", () => {
  it("rechaza una URL que pertenece a otro comercio antes de escribir o subir imágenes", async () => {
    const { client, tx, prepareBrand } = fixture(null, { ownerId: "other", owner: { email: "other@example.invalid" } });
    await expect(seedBetel(client, { prepareBrand })).rejects.toThrow("otro comerciante");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.store.create).not.toHaveBeenCalled();
    expect(prepareBrand).not.toHaveBeenCalled();
  });

  it.each([
    { role: "SUPER_ADMIN", membership: null, store: null },
    { role: "MERCHANT", membership: { storeId: "other" }, store: null },
    { role: "MERCHANT", membership: null, store: { slug: "other" } }
  ])("rechaza una cuenta incompatible: %j", async user => {
    const { client, tx, prepareBrand } = fixture(user);
    await expect(seedBetel(client, { prepareBrand })).rejects.toThrow("rol incompatible");
    expect(tx.store.create).not.toHaveBeenCalled();
    expect(prepareBrand).not.toHaveBeenCalled();
  });

  it("no crea una tienda para una cuenta suspendida", async () => {
    const { client, tx } = fixture({ role: "MERCHANT", status: "SUSPENDED", membership: null, store: null });
    await expect(seedBetel(client)).rejects.toThrow("suspendida");
    expect(tx.store.create).not.toHaveBeenCalled();
  });

  it("permite verificar una tienda existente sin contraseña o logo y sin sobrescribir datos", async () => {
    const user = { id: "owner", email: betelIdentity.email, role: "MERCHANT", membership: null, store: { slug: "betel" } };
    const store = { id: "store", ownerId: user.id, slug: "betel", isPublished: false, owner: user };
    const { client, tx, prepareBrand } = fixture(user, store);
    await expect(seedBetel(client, { prepareBrand })).resolves.toMatchObject({ created: false, storeId: "store", isPublished: false });
    expect(prepareBrand).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.store.create).not.toHaveBeenCalled();
    expect(tx.store.update).not.toHaveBeenCalled();
    expect(tx.category.createMany).not.toHaveBeenCalled();
  });

  it("exige una contraseña inicial antes de crear la cuenta", async () => {
    const { client, tx, prepareBrand } = fixture();
    await expect(seedBetel(client, { prepareBrand })).rejects.toThrow("BETEL_OWNER_PASSWORD");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(prepareBrand).not.toHaveBeenCalled();
  });
});

describe("configuración pública real de Betel", () => {
  it("usa la identidad del comercio y sus colores propios sobre Dana", () => {
    const settings = betelStoreSettings(brand);
    expect(settings.template).toBe("dana");
    expect(settings.logoUrl).toBe(brand.logoUrl);
    expect(getStoreThemeColors(settings.template, settings.theme)).toMatchObject({ primary: betelPalette.primary, accent: betelPalette.accent, useTemplateColors: false });
    expect(settings.designConfig.backgroundColor).toBe(betelPalette.background);
    expect(settings.designConfig.secondaryContrast).toBe(betelPalette.text);
    expect(settings.whatsappPhone).toBe("543813488267");
  });

  it("no ofrece pagos, entregas, descuentos ni avisos de demostración", () => {
    const settings = betelStoreSettings(brand);
    expect(normalizePaymentMethods(settings)).toEqual([]);
    expect(strictDeliveryMethods(settings.deliveryMethods).parse(settings.deliveryMethods)).toEqual([]);
    expect(settings.checkoutSettings.demoMode).toBe(false);
    expect(settings.freeShippingEnabled).toBe(false);
    expect(settings.whatsappOrdersEnabled).toBe(false);
    expect(settings.publicPageConfig.announcement.enabled).toBe(false);
    expect(settings.publicPageConfig.socials).toEqual({ instagram: "", tiktok: "", facebook: "" });
    expect(settings.publicPageConfig.homeSections.find(section => section.type === "featuredCategories")?.enabled).toBe(false);
  });

  it("mantiene textos editables y un banner para cada dispositivo", () => {
    const banners = betelStoreSettings(brand).publicPageConfig.homeSections[0].bannerItems!;
    expect(banners).toHaveLength(2);
    expect(banners.filter(banner => banner.desktop)).toHaveLength(1);
    expect(banners.filter(banner => banner.mobile)).toHaveLength(1);
    for (const banner of banners) {
      expect(banner.title).toBe("Indumentaria & Hogar");
      expect(banner.description).toBe("Estilo para vos y tu hogar");
      expect(banner.link).toBe("/productos");
      expect(banner.backgroundColor).toBe("#00000000");
    }
  });
});
