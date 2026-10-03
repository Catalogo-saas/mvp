import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type Store } from "../lib/generated/prisma/client";
import { buildCheckoutQuote } from "../lib/checkout-quote";
import { paymentMethodSnapshot } from "../lib/commerce-settings";
import { normalizeVariants } from "../lib/product-variants";
import { nextOrderState } from "../lib/order-state";
import { createTrackingToken, hashTrackingToken } from "../lib/order-tracking";
import { buildDemoCatalog, demoCommerce, demoCustomerNames, demoDesign, demoHome, demoIdentities, demoMenu, demoPhoto, type DemoKind } from "./demo-data";

const day = 86_400_000;
const minute = 60_000;
type SeedProduct = Prisma.ProductGetPayload<{ include: { optionGroups: { include: { options: true } } } }>;
type SeedIdentity = typeof demoIdentities[number];

export function validateDemoEnvironment() {
  createTrackingToken("demo-preflight", "demo-preflight");
  const secret = process.env.CHECKOUT_QUOTE_SECRET || process.env.TRACKING_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 24) throw new Error("Configurá un secreto de checkout de al menos 24 caracteres antes de reconstruir las demos.");
  for (const demo of demoIdentities) {
    const catalog = buildDemoCatalog(demo.kind);
    if (catalog.products.length !== 60 || new Set(catalog.products.map(p => p.slug)).size !== 60) throw new Error(`Catálogo inválido: ${demo.slug}`);
    demoHome(demo.kind, new Map(catalog.categories.map(c => [c.slug, `category-${c.slug}`])), new Map(catalog.products.map(p => [p.slug, `product-${p.slug}`])));
    demoCommerce(demo.kind);
    demoDesign(demo.kind);
    demoMenu();
  }
}

async function assertDemoOwnership(tx: Prisma.TransactionClient, demo: SeedIdentity) {
  const user = await tx.user.findUnique({ where: { email: demo.email }, include: { store: true, membership: true } });
  const store = await tx.store.findUnique({ where: { slug: demo.slug }, include: { owner: true } });
  if (user && (user.role !== "MERCHANT" || user.membership || user.store && user.store.slug !== demo.slug)) throw new Error(`No se puede reconstruir /${demo.slug}: ${demo.email} pertenece a otra tienda o tiene un rol incompatible.`);
  if (store && store.owner.email !== demo.email) throw new Error(`No se puede reconstruir /${demo.slug}: la URL pertenece a otro comerciante.`);
  return { user, store };
}

function storeDefinition(demo: SeedIdentity) {
  const clothing = demo.kind === "clothing";
  const commerce = demoCommerce(demo.kind);
  return {
    name: demo.name, slug: demo.slug,
    description: clothing ? "Prendas de mujer y hombre con líneas simples, texturas y comodidad. Tienda de demostración." : "Objetos para habitar mejor. Decoración, cocina, organización, iluminación y tecnología. Tienda de demostración.",
    businessType: "RETAIL" as const, template: demo.template,
    whatsappPhone: clothing ? "541100000001" : "541100000002",
    theme: { primary: clothing ? "#176877" : "#ee7947", accent: clothing ? "#f5c4d4" : "#191919", useTemplateColors: true },
    designConfig: demoDesign(demo.kind), menuConfig: demoMenu(),
    checkoutSettings: commerce.checkoutSettings, deliveryMethods: commerce.deliveryMethods,
    address: commerce.address, heroTitle: clothing ? "Vestir el ahora." : "Tu espacio, a tu manera.",
    heroSubtitle: clothing ? "Prendas para acompañarte. Descubrí la colección de mujer y hombre." : "Diseño para tu hogar. Tecnología para tu día a día.",
    heroImageUrls: [demoPhoto(clothing ? "photo-1445205170230-053b83016050" : "photo-1600210492486-724fe5c67fb0")],
    acceptCashPayments: true, acceptTransferPayments: true, whatsappOrdersEnabled: false,
    paymentAccountHolder: "CUENTA FICTICIA DE DEMOSTRACIÓN", paymentProvider: "Banco de demostración", paymentAlias: "DEMO.NO.TRANSFERIR", paymentCbu: null,
    freeShippingEnabled: true, freeShippingThreshold: commerce.freeAbove,
    businessHoursText: "Lunes a viernes de 10 a 19 h · Sábados de 10 a 14 h · Horarios de demostración",
    businessHours: { timezone: "America/Argentina/Buenos_Aires", days: {
      monday: [{ open: "10:00", close: "19:00" }], tuesday: [{ open: "10:00", close: "19:00" }], wednesday: [{ open: "10:00", close: "19:00" }],
      thursday: [{ open: "10:00", close: "19:00" }], friday: [{ open: "10:00", close: "19:00" }], saturday: [{ open: "10:00", close: "14:00" }], sunday: []
    } },
    restrictBySchedule: false, showCategories: true, showFeatured: true, mobileProductColumns: 2,
    taxRatePercent: 21, showPricesWithoutTax: !clothing, isPublished: true
  };
}

