import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "../lib/generated/prisma/client";
import { createPaymentMethod } from "../lib/commerce-settings";

for (const path of [".env.development.local", ".env.local", ".env.development", ".env"]) if (existsSync(path)) process.loadEnvFile(path);
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/landing_saas";
const isLocal = ["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname) && ["localhost", "127.0.0.1"].includes(new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100").hostname);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
let fixture: Awaited<ReturnType<typeof createFixture>>;
async function createFixture() {
  const slug = "qa-checkout-" + randomUUID().slice(0, 8);
  return prisma.store.create({ data: {
    slug, name: "Checkout QA", whatsappPhone: "541112345678",
    owner: { create: { email: slug + "@example.test" } },
    checkoutSettings: { paymentMethods: [{ ...createPaymentMethod("transfer", "bank"), discountPercent: 12, alias: "qa.alias" }] },
    deliveryMethods: [{ id: "pickup", type: "pickup", enabled: true, price: 0, name: "Retiro QA", pickupDetails: "Local QA" }],
    products: { create: { name: "Producto QA", slug: "producto", basePrice: 10000, stockQuantity: 5 } }
  }, include: { products: true } });
}
async function seedCart(page: Page) {
  await page.goto("/" + fixture.slug + "/productos");
  await page.evaluate(({ slug, product }) => {
    localStorage.setItem("storefront-cart:" + slug, JSON.stringify([{ lineId: crypto.randomUUID(), productId: product.id, productName: product.name, quantity: 1, selectedOptionIds: [], optionLabels: [], imageUrl: null, unitPrice: product.basePrice }]));
  }, { slug: fixture.slug, product: fixture.products[0] });
}
async function checkout(page: Page) {
  await seedCart(page);
  await page.goto("/" + fixture.slug + "/compra");
  await page.getByLabel("Correo electrónico").fill("cliente@example.test");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Nombre y apellido").fill("Cliente QA");
  await page.getByLabel("Teléfono", { exact: true }).fill("1112345678");
  await page.getByRole("radio", { name: /Retiro QA/ }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
}

test.beforeEach(async () => { test.skip(!isLocal, "Fixtures exclusivos para base y servidor locales."); fixture = await createFixture(); });
test.afterEach(async () => { if (fixture) await prisma.user.deleteMany({ where: { id: fixture.ownerId } }); });
test.afterAll(async () => { await prisma.$disconnect(); });

test("la verificación usa un spinner en la cantidad, sin texto ni saltos de tamaño", async ({ page }, info) => {
  await seedCart(page);
  await page.reload();
  await page.getByRole("button", { name: /Abrir carrito/ }).click();
  const dialog = page.getByRole("dialog", { name: "Mi carrito" });
  const quantity = dialog.getByRole("group", { name: "Cantidad de Producto QA" });
  const status = quantity.getByRole("status");
  await expect(status).toHaveText("Cantidad: 1");
  const initialBounds = await quantity.boundingBox();
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/storefront/cart/quote", async route => {
    await wait;
    await route.continue();
  });
  try {
    await quantity.getByRole("button", { name: "Agregar una unidad de Producto QA" }).click();
    await expect(status.locator("svg")).toBeVisible();
    await expect(status).toHaveText("Verificando stock y precios de Producto QA.");
    await expect(dialog.locator("p").filter({ hasText: "Verificando stock y precios" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Realizar compra", exact: true })).toBeDisabled();
    const loadingBounds = await quantity.boundingBox();
    expect(loadingBounds?.width).toBeCloseTo(initialBounds!.width, 2);
    expect(loadingBounds?.height).toBeCloseTo(initialBounds!.height, 2);
    await page.screenshot({ path: info.outputPath("cantidad-verificando.png") });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(status.locator("svg")).toHaveCSS("animation-name", "none");
  } finally { release?.(); }
  await expect(status).toHaveText("Cantidad: 2");
  await expect(status.locator("svg")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Realizar compra", exact: true })).toBeEnabled();
});

test("cambio de importe: muestra el resumen y exige reconfirmación", async ({ page }, info) => {
  await checkout(page);
  await prisma.product.update({ where: { id: fixture.products[0].id }, data: { basePrice: 12000 } });
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByText("Cambió tu pedido. Revisá el resumen y volvé a confirmar.", { exact: true })).toBeVisible();
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
  await expect(page.locator("aside").getByText(/^\$\s*10\.560$/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("checkout-reconfirmacion.png"), fullPage: true });
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await page.waitForURL("**/compra/proceso/orden?hash=*");
  const orders = await prisma.order.findMany({ where: { storeId: fixture.id } });
  expect(orders).toHaveLength(1);
  expect(orders[0].total).toBe(10560);
});

test("stock agotado al recuperar foco bloquea y conserva los datos", async ({ page }) => {
  await checkout(page);
  await prisma.product.update({ where: { id: fixture.products[0].id }, data: { stockQuantity: 0 } });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/No hay suficiente stock/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeDisabled();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(page.getByLabel("Nombre y apellido")).toHaveValue("Cliente QA");
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
});

test("un choque de stock al confirmar permite corregir la línea sin perder el comprador", async ({ page }) => {
  await checkout(page);
  await page.evaluate(slug => {
    const key = "storefront-cart:" + slug;
    const cart = JSON.parse(localStorage.getItem(key) || "[]");
    cart[0].quantity = 3;
    localStorage.setItem(key, JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
  }, fixture.slug);
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
  await page.route("**/api/orders", async route => {
    await prisma.product.update({ where: { id: fixture.products[0].id }, data: { stockQuantity: 1 } });
    await route.continue();
  });
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByText(/No hay suficiente stock/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar cantidad disponible" })).toBeVisible();
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
  await page.unroute("**/api/orders");
  await page.getByRole("button", { name: "Usar cantidad disponible" }).click();
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await page.waitForURL("**/compra/proceso/orden?hash=*");
  const orders = await prisma.order.findMany({ where: { storeId: fixture.id }, include: { items: true } });
  expect(orders).toHaveLength(1);
  expect(orders[0].customerName).toBe("Cliente QA");
  expect(orders[0].items[0].quantity).toBe(1);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: fixture.products[0].id } })).stockQuantity).toBe(0);
});

