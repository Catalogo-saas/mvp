import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/landing_saas"
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@landing.test" },
    update: {},
    create: {
      email: "demo@landing.test",
      name: "Demo Merchant",
      passwordHash
    }
  });

  const store = await prisma.store.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      ownerId: user.id,
      name: "Puro Demo",
      slug: "demo",
      description: "Catálogo de ejemplo para validar el MVP.",
      whatsappPhone: "541123456789",
      businessType: "FOOD",
      template: "market",
      heroTitle: "Pedidos simples por WhatsApp",
      heroSubtitle: "Elegí tus productos, armá el carrito y confirmá en segundos."
    }
  });

  const category = await prisma.category.upsert({
    where: { storeId_slug: { storeId: store.id, slug: "principales" } },
    update: {},
    create: {
      storeId: store.id,
      name: "Principales",
      slug: "principales"
    }
  });

  const product = await prisma.product.upsert({
    where: { storeId_slug: { storeId: store.id, slug: "hamburguesa-clasica" } },
    update: {},
    create: {
      storeId: store.id,
      categoryId: category.id,
      name: "Hamburguesa clásica",
      slug: "hamburguesa-clasica",
      description: "Pan brioche, medallón, cheddar y salsa de la casa.",
      basePrice: 6500,
      promoPrice: 5200,
      imageUrls: []
    }
  });

  const group = await prisma.optionGroup.create({
    data: {
      productId: product.id,
      name: "Extras",
      selectionType: "MULTIPLE",
      isRequired: false
    }
  });

  await prisma.productOption.createMany({
    data: [
      { optionGroupId: group.id, name: "Papas", priceDelta: 1800 },
      { optionGroupId: group.id, name: "Bacon", priceDelta: 1200 },
      { optionGroupId: group.id, name: "Extra cheddar", priceDelta: 900 }
    ],
    skipDuplicates: true
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
