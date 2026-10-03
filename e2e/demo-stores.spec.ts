import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { buildDemoCatalog, demoIdentities } from "../prisma/demo-data";
import { createTrackingToken, trackingPath } from "../lib/order-tracking";

const database = process.env.DEMO_SEED_TEST_DATABASE_URL;
if (process.env.DEMO_QA === "1") {
  const url = new URL(database || "postgresql://localhost/missing");
  const server = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/landing_demo_seed_test(?:_|$)/.test(url.pathname) || !["localhost", "127.0.0.1"].includes(server.hostname)) throw new Error("DEMO_QA requiere servidor y base de pruebas aislados en localhost.");
}
test.skip(process.env.DEMO_QA !== "1", "Requiere las dos demos en una base de QA aislada.");
test.setTimeout(90000);

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function imagesLoaded(page: Page) {
  // Material images must load; scrolling each product into view triggers lazy loading.
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const demo of demoIdentities) {
  const catalog = buildDemoCatalog(demo.kind);
  test(`${demo.name}: portada, fotos y catálogo completo`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${demo.slug}`, { waitUntil: "networkidle" });
    await expect(page.locator(`[data-template="${demo.template}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { name: demo.kind === "clothing" ? "Vestir el ahora." : "Tu espacio, a tu manera.", exact: true })).toBeVisible();
    await imagesLoaded(page);
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });
    await page.goto(`/${demo.slug}/productos`, { waitUntil: "networkidle" });
    const products = page.locator("#catalogo article");
    await expect(products).toHaveCount(12);
    for (let count = 24; count <= 60; count += 12) {
      await page.getByRole("button", { name: "Ver más productos" }).click();
      await expect(products).toHaveCount(count);
    }
    await expect(page.getByRole("button", { name: "Ver más productos" })).toHaveCount(0);
    await imagesLoaded(page);
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("catalog.png"), fullPage: true });
    await page.goto(`/${demo.slug}/productos?categoria=${catalog.rootSlugs[0]}`, { waitUntil: "networkidle" });
    await expect(products).toHaveCount(demo.kind === "clothing" ? 12 : 10);
    await page.goto(`/${demo.slug}/productos?categoria=${catalog.products[0].categorySlug}`, { waitUntil: "networkidle" });
    await expect(products).toHaveCount(5);
    await page.goto(`/${demo.slug}/productos?categoria=promos`, { waitUntil: "networkidle" });
    await expect(products).toHaveCount(12);
    await noOverflow(page);
  });

  test(`${demo.name}: variantes, carrito, entrega y descuento`, async ({ page }, info) => {
    const product = catalog.products[0];
    await page.goto(`/${demo.slug}/producto/${product.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();
    await imagesLoaded(page);
    await page.getByRole("button", { name: "Ver foto 2" }).click();
    await expect(page.getByRole("button", { name: "Ver foto 2" })).toHaveAttribute("aria-pressed", "true");
    for (const fieldset of await page.locator("fieldset").all()) await fieldset.getByRole("radio").first().check();
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("product.png"), fullPage: true });
    await page.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
    const cart = page.getByRole("dialog", { name: "Mi carrito" });
    await expect(cart.getByText(product.name, { exact: true })).toBeVisible();
    await cart.getByRole("button", { name: "Realizar compra" }).click();
    await expect(page).toHaveURL(`/${demo.slug}/compra`);
    await page.getByLabel("Correo electrónico").fill("comprador@example.invalid");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Nombre y apellido").fill("Comprador de demostración");
    await page.getByLabel("Teléfono", { exact: true }).fill("1100000000");
    await page.getByRole("radio", { name: /Envío a domicilio/ }).check();
    await expect(page.getByLabel("Dirección de entrega")).toBeVisible();
    await page.getByRole("radio", { name: /Retiro en showroom/ }).check();
    await expect(page.getByLabel("Dirección de entrega")).toHaveCount(0);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("radio", { name: /Transferencia · 10%/ }).check();
    await expect(page.getByText("Descuento (10%)", { exact: true })).toBeVisible();
    await expect(page.getByText("DEMO.NO.TRANSFERIR", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("checkout.png"), fullPage: true });
    // Never submit a purchase or send notifications from visual QA.
  });

  test(`${demo.name}: gestión y seguimiento de un pedido ficticio`, async ({ page }, info) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(demo.email);
    await page.getByPlaceholder("Contraseña").fill(demo.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/gestion/);
    await expect(page.getByText(`Así está tu negocio, ${demo.name}.`, { exact: true })).toBeVisible();
    await page.goto("/gestion/productos");
    await expect(page.getByText(catalog.products[0].name, { exact: true }).first()).toBeVisible();
    await page.goto("/gestion/pedidos");
    await expect(page.getByText(`#DEMO-${demo.name}-021`, { exact: true }).filter({ visible: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("orders.png"), fullPage: true });
    await page.goto("/gestion/clientes");
    await expect(page.getByText("Lucía Fernández", { exact: true }).first()).toBeVisible();
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database! }) });
    try {
      const order = await prisma.order.findFirstOrThrow({ where: { store: { slug: demo.slug }, status: "DELIVERED" } });
      await page.goto(trackingPath(demo.slug, createTrackingToken(order.id, order.storeId)));
      await expect(page.getByText(new RegExp(order.code)).first()).toBeVisible();
      await noOverflow(page);
    } finally { await prisma.$disconnect(); }
  });
}

test("landing: acceso a ambas demos", async ({ page }) => {
  await page.goto("/");
  for (const demo of [{ label: "Demo de ropa", slug: "demo" }, { label: "Demo de productos", slug: "demo-productos" }]) {
    await expect(page.getByRole("link", { name: demo.label, exact: true }).first()).toHaveAttribute("href", `/${demo.slug}`);
  }
  await noOverflow(page);
});