test("sin conexión impide avanzar y permite verificar nuevamente", async ({ page }) => {
  await seedCart(page);
  await page.route("**/api/storefront/cart/quote", route => route.abort("internetdisconnected"));
  await page.goto("/" + fixture.slug + "/compra");
  await expect(page.getByRole("button", { name: "Reintentar verificación" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
  await page.unroute("**/api/storefront/cart/quote");
  await page.getByRole("button", { name: "Reintentar verificación" }).click();
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeEnabled();
});

test("una respuesta perdida se recupera al recargar sin crear otra venta", async ({ page }) => {
  await checkout(page);
  await page.route("**/api/orders", async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort("connectionreset");
  });
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByRole("button", { name: "Reintentar confirmación" })).toBeVisible();
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(1);
  await page.unroute("**/api/orders");
  await page.reload();
  await page.waitForURL("**/compra/proceso/orden?hash=*");
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(1);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: fixture.products[0].id } })).stockQuantity).toBe(4);
});

test("una cotización atrasada no restaura una línea eliminada en otra pestaña", async ({ page }) => {
  await checkout(page);
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let started: (() => void) | undefined;
  const captured = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/storefront/cart/quote", async route => {
    const response = await route.fetch();
    started?.();
    await wait;
    await route.fulfill({ response });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await captured;
  await page.evaluate(slug => { localStorage.setItem("storefront-cart:" + slug, "[]"); window.dispatchEvent(new Event("storage")); }, fixture.slug);
  release?.();
  await expect(page.getByText("Tu carrito está vacío.", { exact: true })).toBeVisible();
  expect(await page.evaluate(slug => JSON.parse(localStorage.getItem("storefront-cart:" + slug) || "[]"), fixture.slug)).toEqual([]);
});
