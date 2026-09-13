import "../prisma.config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const email = (process.env.DEMO_TENANT_EMAIL || "demo-ecommerce@landing.test").trim().toLowerCase();
const password = process.env.DEMO_TENANT_PASSWORD || "";
const slug = (process.env.DEMO_TENANT_SLUG || "demo-ecommerce").trim().toLowerCase();

if (password.length < 8) {
  throw new Error("Configurá DEMO_TENANT_PASSWORD con al menos 8 caracteres.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const categoryDefinitions = [
  { name: "Calzado", slug: "calzado", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85" },
  { name: "Indumentaria", slug: "indumentaria", imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85" },
  { name: "Accesorios", slug: "accesorios", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85" }
] as const;

const productDefinitions = [
  {
    categorySlug: "calzado",
    name: "Runner One",
    slug: "runner-one",
    description: "Capellada respirable, suela flexible y una silueta preparada para todos los días.",
    basePrice: 90000,
    promoPrice: 72000,
    stockQuantity: 4,
    imageUrls: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=88"
    ],
    groups: [
      { name: "Talle", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["36", "37", "38", "39", "40"] },
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Rojo", "Negro", "Blanco"] }
    ]
  },
  {
    categorySlug: "calzado",
    name: "Terra Low",
    slug: "terra-low",
    description: "Cuero premium, base de goma natural y plantilla anatómica.",
    basePrice: 86500,
    promoPrice: null,
    stockQuantity: 14,
    imageUrls: [
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=88"
    ],
    groups: [
      { name: "Talle", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["36", "37", "38", "39", "40", "41"] },
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Arena", "Blanco"] }
    ]
  },
  {
    categorySlug: "indumentaria",
    name: "Camisa Lino",
    slug: "camisa-lino",
    description: "Lino lavado, corte relajado y botones de nácar.",
    basePrice: 49000,
    promoPrice: 41650,
    stockQuantity: 11,
    imageUrls: [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=88"
    ],
    groups: [
      { name: "Talle", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["XS", "S", "M", "L", "XL"] },
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Crudo", "Oliva", "Celeste"] }
    ]
  },
  {
    categorySlug: "indumentaria",
    name: "Remera Essential",
    slug: "remera-essential",
    description: "Algodón pesado, cuello reforzado y calce amplio.",
    basePrice: 32000,
    promoPrice: null,
    stockQuantity: null,
    imageUrls: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=88"],
    groups: [
      { name: "Talle", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["S", "M", "L", "XL"] },
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Blanco", "Negro", "Verde"] }
    ]
  },
  {
    categorySlug: "accesorios",
    name: "Bolso Studio",
    slug: "bolso-studio",
    description: "Lona encerada, bolsillo interior y correa regulable.",
    basePrice: 58900,
    promoPrice: null,
    stockQuantity: 8,
    imageUrls: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=88",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=88"
    ],
    groups: [
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Negro", "Suela"] }
    ]
  },
  {
    categorySlug: "accesorios",
    name: "Gorra Norte",
    slug: "gorra-norte",
    description: "Gabardina de algodón con ajuste metálico.",
    basePrice: 24000,
    promoPrice: 20400,
    stockQuantity: 20,
    imageUrls: ["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=88"],
    groups: [
      { name: "Color", selectionType: "SINGLE" as const, isRequired: true, maxSelections: 1, options: ["Negro", "Beige", "Verde"] }
    ]
  }
] as const;

async function main() {
  const existingUser = await prisma.user.findUnique({ where: { email }, include: { store: true } });
  const existingStore = await prisma.store.findUnique({ where: { slug }, include: { owner: true } });

  if (existingUser?.store && existingUser.store.slug !== slug) {
    throw new Error("El email del demo ya pertenece a otra tienda.");
  }
  if (existingStore && existingStore.owner.email !== email) {
    throw new Error("La URL del demo ya pertenece a otro tenant.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.upsert({
      where: { email },
      update: { name: "Norte Demo", passwordHash, role: "MERCHANT", status: "ACTIVE" },
      create: { email, name: "Norte Demo", passwordHash, role: "MERCHANT", status: "ACTIVE" }
    });

    const storeData = {
      ownerId: user.id,
      name: "NORTE",
      description: "Esenciales urbanos de líneas simples y materiales nobles.",
      whatsappPhone: "541112345678",
      businessType: "RETAIL" as const,
      template: "ecommerce",
      heroTitle: "Vestir el ahora.",
      heroSubtitle: "Una colección versátil para acompañarte todos los días. Elegí tus productos y confirmá por WhatsApp.",
      heroImageUrls: [
        "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1600&q=88",
        "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=88",
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=88"
      ],
      address: "Av. Córdoba 1850, CABA",
      theme: { primary: "#1e4f43", accent: "#e6ff54", font: "Inter" },
      showCategories: true,
      freeShippingEnabled: true,
      freeShippingThreshold: 80000,
      acceptTransferPayments: true,
      paymentAccountHolder: "Norte Tienda SRL",
      paymentProvider: "Mercado Pago",
      paymentAlias: "NORTE.TIENDA",
      paymentCbu: "0000003100012345678901",
      restrictBySchedule: false,
      businessHoursText: "Lunes a sábados de 10 a 20 h",
      mobileProductColumns: 2,
      isPublished: true
    };

    const store = await transaction.store.upsert({
      where: { slug },
      update: storeData,
      create: { ...storeData, slug }
    });

    const categoryIds = new Map<string, string>();
    for (const [index, category] of categoryDefinitions.entries()) {
      const record = await transaction.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: category.slug } },
        update: { name: category.name, imageUrl: category.imageUrl, sortOrder: index },
        create: { storeId: store.id, name: category.name, slug: category.slug, imageUrl: category.imageUrl, sortOrder: index }
      });
      categoryIds.set(category.slug, record.id);
    }

    for (const [index, definition] of productDefinitions.entries()) {
      const productData = {
        categoryId: categoryIds.get(definition.categorySlug),
        name: definition.name,
        description: definition.description,
        basePrice: definition.basePrice,
        promoPrice: definition.promoPrice,
        imageUrls: [...definition.imageUrls],
        isVisible: true,
        stockQuantity: definition.stockQuantity,
        sortOrder: index
      };
      const product = await transaction.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug: definition.slug } },
        update: productData,
        create: { ...productData, storeId: store.id, slug: definition.slug }
      });

      await transaction.optionGroup.deleteMany({ where: { productId: product.id } });
      for (const [groupIndex, group] of definition.groups.entries()) {
        await transaction.optionGroup.create({
          data: {
            productId: product.id,
            name: group.name,
            selectionType: group.selectionType,
            isRequired: group.isRequired,
            minSelections: group.isRequired ? 1 : 0,
            maxSelections: group.maxSelections,
            sortOrder: groupIndex,
            options: {
              create: group.options.map((name, optionIndex) => ({
                name,
                priceDelta: 0,
                isAvailable: true,
                sortOrder: optionIndex
              }))
            }
          }
        });
      }
    }

    return { user, store, productsCount: productDefinitions.length };
  });

  console.log("Tenant demo listo.");
  console.log("Email: " + result.user.email);
  console.log("Tienda: /" + result.store.slug);
  console.log("Productos: " + result.productsCount);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
