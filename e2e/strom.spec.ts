import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.describe("Strom", () => {
  test.skip(!process.env.STROM_QA, "Run against the seeded Strom demo with STROM_QA=1");
  test("portada, categorías, búsqueda y compra demo", async ({ page, isMobile }, testInfo) => {
    test.setTimeout(120000);
    await page.goto("/strom");
    await expect(page.getByRole("heading", { name: "Tu próximo nivel empieza acá." })).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => { image.loading = "eager"; return image.decode().catch(() => undefined); })); });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await mkdir(".impeccable/review", { recursive: true });
    await page.screenshot({ path: `.impeccable/review/strom-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole("link", { name: "Ver creatinas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creatinas", exact: true })).toBeVisible();
    await expect(page.getByText("4 productos", { exact: true })).toBeVisible();
    await page.goto("/strom/productos?q=omega");
    await expect(page.getByText("1 producto", { exact: true })).toBeVisible();
    await page.goto("/strom/productos?q=sin-resultados-strom");
    await expect(page.getByText("No encontramos productos. Probá otra búsqueda o categoría.")).toBeVisible();
    await page.goto("/strom/producto/ena-truemade-whey-protein");
    await expect(page.getByRole("heading", { name: "ENA Truemade Whey Protein", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByText(/Elegí Presentación/)).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("dialog", { name: "Mi carrito" })).toBeVisible();
    await page.getByRole("button", { name: "Realizar compra", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
    await page.reload();
    await page.getByLabel("Correo electrónico", { exact: true }).fill("presentacion-strom@example.invalid");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Nombre y apellido", { exact: true }).fill("Cliente de demostración");
    await page.getByLabel("Teléfono", { exact: true }).fill("3810000000");
    await page.getByRole("radio", { name: /Retiro en Bolívar/ }).check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("radio", { name: /Transferencia · Demo/ }).check();
    await expect(page.getByText("DEMO.NO.TRANSFERIR", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar pedido", exact: true })).toBeEnabled();
    if (isMobile) {
      const total = await page.getByText("Total", { exact: true }).filter({ visible: true }).boundingBox();
      const confirm = await page.getByRole("button", { name: "Confirmar pedido", exact: true }).boundingBox();
      expect(total!.y).toBeLessThan(confirm!.y);
    }
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/strom-checkout-${testInfo.project.name}.png`, fullPage: true });
    // A single intentional demo order exercises the real backend. Mobile checks
    // the same checkout without creating another reservation.
    if (!isMobile) {
      const response = page.waitForResponse(response => response.url().endsWith("/api/orders") && response.request().method() === "POST", { timeout: 30000 });
      await page.getByRole("button", { name: "Confirmar pedido", exact: true }).click();
      expect((await response).ok()).toBe(true);
      await expect(page).toHaveURL(/\/strom\/compra\/proceso\/orden\?hash=/, { timeout: 30000 });
      await expect(page.getByText(/Pedido de demostración|Tienda de demostración/).first()).toBeVisible();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: ".impeccable/review/strom-order-desktop.png", fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: ".impeccable/review/strom-order-mobile.png", fullPage: true });
    }
  });
});
