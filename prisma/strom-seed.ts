import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { PrismaClient, Prisma } from "../lib/generated/prisma/client";
import catalog from "./strom-catalog.json";
import brand from "./strom-brand.json";
import { replaceStromImageReferences } from "./strom-images";
import { createBannerItem, createHomeSection, normalizePublicPageConfig, publicPageConfigSchema } from "../lib/public-page-config";
import { checkoutSettingsSchema, deliveryMethodSchema, paymentMethodSchema } from "../lib/commerce-settings";
import { designConfigSchema, normalizeDesignConfig } from "../lib/design-config";
import { variantKeyFromNames } from "../lib/product-variants";

export const stromIdentity = { slug: "strom", email: "strom-demo@landing.test" };
export const stromTemplate = "vene" as const;
export const stromTheme = { primary: "#151515", accent: "#ffdf00", useTemplateColors: false };
export const stromCategories = [
  ["proteinas", "Proteínas", 1], ["creatinas", "Creatinas", 7],
  ["preentrenos", "Preentrenos", 11], ["bienestar", "Bienestar", 15],
  ["accesorios", "Accesorios", 19], ["indumentaria", "Indumentaria", 23]
] as const;

export function stromHome(categoryIds: Map<string, string>, productIds: Map<string, string>) {
  const title = "Tu próximo nivel empieza acá.";
  const description = "Suplementos, accesorios y todo lo que necesitás para acompañar tu entrenamiento.";
  const bannerItems = [
    { ...createBannerItem(brand.desktopBannerUrl, "strom-desktop"), title, description, link: "/productos", position: "middle-left" as const, desktop: true, mobile: false, textColor: "#151515", backgroundColor: "#00000000" },
    { ...createBannerItem(brand.mobileBannerUrl, "strom-mobile"), title, description, link: "/productos", position: "bottom-left" as const, desktop: false, mobile: true, textColor: "#151515", backgroundColor: "#00000000" }
  ];
  const hero = { ...createHomeSection("banners", "strom-hero"), title, description, bannerItems, bannerHeight: "large" as const, bannerAutoplay: false };
  const info = { ...createHomeSection("purchaseInfo", "strom-info"), infoColors: { mode: "secondary" as const, background: "#ffdf00", text: "#151515" }, infoItems: [
    { icon: "store" as const, title: "Bolívar 403", text: "San Miguel de Tucumán. Retiro de demostración." },
    { icon: "card" as const, title: "Probá cómo comprar", text: "Efectivo y transferencia ficticios. No realices pagos." },
    { icon: "truck" as const, title: "Envíos · Demo", text: "Simulá tu entrega. Costos y condiciones ilustrativos." },
    { icon: "whatsapp" as const, title: "Consultas mayoristas", text: "Consultá a Strom por WhatsApp: +54 9 381 200-7698." }
  ] };
  const categories = { ...createHomeSection("featuredCategories", "strom-categories"), title: "Encontrá lo tuyo", categoryLayout: "three-even" as const, categoryIds: stromCategories.map(([slug]) => categoryIds.get(slug)!), categoryTiles: stromCategories.map(([slug, name, image]) => ({ id: `strom-${slug}`, categoryId: categoryIds.get(slug)!, title: name, imageUrl: catalog[image - 1].image })) };
  const featured = { ...createHomeSection("productGroup", "strom-featured"), title: "Para darlo todo.", description: "Una selección para acompañar cada entrenamiento.", productIds: catalog.filter(p => p.featured).map(p => productIds.get(p.slug)!) };
  const more = { ...createHomeSection("productGroup", "strom-more"), title: "Más allá del entrenamiento.", description: "Bienestar, accesorios e indumentaria para tu día a día.", productIds: catalog.filter(p => ["bienestar", "accesorios", "indumentaria"].includes(p.category)).slice(0, 8).map(p => productIds.get(p.slug)!) };
  return publicPageConfigSchema.parse({ homeSections: [hero, info, categories, featured, more], announcement: { enabled: true, text: "Propuesta de tienda online · Precios, promociones y stock de demostración" }, socials: { instagram: "https://www.instagram.com/strom.suplementos/" } });
}

