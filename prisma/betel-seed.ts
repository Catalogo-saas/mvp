import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "../lib/generated/prisma/client";
import { checkoutSettingsSchema } from "../lib/commerce-settings";
import { designConfigSchema } from "../lib/design-config";
import { createBannerItem, createHomeSection, publicPageConfigSchema } from "../lib/public-page-config";
import { normalizeArgentineWhatsAppPhone } from "../lib/store-settings";

export const betelIdentity = {
  name: "Betel",
  slug: "betel",
  email: "estefaniadaianagomez@gmail.com",
  whatsappPhone: normalizeArgentineWhatsAppPhone("+54 381 348-8267")
};

export const betelPalette = {
  background: "#F8EDE2",
  primary: "#8C4F37",
  accent: "#D5A095",
  text: "#4B2415"
};

const publicImageUrl = z.string().url().refine(value => new URL(value).protocol === "https:", "Las imágenes de Betel requieren URLs públicas HTTPS.");
export const betelBrandSchema = z.object({
  logoUrl: publicImageUrl,
  desktopBannerUrl: publicImageUrl,
  mobileBannerUrl: publicImageUrl
});
export type BetelBrand = z.infer<typeof betelBrandSchema>;

// Original vector backgrounds. Copy remains editable in the merchant editor.
export const betelBannerArtwork = {
  desktop: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><rect width="1600" height="600" fill="${betelPalette.background}"/><circle cx="1450" cy="420" r="270" fill="${betelPalette.accent}" fill-opacity=".16"/><circle cx="1450" cy="420" r="245" fill="none" stroke="${betelPalette.primary}" stroke-width="1.5"/><circle cx="1450" cy="420" r="237" fill="none" stroke="${betelPalette.primary}" stroke-width=".75"/></svg>`,
  mobile: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="${betelPalette.background}"/><circle cx="825" cy="525" r="185" fill="${betelPalette.accent}" fill-opacity=".16"/><circle cx="825" cy="525" r="164" fill="none" stroke="${betelPalette.primary}" stroke-width="1.5"/><circle cx="825" cy="525" r="156" fill="none" stroke="${betelPalette.primary}" stroke-width=".75"/></svg>`
};

export function betelStoreSettings(brand: BetelBrand) {
  const title = "Indumentaria & Hogar";
  const description = "Estilo para vos y tu hogar";
  const hero = {
    ...createHomeSection("banners", "betel-hero"),
    title,
    description,
    bannerHeight: "small" as const,
    bannerAutoplay: false,
    bannerItems: [
      { ...createBannerItem(brand.desktopBannerUrl, "betel-desktop"), title, description, link: "/productos", position: "middle-left" as const, desktop: true, mobile: false, textColor: betelPalette.text, backgroundColor: "#00000000" },
      { ...createBannerItem(brand.mobileBannerUrl, "betel-mobile"), title, description, link: "/productos", position: "middle-center" as const, desktop: false, mobile: true, textColor: betelPalette.text, backgroundColor: "#00000000" }
    ]
  };
  const contact = {
    ...createHomeSection("purchaseInfo", "betel-contact"),
    infoColors: { mode: "background" as const, background: betelPalette.background, text: betelPalette.text },
    infoItems: [{ icon: "whatsapp" as const, title: "Consultas por WhatsApp", text: "+54 381 348-8267" }]
  };
  const categories = { ...createHomeSection("featuredCategories", "betel-categories"), title: "Indumentaria y Hogar", enabled: false };
  const products = { ...createHomeSection("productGroup", "betel-products"), title: "Elegidos para vos" };

  return {
    name: betelIdentity.name,
    businessType: "RETAIL" as const,
    template: "dana",
    whatsappPhone: betelIdentity.whatsappPhone,
    logoUrl: brand.logoUrl,
    faviconUrl: brand.logoUrl,
    description: "Betel · Indumentaria & Hogar",
    heroTitle: title,
    heroSubtitle: description,
    heroImageUrls: [],
    theme: { primary: betelPalette.primary, accent: betelPalette.accent, useTemplateColors: false },
    designConfig: designConfigSchema.parse({
      font: "serif", iconStyle: "thin", headerSticky: true, logoSize: 96,
      productImageRatio: "portrait", productImageFit: "cover", cardRadius: 8,
      backgroundColor: betelPalette.background, textColor: betelPalette.text,
      primaryContrast: "#FFFFFF", secondaryContrast: betelPalette.text,
      headerColors: { mode: "background" }, announcementColors: { mode: "primary" }, footerColors: { mode: "secondary" },
      footerText: "Betel · Indumentaria & Hogar",
      footerOptions: { showMenu: true, showContact: true, showSocials: false, showPaymentMethods: false, showDeliveryMethods: false }
    }),
    mobileProductColumns: 2,
    showCategories: true,
    showFeatured: true,
    freeShippingEnabled: false,
    acceptCashPayments: false,
    acceptTransferPayments: false,
    whatsappOrdersEnabled: false,
    checkoutSettings: checkoutSettingsSchema.parse({ demoMode: false, paymentMethods: [], cashDiscountPercent: 0 }),
    deliveryMethods: [],
    menuConfig: {
      header: [{ label: "Inicio", href: "/" }, { label: "Productos", href: "/productos" }, { label: "Contacto", href: "/contacto" }],
      footer: [{ label: "Inicio", href: "/" }, { label: "Productos", href: "/productos" }, { label: "Contacto", href: "/contacto" }]
    },
    publicPageConfig: publicPageConfigSchema.parse({ homeSections: [hero, contact, categories, products] }),
    isPublished: true
  };
}