function orderState(index: number) {
  if (index < 6) return nextOrderState({ paymentStatus: "PENDING", fulfillmentStatus: "PENDING" }, {});
  if (index < 10) return nextOrderState({ paymentStatus: "PENDING", fulfillmentStatus: "PENDING" }, { status: "PAID" });
  if (index < 16) return nextOrderState({ paymentStatus: "CONFIRMED", fulfillmentStatus: "PENDING" }, { fulfillmentStatus: index < 13 ? "PACKED" : "SHIPPED" });
  if (index < 22) return nextOrderState({ paymentStatus: "CONFIRMED", fulfillmentStatus: "PENDING" }, { fulfillmentStatus: "DELIVERED" });
  return nextOrderState({ paymentStatus: "PENDING", fulfillmentStatus: "PENDING" }, { status: "CANCELLED" });
}

async function seedManagement(tx: Prisma.TransactionClient, store: Store, kind: DemoKind, products: SeedProduct[], passwordHash: string, now: Date) {
  const customers = demoCustomerNames.map((name, index) => ({
    storeId: store.id, name, email: `cliente${index + 1}@${kind === "clothing" ? "norte" : "nexo"}.example.invalid`,
    passwordHash, emailVerifiedAt: new Date(now.getTime() - 29 * day), createdAt: new Date(now.getTime() - 29 * day)
  }));
  await tx.customer.createMany({ data: customers });
  const commerce = demoCommerce(kind);
  const productIds: string[] = [];
  const orders: Prisma.OrderCreateManyInput[] = [];
  const orderItems: Prisma.OrderItemCreateManyInput[] = [];
  const orderEvents: Prisma.OrderEventCreateManyInput[] = [];
  // These products were just created inside this transaction and are not visible to
  // concurrent checkouts. Accumulate reservations, then persist stock in one batch.
  const inventory = new Map(products.map(product => [product.id, {
    id: product.id, name: product.name, stockQuantity: product.stockQuantity, variants: normalizeVariants(product.variants)
  }]));
  const reservedProductIds = new Set<string>();
  for (let index = 0; index < 24; index++) {
    const customer = customers[index % customers.length];
    const customerPhone = `54110000${String(index % customers.length + 1).padStart(4, "0")}`;
    const payment = commerce.checkoutSettings.paymentMethods![index % 3];
    const delivery = commerce.deliveryMethods[index % 2];
    // Avoid the low-stock examples; historical purchases use healthy inventory.
    const selections = [products[index % 20], products[30 + index % 20]].map((product, line) => ({
      productId: product.id, quantity: line === 0 && index % 4 === 0 ? 2 : 1,
      selectedOptionIds: product.optionGroups.map(group => group.options[0].id)
    }));
    const { quote, rebuilt } = await buildCheckoutQuote(tx, store, selections, { paymentMethodId: payment.id, deliveryMethodId: delivery.id });
    if (!quote.complete) throw new Error(`Pedido demo inválido en /${store.slug}: ${quote.issues.join("; ")}`);
    const state = orderState(index);
    const source = index % 4 === 0 ? "BACKOFFICE" as const : "STOREFRONT" as const;
    const stockReserved = state.status !== "CANCELLED" && (source === "STOREFRONT" || state.status !== "PENDING_WHATSAPP");
    if (stockReserved) for (const item of rebuilt.items) {
      const product = inventory.get(item.productId)!;
      const stock = item.variantKey ? product.variants.find(variant => variant.key === item.variantKey) : product;
      if (!stock) throw new Error(`Variante demo inválida: ${item.productName}`);
      if (stock.stockQuantity !== null) {
        if (stock.stockQuantity < item.quantity) throw new Error(`Stock demo insuficiente: ${item.productName}`);
        stock.stockQuantity -= item.quantity;
        reservedProductIds.add(product.id);
      }
    }
    const createdAt = new Date(now.getTime() - (23 - index) * day - 60 * minute);
    const events = [{ type: "CREATED", label: "Pedido de demostración creado", createdAt }];
    if (state.paymentStatus === "CONFIRMED") events.push({ type: "PAYMENT_CONFIRMED", label: "Pago confirmado", createdAt: new Date(createdAt.getTime() + 5 * minute) });
    if (["PACKED", "SHIPPED", "DELIVERED"].includes(state.fulfillmentStatus)) events.push({ type: "FULFILLMENT_PACKED", label: "Pedido preparado", createdAt: new Date(createdAt.getTime() + 10 * minute) });
    if (["SHIPPED", "DELIVERED"].includes(state.fulfillmentStatus)) events.push({ type: "FULFILLMENT_SHIPPED", label: "Pedido enviado", createdAt: new Date(createdAt.getTime() + 15 * minute) });
    if (state.fulfillmentStatus === "DELIVERED") events.push({ type: "FULFILLMENT_DELIVERED", label: "Pedido entregado", createdAt: new Date(createdAt.getTime() + 20 * minute) });
    if (state.status === "CANCELLED") events.push({ type: "CANCELLED", label: "Pedido cancelado sin reserva de stock", createdAt: new Date(createdAt.getTime() + 5 * minute) });
    const orderId = randomUUID();
    orders.push({
      id: orderId, storeId: store.id, code: `DEMO-${store.name}-${String(index + 1).padStart(3, "0")}`, ...state, source, stockReserved,
      trackingTokenHash: hashTrackingToken(createTrackingToken(orderId, store.id)),
      customerName: customer.name, customerEmail: customer.email, customerPhone, fulfillment: delivery.name,
      notes: "Pedido ficticio para explorar la gestión. No requiere pago ni entrega real.",
      readAt: index < 3 ? null : new Date(createdAt.getTime() + minute), archivedAt: index === 23 ? new Date(now.getTime() - minute) : null,
      createdAt, updatedAt: events.at(-1)!.createdAt, total: quote.totals.total,
      checkout: {
        demo: true, stockMode: "variant-exclusive", customerName: customer.name, customerEmail: customer.email, customerPhone,
        dni: null, country: "Argentina", billingAddress: null,
        deliveryAddress: delivery.type === "custom" ? "Dirección ficticia 123" : null,
        province: delivery.type === "custom" ? "Ciudad Autónoma de Buenos Aires" : null,
        city: delivery.type === "custom" ? "CABA" : null, postalCode: delivery.type === "custom" ? "1414" : null,
        deliveryMethodId: delivery.id, deliveryName: delivery.name, deliveryDescription: delivery.description,
        pickupDetails: delivery.type === "pickup" ? delivery.pickupDetails : null,
        ...quote.totals, ...paymentMethodSnapshot(payment)
      }
    });
    orderItems.push(...rebuilt.items.map(item => ({ ...item, orderId, options: item.options as Prisma.InputJsonValue })));
    orderEvents.push(...events.map(event => ({ ...event, orderId })));
    productIds.push(...rebuilt.items.map(item => item.productId));
  }
  const stockRows = [...reservedProductIds].map(id => {
    const product = inventory.get(id)!;
    return Prisma.sql`(${product.id}, ${product.stockQuantity}::integer, ${JSON.stringify(product.variants)}::jsonb)`;
  });
  if (stockRows.length) await tx.$executeRaw(Prisma.sql`
    UPDATE "Product" AS product
    SET "stockQuantity" = inventory.stock, "variants" = inventory.variants, "updatedAt" = ${now}
    FROM (VALUES ${Prisma.join(stockRows)}) AS inventory(id, stock, variants)
    WHERE product."id" = inventory.id AND product."storeId" = ${store.id}
  `);
  await tx.order.createMany({ data: orders });
  await tx.orderItem.createMany({ data: orderItems });
  await tx.orderEvent.createMany({ data: orderEvents });
  // 100 synthetic sessions with increasingly selective funnel steps, never a WhatsApp handoff.
  const types = ["STOREFRONT_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_STARTED"];
  const data = Array.from({ length: 100 }, (_, index) => {
    const sessionId = `demo-${store.slug}-session-${String(index).padStart(3, "0")}`;
    const date = new Date(now.getTime() - (index % 30) * day - 30 * minute);
    const count = index < 25 ? 4 : index < 75 ? 3 : 2;
    return types.slice(0, count).map((type, step) => ({ storeId: store.id, type, sessionId,
      productId: type === "STOREFRONT_VIEW" ? null : productIds[index % productIds.length], createdAt: new Date(date.getTime() + step * minute) }));
  }).flat();
  await tx.storefrontEvent.createMany({ data });
}

