import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";

// A separate tenant per test/project keeps all writes and cleanup isolated.
for (const path of [".env.development.local", ".env.local", ".env.development", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/landing_saas";
const localDatabase = ["localhost", "127.0.0.1", "::1"].includes(new URL(connectionString).hostname);
const localServer = ["localhost", "127.0.0.1", "::1"].includes(new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100").hostname);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

test("métodos repetidos: edición individual, checkout y conservación del pedido", async ({ page }, info) => {
  test.skip(!localDatabase || !localServer, "Este flujo crea datos aislados exclusivamente en la base y servidor locales.");
  test.setTimeout(120_000);
  const suffix = randomUUID().slice(0, 8);
  const slug = "qa-payments-" + suffix;
  const email = slug + "@test.local";
  const user = await prisma.user.create({ data: {
    name: "QA Pagos", email, passwordHash: await bcrypt.hash("qa-payments-password", 4),
    store: { create: {
      name: "QA Pagos", slug, whatsappPhone: "541112345678",
      acceptCashPayments: true, acceptTransferPayments: true, isPublished: true,
      paymentAlias: "cuenta.a", paymentAccountHolder: "Ana",
      checkoutSettings: { transferName: "Banco A", transferDiscountPercent: 5, transferInstructions: "Pagar en A", requestTransferReceipt: true },
      deliveryMethods: [{ id: "pickup", type: "pickup", enabled: true, price: 0, name: "Retiro QA", pickupDetails: "Calle 100 · 9 a 18" }],
      products: { create: { name: "Producto QA", slug: "producto-qa", basePrice: 10000, stockQuantity: null } }
    } }
  }, include: { store: { include: { products: true } } } });
  const store = user.store!;

  try {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Contraseña").fill("qa-payments-password");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/(panel|gestion)/);
    await page.goto("/gestion/configuracion/entregas");
    await page.screenshot({ path: info.outputPath("entregas.png"), fullPage: true });
    await page.goto("/gestion/configuracion/pagos");
    await expect(page.locator(".delivery-method-row")).toHaveCount(2);
    await expect(page.locator("form")).toHaveCount(0);
    await page.getByRole("button", { name: "Transferencia o depósito bancario", exact: true }).click();
    await page.waitForURL(/\/gestion\/configuracion\/pagos\/[^/]+$/);
    const methodId = page.url().split("/").at(-1)!;
    await expect(page.getByRole("checkbox", { name: "Ofrecer esta forma de pago" })).toBeChecked();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).checkoutSettings).toMatchObject({ paymentMethods: expect.arrayContaining([expect.objectContaining({ id: methodId, enabled: true, alias: "" })]) });
    await page.getByLabel("Nombre del método").fill("Banco B");
    await page.getByLabel("Titular", { exact: true }).fill("Bea");
    await page.getByLabel("Alias", { exact: true }).fill("cuenta.b");
    await page.getByLabel("Instrucciones para tu cliente").fill("Pagar en B");
    await page.getByLabel("Descuento (opcional)").fill("12");
    await page.getByRole("checkbox", { name: "Ofrecer esta forma de pago" }).check();
    await page.route("**/api/admin/commerce-settings", async route => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Error de guardado QA. Intentá nuevamente." }) });
    });
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByText("Error de guardado QA. Intentá nuevamente.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios", exact: true })).toBeEnabled();
    await page.unroute("**/api/admin/commerce-settings");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath("pago-edicion.png"), fullPage: true });
    await page.goto("/gestion/configuracion/pagos");
    await expect(page.locator(".delivery-method-row")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Transferencia o depósito bancario", exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath("pagos.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole("link", { name: /Banco A/ }).click();
    await expect(page.getByLabel("Alias", { exact: true })).toHaveValue("cuenta.a");
    await expect(page.getByLabel("Descuento (opcional)")).toHaveValue("5");
    await page.getByLabel("Nombre del método").fill("Cambios sin guardar");
    await page.locator('a[href="/gestion/configuracion/pagos"]').click();
    await expect(page.getByRole("dialog", { name: "Cambios sin guardar" })).toBeVisible();
    await page.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
    await page.waitForURL("**/gestion/configuracion/pagos");

    const quoteResponse = await page.request.post("/api/storefront/cart/quote", { data: { storeSlug: slug, paymentMethodId: "legacy-transfer", deliveryMethodId: "pickup", items: [{ lineId: randomUUID(), productId: store.products[0].id, quantity: 1, selectedOptionIds: [] }] } });
    expect(quoteResponse.status()).toBe(200);
    const { quoteToken } = await quoteResponse.json();
    const original = await page.request.post("/api/orders", { data: {
      quoteToken,
      storeSlug: slug, idempotencyKey: randomUUID(), customerName: "Cliente QA", customerEmail: "client@test.local",
      customerPhone: "1112345678", deliveryMethodId: "pickup", paymentMethodId: "legacy-transfer",
      items: [{ productId: store.products[0].id, quantity: 1 }]
    } });
    expect(original.status()).toBe(201);
    const originalResult = await original.json();
    const originalOrder = await prisma.order.findUniqueOrThrow({ where: { id: originalResult.orderId } });
    expect(originalOrder.total).toBe(9500);
    expect(originalOrder.checkout).toMatchObject({ paymentDetails: { alias: "cuenta.a" }, requestReceipt: true });

    await page.goto("/" + slug);
    await page.evaluate(({ slug, product }) => {
      localStorage.setItem("storefront-cart:" + slug, JSON.stringify([{
        lineId: crypto.randomUUID(), productId: product.id, productName: product.name, imageUrl: null,
        quantity: 1, selectedOptionIds: [], optionLabels: [], unitPrice: 10000
      }]));
    }, { slug, product: store.products[0] });
    await page.goto("/" + slug + "/compra");
    await page.getByLabel("Correo electrónico").fill("client@test.local");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Nombre y apellido").fill("Cliente QA");
    await page.getByLabel("Teléfono", { exact: true }).fill("1112345678");
    await page.getByRole("radio", { name: /Retiro QA/ }).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("radio", { name: /Banco A/ }).check();
    await expect(page.getByText("cuenta.a", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: /Banco B/ }).check();
    await expect(page.getByText("cuenta.b", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("checkout-pagos.png"), fullPage: true });
    const createdPromise = page.waitForResponse(response => response.url().endsWith("/api/orders") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirmar pedido" }).click();
    const created = await createdPromise;
    expect(created.status()).toBe(201);
    const submitted = created.request().postDataJSON();
    await page.waitForURL("**/compra/proceso/orden?hash=*");
    const order = await prisma.order.findUniqueOrThrow({ where: { storeId_clientRequestId: { storeId: store.id, clientRequestId: submitted.idempotencyKey } } });
    expect(order.total).toBe(8800);
    expect(order.checkout).toMatchObject({ paymentMethodId: methodId, paymentMethod: "transfer", paymentName: "Banco B", paymentInstructions: "Pagar en B", paymentDetails: { alias: "cuenta.b", accountHolder: "Bea" }, requestReceipt: false });

    await page.goto("/gestion/configuracion/pagos/" + methodId);
    await page.getByRole("button", { name: "Eliminar forma", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar forma", exact: true }).click();
    await page.waitForURL("**/gestion/configuracion/pagos");
    await expect(page.locator(".delivery-method-row")).toHaveCount(2);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).checkout).toEqual(order.checkout);
    expect((await page.request.get("/gestion/configuracion/pagos/" + methodId)).status()).toBe(404);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.afterAll(async () => { await prisma.$disconnect(); });