// One-time conversion of the retired custom template, not a new runtime variant.
export function stromExistingTemplateDesign(store: { publicPageConfig: unknown; designConfig: unknown; heroTitle: string | null; heroSubtitle: string | null }, defaults: ReturnType<typeof stromHome>) {
  const page = normalizePublicPageConfig(store.publicPageConfig);
  const heroDefaults = defaults.homeSections.find(section => section.id === "strom-hero")!;
  const homeSections = page.homeSections.map(section => section.type === "banners" && section.id === "strom-hero" && section.bannerItems === undefined && !section.images.length ? {
    ...section, bannerHeight: "large" as const, bannerItems: heroDefaults.bannerItems!.map(item => ({ ...item, title: section.title || store.heroTitle || item.title, description: section.description || store.heroSubtitle || item.description }))
  } : section);
  if (!homeSections.some(section => section.type === "purchaseInfo")) homeSections.splice(1, 0, defaults.homeSections.find(section => section.id === "strom-info")!);
  const designConfig = normalizeDesignConfig(store.designConfig);
  return { template: stromTemplate, theme: stromTheme, heroImageUrls: [], designConfig: { ...designConfig, primaryContrast: "#ffffff", secondaryContrast: "#151515", announcementColors: { ...designConfig.announcementColors, mode: "primary" as const }, footerColors: { ...designConfig.footerColors, mode: "primary" as const } }, publicPageConfig: publicPageConfigSchema.parse({ ...page, homeSections }) };
}

export function stromCommerce() {
  return {
    checkoutSettings: checkoutSettingsSchema.parse({ demoMode: true, cashDiscountPercent: 0, paymentMethods: [
      paymentMethodSchema.parse({ id: "strom-cash", type: "cash", enabled: true, name: "Efectivo · Demo", description: "Simulá el pago al retirar. No requiere un pago real.", instructions: "Pedido de demostración. No realices pagos ni retiros reales." }),
      paymentMethodSchema.parse({ id: "strom-transfer", type: "transfer", enabled: true, name: "Transferencia · Demo", description: "Probá el circuito de transferencia sin realizar un pago.", instructions: "Datos ficticios de demostración. No realices transferencias.", accountHolder: "CUENTA DE DEMOSTRACIÓN", provider: "Banco de demostración", alias: "DEMO.NO.TRANSFERIR" })
    ] }),
    deliveryMethods: [
      deliveryMethodSchema.parse({ id: "strom-pickup", type: "pickup", name: "Retiro en Bolívar 403 · Demo", price: 0, enabled: true, description: "Ejemplo de retiro sin costo. No coordina un retiro real.", pickupDetails: "Bolívar 403, San Miguel de Tucumán. Retiro ilustrativo; horario a confirmar con el comercio." }),
      deliveryMethodSchema.parse({ id: "strom-shipping", type: "custom", name: "Envío a domicilio · Demo", price: 4500, enabled: true, description: "Costo ilustrativo para probar el checkout.", coverage: "Argentina" })
    ]
  };
}