export async function seedDemos(prisma: PrismaClient, now = new Date()) {
  validateDemoEnvironment();
  const passwordHashes = await Promise.all(demoIdentities.map(demo => bcrypt.hash(demo.password, 12)));
  return prisma.$transaction(async tx => {
    // Serialize simultaneous runs; resolve and validate BOTH targets before any deletion.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('landing-saas-demo-seed-v1'))::text`;
    const targets = [];
    for (const demo of demoIdentities) targets.push(await assertDemoOwnership(tx, demo));
    const summaries = [];
    for (const [demoIndex, demo] of demoIdentities.entries()) {
      const target = targets[demoIndex];
      const passwordHash = passwordHashes[demoIndex];
      // Cascade deletes only this verified demo's catalog, customers, sessions, orders and events.
      if (target.store) await tx.store.delete({ where: { id: target.store.id } });
      const owner = await tx.user.upsert({ where: { email: demo.email },
        create: { email: demo.email, name: `${demo.name} · Administrador demo`, passwordHash, role: "MERCHANT", status: "ACTIVE" },
        update: { name: `${demo.name} · Administrador demo`, passwordHash, status: "ACTIVE", authVersion: { increment: 1 } }
      });
      await tx.session.deleteMany({ where: { userId: owner.id } });
      const store = await tx.store.create({ data: { ...storeDefinition(demo), ...(target.store ? { id: target.store.id } : {}), ownerId: owner.id } });
      const catalog = buildDemoCatalog(demo.kind);
      const categoryIds = new Map(catalog.categories.map(category => [category.slug, randomUUID()]));
      await tx.category.createMany({ data: catalog.categories.map((category, sortOrder) => {
        const parentId = category.parentSlug ? categoryIds.get(category.parentSlug) : null;
        if (category.parentSlug && !parentId) throw new Error(`Falta categoría padre: ${category.parentSlug}`);
        return { id: categoryIds.get(category.slug)!, storeId: store.id, name: category.name, slug: category.slug, imageUrl: category.imageUrl, parentId, sortOrder };
      }) });
      const optionGroups: Prisma.OptionGroupCreateManyInput[] = [];
      const options: Prisma.ProductOptionCreateManyInput[] = [];
      const assignments: Prisma.Sql[] = [];
      const productData = catalog.products.map(definition => {
        const { categorySlug, assignedSlugs, groups, ...product } = definition;
        const id = randomUUID();
        for (const [sortOrder, group] of groups.entries()) {
          const groupId = randomUUID();
          optionGroups.push({ id: groupId, productId: id, name: group.name, selectionType: group.selectionType, isRequired: true, minSelections: 1, maxSelections: 1, sortOrder });
          options.push(...group.options.map((option, sortOrder) => ({ id: randomUUID(), optionGroupId: groupId, name: option.name, priceDelta: 0, isAvailable: true, sortOrder })));
        }
        for (const slug of assignedSlugs) {
          const categoryId = categoryIds.get(slug);
          if (!categoryId) throw new Error(`Falta categoría asignada: ${slug}`);
          assignments.push(Prisma.sql`(${categoryId}, ${id})`);
        }
        return { ...product, id, storeId: store.id, categoryId: categoryIds.get(categorySlug)! };
      });
      await tx.product.createMany({ data: productData });
      if (optionGroups.length) await tx.optionGroup.createMany({ data: optionGroups });
      if (options.length) await tx.productOption.createMany({ data: options });
      // Implicit m:n table defined in 20260923000000_mobile_commerce_foundation.
      await tx.$executeRaw(Prisma.sql`INSERT INTO "_ProductAssignments" ("A", "B") VALUES ${Prisma.join(assignments)}`);
      const products = await tx.product.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" }, include: { optionGroups: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } });
      await tx.store.update({ where: { id: store.id }, data: { publicPageConfig: demoHome(demo.kind, categoryIds, new Map(products.map(p => [p.slug, p.id]))) } });
      await seedManagement(tx, store, demo.kind, products, passwordHash, now);
      summaries.push({ name: demo.name, slug: demo.slug, email: demo.email, products: products.length, categories: categoryIds.size, customers: 10, orders: 24, events: 300 });
    }
    return summaries;
  // Bulk writes keep round trips short; allow additional headroom for remote DBs.
  }, { timeout: 600000, maxWait: 30000 });
}
