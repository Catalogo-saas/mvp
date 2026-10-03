import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { buildDemoCatalog, demoIdentities } from "../prisma/demo-data";
import { seedDemos } from "../prisma/demo-seed";
import { normalizeVariants } from "../lib/product-variants";
import { createTrackingToken, hashTrackingToken } from "../lib/order-tracking";

const url = process.env.DEMO_SEED_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/^\/landing_demo_seed_test(?:_|$)/.test(parsed.pathname)) throw new Error("La prueba destructiva de seed requiere una base local landing_demo_seed_test.");
}

describe.skipIf(!url)("reconstrucción aislada de las demos", () => {
  let prisma: PrismaClient;
  let otherOwnerId: string;
  let otherStoreId: string;
  const originalSecrets = { tracking: process.env.TRACKING_TOKEN_SECRET, quote: process.env.CHECKOUT_QUOTE_SECRET };
  beforeAll(async () => {
    process.env.TRACKING_TOKEN_SECRET = "demo-integration-tracking-secret-32-characters";
    process.env.CHECKOUT_QUOTE_SECRET = "demo-integration-quote-secret-32-characters";
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const owner = await prisma.user.create({ data: { email: `unrelated-${Date.now()}@example.invalid`, role: "MERCHANT", passwordHash: "unchanged" } });
    otherOwnerId = owner.id;
    const store = await prisma.store.create({ data: { ownerId: owner.id, name: "Tienda ajena", slug: `unrelated-${Date.now()}`, whatsappPhone: "00000000", description: "No modificar" } });
    otherStoreId = store.id;
    await prisma.product.create({ data: { storeId: store.id, name: "Producto ajeno", slug: "unrelated-product", basePrice: 10000, stockQuantity: 7 } });
    await seedDemos(prisma);
  }, 120000);
  afterAll(async () => {
    if (prisma) {
      await prisma.store.deleteMany({ where: { id: otherStoreId, ownerId: otherOwnerId } });
      await prisma.user.deleteMany({ where: { id: otherOwnerId, passwordHash: "unchanged" } });
      await prisma.$disconnect();
    }
    if (originalSecrets.tracking === undefined) delete process.env.TRACKING_TOKEN_SECRET; else process.env.TRACKING_TOKEN_SECRET = originalSecrets.tracking;
    if (originalSecrets.quote === undefined) delete process.env.CHECKOUT_QUOTE_SECRET; else process.env.CHECKOUT_QUOTE_SECRET = originalSecrets.quote;
  });

  it("crea catálogos, clientes, pedidos y reservas coherentes en ambos tenants", async () => {
    for (const demo of demoIdentities) {
      const store = await prisma.store.findUniqueOrThrow({ where: { slug: demo.slug }, include: { owner: true, products: { include: { assignedCategories: true, optionGroups: { include: { options: true }, orderBy: { sortOrder: "asc" } } } }, categories: true, customers: true, orders: { include: { items: true, events: true } }, storefrontEvents: true } });
      expect(store.products).toHaveLength(60);
      expect(store.customers).toHaveLength(10);
      expect(store.orders).toHaveLength(24);
      expect(store.storefrontEvents).toHaveLength(300);
      expect(await bcrypt.compare(demo.password, store.owner.passwordHash!)).toBe(true);
      expect(new Set(store.orders.map(o => o.source))).toEqual(new Set(["STOREFRONT", "BACKOFFICE"]));
      expect(Object.fromEntries(["PENDING_WHATSAPP", "PAID", "IN_PREPARATION", "DELIVERED", "CANCELLED"].map(status => [status, store.orders.filter(o => o.status === status).length]))).toEqual({ PENDING_WHATSAPP: 6, PAID: 4, IN_PREPARATION: 6, DELIVERED: 6, CANCELLED: 2 });
      for (const order of store.orders) {
        const checkout = order.checkout as Record<string, number | string | null>;
        expect(checkout.productSubtotal).toBe(order.items.reduce((sum, item) => sum + item.subtotal, 0));
        expect(order.total).toBe(Number(checkout.productSubtotal) - Number(checkout.discount) + Number(checkout.shipping));
        expect(order.trackingTokenHash).toBe(hashTrackingToken(createTrackingToken(order.id, store.id)));
        expect(order.events.length).toBeGreaterThan(0);
        if (order.status === "CANCELLED") expect(order.stockReserved).toBe(false);
      }
      const definitions = buildDemoCatalog(demo.kind).products;
      for (const product of store.products) {
        const initial = definitions.find(p => p.slug === product.slug)!;
        expect(product.assignedCategories.map(category => category.slug).sort()).toEqual([...initial.assignedSlugs].sort());
        expect(product.optionGroups.map(group => ({ name: group.name, options: group.options.sort((a, b) => a.sortOrder - b.sortOrder).map(option => option.name) }))).toEqual(initial.groups.map(group => ({ name: group.name, options: group.options.map(option => option.name) })));
        const items = store.orders.filter(o => o.stockReserved).flatMap(o => o.items).filter(item => item.productId === product.id);
        if (initial.variants.length) for (const variant of normalizeVariants(product.variants)) {
          const original = initial.variants.find(v => v.key === variant.key)!;
          expect(variant.stockQuantity).toBe(original.stockQuantity - items.filter(item => item.variantKey === variant.key).reduce((sum, item) => sum + item.quantity, 0));
        } else expect(product.stockQuantity).toBe(initial.stockQuantity === null ? null : initial.stockQuantity - items.reduce((sum, item) => sum + item.quantity, 0));
      }
    }
  });

  it("sobrescribe cambios y contraseñas sin duplicar ni tocar una tienda ajena", async () => {
    const first = await prisma.store.findUniqueOrThrow({ where: { slug: "demo" }, include: { owner: true, customers: true } });
    await prisma.store.update({ where: { id: first.id }, data: { name: "Cambio manual", designDraft: { test: true } } });
    await prisma.user.update({ where: { id: first.ownerId }, data: { passwordHash: "changed-password" } });
    await prisma.session.create({ data: { userId: first.ownerId, sessionToken: "demo-session-to-reset", expires: new Date(Date.now() + 86400000) } });
    await prisma.customerSession.create({ data: { customerId: first.customers[0].id, tokenHash: "demo-customer-session-to-reset", expiresAt: new Date(Date.now() + 86400000) } });
    await prisma.product.create({ data: { storeId: first.id, name: "Producto agregado manualmente", slug: "manual-demo-product", basePrice: 1000 } });
    await seedDemos(prisma);
    const second = await prisma.store.findUniqueOrThrow({ where: { slug: "demo" }, include: { owner: true, products: true } });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("NORTE");
    expect(second.designDraft).toBeNull();
    expect(second.owner.authVersion).toBe(first.owner.authVersion + 1);
    expect(await bcrypt.compare("Ropa1234", second.owner.passwordHash!)).toBe(true);
    expect(second.products).toHaveLength(60);
    expect(await prisma.session.count({ where: { userId: first.ownerId } })).toBe(0);
    expect(await prisma.customerSession.count({ where: { tokenHash: "demo-customer-session-to-reset" } })).toBe(0);
    const other = await prisma.store.findUniqueOrThrow({ where: { id: otherStoreId }, include: { owner: true, products: true } });
    expect(other.description).toBe("No modificar");
    expect(other.owner.passwordHash).toBe("unchanged");
    expect(other.products[0].stockQuantity).toBe(7);
  }, 120000);

  it("valida la segunda identidad antes de modificar la primera demo", async () => {
    const ropa = await prisma.store.findUniqueOrThrow({ where: { slug: "demo" } });
    const products = await prisma.store.findUniqueOrThrow({ where: { slug: "demo-productos" }, include: { owner: true } });
    await prisma.store.update({ where: { id: ropa.id }, data: { name: "Conservar ante conflicto" } });
    await prisma.user.update({ where: { id: products.ownerId }, data: { email: "conflicting-owner@example.invalid" } });
    try {
      await expect(seedDemos(prisma)).rejects.toThrow("otro comerciante");
      expect((await prisma.store.findUniqueOrThrow({ where: { id: ropa.id } })).name).toBe("Conservar ante conflicto");
      expect(await prisma.product.count({ where: { storeId: ropa.id } })).toBe(60);
    } finally {
      await prisma.user.update({ where: { id: products.ownerId }, data: { email: products.owner.email } });
      await prisma.store.update({ where: { id: ropa.id }, data: { name: "NORTE" } });
    }
  }, 120000);

  it("revierte ambas reconstrucciones si falla la inserción de la segunda tienda", async () => {
    const failing = prisma.$extends({ query: { product: { createMany({ args, query }) {
      const rows = Array.isArray(args.data) ? args.data : [args.data];
      if (rows.some(product => product.sku === "NEXO-010")) throw new Error("fallo simulado de inserción");
      return query(args);
    } } } });
    const before = await prisma.product.findFirstOrThrow({ where: { store: { slug: "demo" } } });
    await expect(seedDemos(failing as unknown as PrismaClient)).rejects.toThrow("fallo simulado");
    expect(await prisma.product.findUnique({ where: { id: before.id } })).not.toBeNull();
    for (const demo of demoIdentities) expect(await prisma.product.count({ where: { store: { slug: demo.slug } } })).toBe(60);
  }, 120000);

  it("revierte también el stock y los pedidos si falla la carga histórica de NEXO", async () => {
    const failing = prisma.$extends({ query: { order: { createMany({ args, query }) {
      const rows = Array.isArray(args.data) ? args.data : [args.data];
      if (rows.some(order => order.code.startsWith("DEMO-NEXO-"))) throw new Error("fallo simulado de pedidos");
      return query(args);
    } } } });
    const snapshot = () => prisma.store.findMany({ where: { slug: { in: demoIdentities.map(demo => demo.slug) } }, orderBy: { slug: "asc" }, select: {
      id: true, owner: { select: { authVersion: true, passwordHash: true } },
      products: { orderBy: { sortOrder: "asc" }, select: { id: true, stockQuantity: true, variants: true } },
      orders: { orderBy: { code: "asc" }, select: { id: true, total: true, trackingTokenHash: true } }
    } });
    const before = await snapshot();
    await expect(seedDemos(failing as unknown as PrismaClient)).rejects.toThrow("fallo simulado de pedidos");
    expect(await snapshot()).toEqual(before);
  }, 120000);

  it("mantiene acotados los viajes SQL para conexiones remotas", async () => {
    const measured = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }), log: [{ emit: "event", level: "query" }] });
    let queries = 0;
    measured.$on("query", () => queries++);
    try {
      await seedDemos(measured);
      // The original per-row/nested seed issued 1,764 SQL queries on this dataset.
      expect(queries).toBeGreaterThan(0);
      expect(queries).toBeLessThan(300);
    } finally { await measured.$disconnect(); }
  }, 120000);
});
