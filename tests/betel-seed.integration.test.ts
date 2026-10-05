import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { betelIdentity, seedBetel } from "../prisma/betel-seed";

const url = process.env.BETEL_SEED_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/^\/betel_seed_test(?:_|$)/.test(parsed.pathname)) {
    throw new Error("La prueba de Betel requiere una base local betel_seed_test o betel_seed_test_*.");
  }
}

const password = "Only-a-test-password!";
const brand = { logoUrl: "https://example.invalid/logo.jpeg", desktopBannerUrl: "https://example.invalid/desktop.svg", mobileBannerUrl: "https://example.invalid/mobile.svg" };

describe.skipIf(!url)("alta transaccional de Betel", () => {
  let prisma: PrismaClient;
  let otherOwnerId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    if (await prisma.user.findFirst({ where: { email: betelIdentity.email } }) || await prisma.store.findUnique({ where: { slug: betelIdentity.slug } })) {
      throw new Error("La base de pruebas debe estar vacía de identidades Betel antes de comenzar.");
    }
    const owner = await prisma.user.create({ data: { email: `betel-unrelated-${Date.now()}@example.invalid`, passwordHash: "unchanged" } });
    otherOwnerId = owner.id;
    await prisma.store.create({ data: { ownerId: owner.id, name: "Otra tienda", slug: "betel-unrelated", whatsappPhone: "541100000000", description: "Conservar" } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("revierte cuenta y tienda si fallan las imágenes públicas", async () => {
    await expect(seedBetel(prisma, { password, prepareBrand: async () => { throw new Error("No se pudo publicar el logo"); } })).rejects.toThrow("publicar el logo");
    expect(await prisma.user.count({ where: { email: betelIdentity.email } })).toBe(0);
    expect(await prisma.store.count({ where: { slug: betelIdentity.slug } })).toBe(0);
  });

  it("revierte también el alta si falla la carga de categorías", async () => {
    const failing = prisma.$extends({ query: { category: { createMany() { throw new Error("Fallo simulado de categorías"); } } } });
    await expect(seedBetel(failing as unknown as PrismaClient, { password, prepareBrand: async () => brand })).rejects.toThrow("simulado");
    expect(await prisma.user.count({ where: { email: betelIdentity.email } })).toBe(0);
    expect(await prisma.store.count({ where: { slug: betelIdentity.slug } })).toBe(0);
  });

  it("crea una tienda real publicada con contraseña hasheada y catálogo vacío", async () => {
    const result = await seedBetel(prisma, { password, prepareBrand: async () => brand });
    expect(result.created).toBe(true);
    const store = await prisma.store.findUniqueOrThrow({ where: { slug: "betel" }, include: { owner: true, categories: { orderBy: { sortOrder: "asc" } }, _count: { select: { products: true, orders: true, customers: true } } } });
    expect(store.isPublished).toBe(true);
    expect(store.owner.status).toBe("ACTIVE");
    expect(store.owner.role).toBe("MERCHANT");
    expect(store.owner.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, store.owner.passwordHash!)).toBe(true);
    expect(store.categories.map(category => category.name)).toEqual(["Indumentaria", "Hogar"]);
    expect(store._count).toEqual({ products: 0, orders: 0, customers: 0 });
  });

  it("conserva cambios, contraseña y catálogo al repetir y no modifica otros tenants", async () => {
    const store = await prisma.store.findUniqueOrThrow({ where: { slug: "betel" }, include: { owner: true } });
    await prisma.store.update({ where: { id: store.id }, data: { description: "Cambio posterior del comercio", isPublished: false } });
    await prisma.product.create({ data: { storeId: store.id, name: "Producto real agregado después", slug: "producto-real", basePrice: 10000, stockQuantity: 3 } });
    const result = await seedBetel(prisma);
    expect(result.created).toBe(false);
    const current = await prisma.store.findUniqueOrThrow({ where: { id: store.id }, include: { owner: true, products: true, categories: true } });
    expect(current.description).toBe("Cambio posterior del comercio");
    expect(current.isPublished).toBe(false);
    expect(current.owner.passwordHash).toBe(store.owner.passwordHash);
    expect(current.products[0].stockQuantity).toBe(3);
    expect(current.categories).toHaveLength(2);
    const other = await prisma.user.findUniqueOrThrow({ where: { id: otherOwnerId }, include: { store: true } });
    expect(other.passwordHash).toBe("unchanged");
    expect(other.store?.description).toBe("Conservar");
  });
});