export async function seedStrom(prisma: PrismaClient) {
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('landing-saas-strom-seed-v1'))::text`;
    const user = await tx.user.findUnique({ where: { email: stromIdentity.email }, include: { store: true, membership: true } });
    const existing = await tx.store.findUnique({ where: { slug: stromIdentity.slug }, include: { owner: true } });
    if (user && (user.role !== "MERCHANT" || user.membership || user.store && user.store.slug !== stromIdentity.slug)) throw new Error("La cuenta demo pertenece a otra tienda o tiene un rol incompatible.");
    if (existing && existing.owner.email !== stromIdentity.email) throw new Error("/strom pertenece a otro comerciante. No se modificó ningún tenant.");
    const owner = user ?? await tx.user.create({ data: { email: stromIdentity.email, name: "Strom · Administrador demo", role: "MERCHANT", status: "ACTIVE", passwordHash } });
    const commerce = stromCommerce();
    const store = await tx.store.upsert({ where: { slug: stromIdentity.slug }, update: {}, create: {
      ownerId: owner.id, name: "Strom", slug: stromIdentity.slug, businessType: "RETAIL", template: stromTemplate, whatsappPhone: "5493812007698",
      logoUrl: brand.logoUrl, faviconUrl: brand.logoUrl, isPublished: true,
      description: "Suplementos deportivos, accesorios e indumentaria. Propuesta de tienda online para Strom.",
      heroTitle: "Tu próximo nivel empieza acá.", heroSubtitle: "Suplementos, accesorios y todo lo que necesitás para acompañar tu entrenamiento.", heroImageUrls: [],
      theme: stromTheme,
      designConfig: designConfigSchema.parse({ font: "template", productImageRatio: "square", productImageFit: "contain", cardRadius: 12, quickBuyEnabled: true, floatingCartEnabled: true, logoSize: 64, primaryContrast: "#ffffff", secondaryContrast: "#151515", backgroundColor: "#fcfbf7", textColor: "#151515", headerColors: { mode: "background" }, announcementColors: { mode: "primary" }, footerColors: { mode: "primary" }, footerText: "Propuesta de demostración para Strom. Precios, promociones, stock y condiciones comerciales ilustrativos." }),
      address: "Bolívar 403, San Miguel de Tucumán", businessHoursText: null, mobileProductColumns: 2,
      acceptCashPayments: true, acceptTransferPayments: true, whatsappOrdersEnabled: false, ...commerce,
      paymentAccountHolder: "CUENTA DE DEMOSTRACIÓN", paymentProvider: "Banco de demostración", paymentAlias: "DEMO.NO.TRANSFERIR",
      menuConfig: { header: [{ label: "Inicio", href: "/" }, { label: "Productos", href: "/productos" }, { label: "Contacto", href: "/contacto" }], footer: [{ label: "Catálogo", href: "/productos" }, { label: "Contacto", href: "/contacto" }] }
    } });
    const categoryIds = new Map<string, string>();
    for (const [sortOrder, [slug, name, image]] of stromCategories.entries()) {
      const category = await tx.category.upsert({ where: { storeId_slug: { storeId: store.id, slug } }, update: {}, create: { storeId: store.id, slug, name, sortOrder, imageUrl: catalog[image - 1].image } });
      categoryIds.set(slug, category.id);
    }
    const productIds = new Map<string, string>();
    for (const [sortOrder, product] of catalog.entries()) {
      const saved = await tx.product.upsert({ where: { storeId_slug: { storeId: store.id, slug: product.slug } }, update: {}, create: {
        storeId: store.id, slug: product.slug, name: product.name, categoryId: categoryIds.get(product.category),
        basePrice: product.price, promoPrice: product.promoPrice, imageUrls: [product.image], stockQuantity: product.options.length > 1 ? null : sortOrder === 23 ? 0 : 25,
        variants: product.options.length > 1 ? product.options.map(name => ({ key: variantKeyFromNames([{ groupName: product.optionName, optionName: name }]), stockQuantity: sortOrder === 23 ? 0 : 25, basePrice: null, promoPrice: null, imageUrl: null, isVisible: true })) : [],
        isFeatured: product.featured, sortOrder, sku: `STROM-${String(sortOrder + 1).padStart(3, "0")}`,
        description: `${product.name}. ${product.stromVerified ? "Producto identificado en publicaciones de Strom." : "Producto real incluido como selección ilustrativa; disponibilidad en Strom a confirmar."}\n\nPrecio y stock de demostración. Las opciones son una muestra de las publicadas por el fabricante.`,
        ...(product.options.length > 1 ? { optionGroups: { create: { name: product.optionName, isRequired: true, minSelections: 1, maxSelections: 1, selectionType: "SINGLE", options: { create: product.options.map((name, sortOrder) => ({ name, sortOrder })) } } } } : {})
      } });
      productIds.set(product.slug, saved.id);
    }
    // Migrate only legacy local image references. Preserve all other edits.
    const storeImages = { logoUrl: store.logoUrl, faviconUrl: store.faviconUrl, heroImageUrls: store.heroImageUrls, designConfig: store.designConfig, publicPageConfig: store.publicPageConfig, ...(store.designDraft !== null ? { designDraft: store.designDraft } : {}) };
    const migratedStoreImages = replaceStromImageReferences(storeImages);
    if (JSON.stringify(storeImages) !== JSON.stringify(migratedStoreImages)) {
      await tx.store.update({ where: { id: store.id }, data: migratedStoreImages as Prisma.StoreUpdateInput });
    }
    const [savedCategories, savedProducts] = await Promise.all([
      tx.category.findMany({ where: { storeId: store.id }, select: { id: true, imageUrl: true } }),
      tx.product.findMany({ where: { storeId: store.id }, select: { id: true, imageUrls: true, variants: true } })
    ]);
    for (const category of savedCategories) {
      const imageUrl = replaceStromImageReferences(category.imageUrl);
      if (imageUrl !== category.imageUrl) await tx.category.update({ where: { id: category.id }, data: { imageUrl } });
    }
    for (const product of savedProducts) {
      const images = { imageUrls: product.imageUrls, variants: product.variants };
      const migrated = replaceStromImageReferences(images);
      if (JSON.stringify(images) !== JSON.stringify(migrated)) {
        await tx.product.update({ where: { id: product.id }, data: migrated as Prisma.ProductUpdateInput });
      }
    }
    // Existing editorial changes, inventory, orders and credentials remain intact.
    const home = stromHome(categoryIds, productIds);
    if (!existing) await tx.store.update({ where: { id: store.id }, data: { publicPageConfig: home } });
    else if (store.template === "strom") {
      const visual = stromExistingTemplateDesign({ ...store, ...migratedStoreImages }, home);
      const draft = store.designDraft && typeof store.designDraft === "object" && !Array.isArray(store.designDraft) ? store.designDraft as Record<string, unknown> : null;
      const designDraft = draft?.template === "strom" ? { ...draft, ...stromExistingTemplateDesign({ ...store, ...draft } as typeof store, home) } : undefined;
      await tx.store.update({ where: { id: store.id }, data: { ...visual, ...(designDraft ? { designDraft: designDraft as Prisma.InputJsonValue } : {}) } });
    }
    return { storeId: store.id, slug: store.slug, email: owner.email, password: user ? null : password, created: !existing, products: await tx.product.count({ where: { storeId: store.id } }) };
  }, { maxWait: 30000, timeout: 180000 });
}
