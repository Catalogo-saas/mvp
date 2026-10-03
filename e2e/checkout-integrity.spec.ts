import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function activate(button: Locator, isMobile: boolean) {
  if (isMobile) await button.tap();
  else await button.click();
}

async function holdQuote(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const captured = new Promise<void>(resolve => { started = resolve; });
  const pending: Promise<void>[] = [];
  const handler = (route: import("@playwright/test").Route) => {
    const task = (async () => {
      started();
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    })();
    pending.push(task);
    return task;
  };
  await page.route("**/api/storefront/cart/quote", handler);
  return { captured, release, count: () => pending.length, dispose: async () => {
    await Promise.all(pending);
    await page.unroute("**/api/storefront/cart/quote", handler);
  } };
}

test.beforeEach(async () => { test.skip(!isLocal, "Fixtures exclusivos para base y servidor locales."); fixture = await createFixture(); });
test.afterEach(async () => { if (fixture) await prisma.user.deleteMany({ where: { id: fixture.ownerId } }); });
test.afterAll(async () => { await prisma.$disconnect(); });

test("un solo toque avanza cada paso durante la actualización por foco", async ({ page, isMobile }) => {
  await seedCart(page);
  await page.goto("/" + fixture.slug + "/compra");
  await page.getByLabel("Correo electrónico").fill("cliente@example.test");
  const next = page.getByRole("button", { name: "Continuar", exact: true });
  await expect(next).toBeEnabled();
  const emailQuote = await holdQuote(page);
  try {
    await page.getByLabel("Correo electrónico").focus();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await emailQuote.captured;
    await expect(page.getByRole("status").locator("svg")).toBeVisible();
    await expect(next).toBeEnabled();
    await activate(next, isMobile);
    await expect(page.getByRole("heading", { name: "Datos de contacto y entrega" })).toBeVisible();
    expect(emailQuote.count()).toBe(1);
  } finally { emailQuote.release(); await emailQuote.dispose(); }
  await expect(page.getByRole("status").locator("svg")).toHaveCount(0);
  await page.getByLabel("Nombre y apellido").fill("Cliente QA");
  await page.getByLabel("Teléfono", { exact: true }).fill("1112345678");
  await page.getByRole("radio", { name: /Retiro QA/ }).check();
  await expect(next).toBeEnabled();
  const deliveryQuote = await holdQuote(page);
  try {
    await page.getByLabel("Teléfono", { exact: true }).focus();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await deliveryQuote.captured;
    await expect(page.getByRole("status").locator("svg")).toBeVisible();
    await expect(next).toBeEnabled();
    await activate(next, isMobile);
    await expect(page.getByRole("heading", { name: "Medio de pago" })).toBeVisible();
    expect(deliveryQuote.count()).toBe(1);
  } finally { deliveryQuote.release(); await deliveryQuote.dispose(); }
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
});

test("cambiar la entrega bloquea el avance hasta verificar la selección nueva", async ({ page }) => {
  await seedCart(page);
  await page.goto("/" + fixture.slug + "/compra");
  await page.getByLabel("Correo electrónico").fill("cliente@example.test");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const quote = await holdQuote(page);
  try {
    await page.getByRole("radio", { name: /Retiro QA/ }).check();
    await quote.captured;
    await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
  } finally { quote.release(); await quote.dispose(); }
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeEnabled();
});

test("confirmar durante una actualización espera la misma consulta y crea una sola venta", async ({ page, isMobile }) => {
  await checkout(page);
  const quote = await holdQuote(page);
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await quote.captured;
    await expect(page.getByRole("status").locator("svg")).toBeVisible();
    await activate(page.getByRole("button", { name: "Confirmar pedido" }), isMobile);
    await expect(page.getByRole("button", { name: "Confirmando..." })).toBeDisabled();
    expect(quote.count()).toBe(1);
    expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
  } finally { quote.release(); await quote.dispose(); }
  await page.waitForURL("**/compra/proceso/orden?hash=*");
  expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(1);
});

for (const variant of ["completos", "solo alias", "solo CBU/CVU"] as const) {
  test(`transferencia visible con datos ${variant} y copia accesible`, async ({ page, isMobile }, info) => {
    const payment = { ...createPaymentMethod("transfer", "bank"), discountPercent: 12,
      alias: variant === "solo CBU/CVU" ? "" : "qa.alias.largo." + "a".repeat(100),
      cbu: variant === "solo alias" ? "" : "0000000000000000000001",
      accountHolder: variant === "completos" ? "Titular de la cuenta QA" : "",
      provider: variant === "completos" ? "Banco QA" : ""
    };
    await prisma.store.update({ where: { id: fixture.id }, data: { checkoutSettings: { paymentMethods: [payment] } } });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { sessionStorage.setItem("qa-copied", value); } } });
    });
    await checkout(page);
    const details = page.getByRole("region", { name: "Datos para transferir" });
    await expect(details).toBeVisible();
    const notes = page.getByLabel("Notas del pedido (opcional)");
    expect(await details.evaluate((element, textarea) => Boolean(element.compareDocumentPosition(textarea as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await notes.elementHandle())).toBe(true);
    for (const [name, value, feedback] of [["Copiar alias", payment.alias, "Alias copiado."], ["Copiar CBU/CVU", payment.cbu, "CBU/CVU copiado."]]) {
      const button = details.getByRole("button", { name, exact: true });
      if (!value) { await expect(button).toHaveCount(0); continue; }
      await expect(details.getByText(value, { exact: true })).toBeVisible();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await activate(button, isMobile);
      await expect(details.getByRole("status")).toHaveText(feedback);
      expect(await page.evaluate(() => sessionStorage.getItem("qa-copied"))).toBe(value);
      await expect(page.getByRole("heading", { name: "Medio de pago" })).toBeVisible();
    }
    await expect(details.getByText("Titular", { exact: true })).toHaveCount(variant === "completos" ? 1 : 0);
    await expect(details.getByText("Banco / proveedor", { exact: true })).toHaveCount(variant === "completos" ? 1 : 0);
    if (variant === "completos") {
      await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Clipboard unavailable"); } } }); });
      await activate(details.getByRole("button", { name: "Copiar alias", exact: true }), isMobile);
      await expect(details.getByRole("alert")).toHaveText(/No pudimos copiar alias/);
      for (const width of isMobile ? [320, 390, 768] : [1280]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
      await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 844 });
      await page.screenshot({ path: info.outputPath("transferencia.png"), fullPage: true });
    }
    expect(await prisma.order.count({ where: { storeId: fixture.id } })).toBe(0);
  });
}

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
