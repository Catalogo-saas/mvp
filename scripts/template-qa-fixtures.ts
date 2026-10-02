// Isolated, disposable local stores for visual QA. Never updates merchant data.
import { prisma } from "../lib/prisma";
import { defaultDesignConfig } from "../lib/design-config";
import { defaultPublicPageConfig } from "../lib/public-page-config";
import { defaultCheckoutSettings, defaultDeliveryMethods, defaultMenuConfig } from "../lib/commerce-settings";
const prefix = "qa_template_reference_";
const db = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/landing_saas");
if (!["localhost", "127.0.0.1"].includes(db.hostname)) throw Error("Solo se permite una base local.");
const photos = ["photo-1434389677669-e08b4cac3105", "photo-1521572163474-6864f9cf17ab", "photo-1549298916-b41d501d3772", "photo-1553062407-98eeb64c6a62"];
const photo = (id: string, width = 700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
for (const template of ["roma", "dana", "vene"] as const) {
  const id = prefix + template;
  if (process.argv[2] === "cleanup") {
    const store = await prisma.store.findUnique({ where: { id } });
    if (store && store.ownerId !== id) throw Error("La tienda no pertenece a estos fixtures.");
    await prisma.store.deleteMany({ where: { id, ownerId: id } });
    await prisma.user.deleteMany({ where: { id, email: id + "@example.invalid" } });
    continue;
  }
  await prisma.user.upsert({ where: { id }, update: {}, create: { id, name: "Prueba visual local", email: id + "@example.invalid", passwordHash: "disabled-fixture-login", role: "MERCHANT", status: "ACTIVE" } });
  const homeSections = structuredClone(defaultPublicPageConfig.homeSections);
  homeSections[0].images = [photo("photo-1445205170230-053b83016050",1600)];
  homeSections[3].title = template === "vene" ? "Los más vendidos" : "Nueva temporada";
  homeSections[3].layout = template === "vene" ? "grid" : "carousel";
  await prisma.store.upsert({ where: { id }, update: {}, create: {
    id, ownerId: id, slug: "qa-template-" + template, name: template.toUpperCase(), whatsappPhone: "541100000000", businessType: "RETAIL", template,
    isPublished: true, designConfig: defaultDesignConfig, theme: { useTemplateColors: true }, mobileProductColumns: 2,
    heroTitle: template === "vene" ? "Movete a tu manera" : "Nueva colección",
    heroSubtitle: "Diseños que te acompañan todos los días.", heroImageUrls: [photo("photo-1445205170230-053b83016050", 1600)],
    publicPageConfig: { ...defaultPublicPageConfig, homeSections, announcement: { enabled: true, text: "TIENDA DE PRUEBA · Envíos a todo el país" } },
    menuConfig: defaultMenuConfig, checkoutSettings: { ...defaultCheckoutSettings, transferDiscountPercent: 10 }, deliveryMethods: defaultDeliveryMethods,
    acceptCashPayments: true, acceptTransferPayments: true, whatsappOrdersEnabled: false, showCategories: true, showFeatured: true
  } });
  for (let i = 0; i < 3; i++) await prisma.category.upsert({ where: { id: id + "_cat_" + i }, update: {}, create: { id: id + "_cat_" + i, storeId: id, name: ["Indumentaria", "Calzado", "Accesorios"][i], slug: "categoria-" + i, imageUrl: photo(photos[i]), sortOrder: i } });
  for (let i = 0; i < 16; i++) await prisma.product.upsert({ where: { id: id + "_product_" + i }, update: {}, create: { id: id + "_product_" + i, storeId: id, name: ["Sweater esencial", "Remera de algodón", "Zapatillas urbanas", "Mochila everyday"][i % 4] + (i >= 4 ? " · Edición natural" : ""), slug: "producto-" + i, basePrice: 25000 + i * 1500, promoPrice: i === 0 ? 20000 : null, stockQuantity: i === 7 ? 0 : 12, isFeatured: true, isVisible: true, categoryId: id + "_cat_" + (i % 3), imageUrls: [photo(photos[i % 4])], sortOrder: i } });
}
console.log(process.argv[2] === "cleanup" ? "Eliminadas exclusivamente las 3 tiendas y cuentas temporales de QA." : "Tiendas locales: /qa-template-roma, /qa-template-dana, /qa-template-vene");
await prisma.$disconnect();