type SeedOptions = {
  password?: string;
  prepareBrand?: (storeId: string) => Promise<BetelBrand>;
};

export async function seedBetel(prisma: PrismaClient, options: SeedOptions = {}) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('landing-saas-betel-seed-v1'))::text`;
    const user = await tx.user.findFirst({ where: { email: { equals: betelIdentity.email, mode: "insensitive" } }, include: { store: true, membership: true } });
    const existing = await tx.store.findUnique({ where: { slug: betelIdentity.slug }, include: { owner: true } });
    if (user && (user.role !== "MERCHANT" || user.membership || user.store && user.store.slug !== betelIdentity.slug)) {
      throw new Error("El correo de Betel pertenece a otra tienda o tiene un rol incompatible.");
    }
    if (existing && (!user || existing.ownerId !== user.id || existing.owner.email.toLowerCase() !== betelIdentity.email)) {
      throw new Error("/betel pertenece a otro comerciante. No se modificó ningún tenant.");
    }
    if (existing) return { storeId: existing.id, slug: existing.slug, email: existing.owner.email, created: false, ownerCreated: false, isPublished: existing.isPublished };
    if (user?.status === "SUSPENDED") throw new Error("La cuenta de Betel está suspendida; no se modificó su estado.");
    if (!options.prepareBrand) throw new Error("Configurá BETEL_LOGO_PATH con el archivo original del logo de Betel.");
    const password = user ? undefined : z.string().min(8, "Configurá BETEL_OWNER_PASSWORD (8 a 120 caracteres).").max(120).parse(options.password ?? "");
    const owner = user ?? await tx.user.create({ data: {
      name: "Betel · Administración", email: betelIdentity.email,
      role: "MERCHANT", status: "ACTIVE", passwordHash: await bcrypt.hash(password!, 12)
    } });
    // The storefront becomes public only after its assets are validated and SQL commits.
    const store = await tx.store.create({ data: {
      ownerId: owner.id, name: betelIdentity.name, slug: betelIdentity.slug,
      whatsappPhone: betelIdentity.whatsappPhone, businessType: "RETAIL", template: "dana", isPublished: false
    } });
    const brand = betelBrandSchema.parse(await options.prepareBrand(store.id));
    await tx.category.createMany({ data: [
      { storeId: store.id, name: "Indumentaria", slug: "indumentaria", sortOrder: 0 },
      { storeId: store.id, name: "Hogar", slug: "hogar", sortOrder: 1 }
    ] });
    await tx.store.update({ where: { id: store.id }, data: betelStoreSettings(brand) });
    return { storeId: store.id, slug: store.slug, email: owner.email, created: true, ownerCreated: !user, isPublished: true };
  }, { maxWait: 10000, timeout: 60000 });
}
