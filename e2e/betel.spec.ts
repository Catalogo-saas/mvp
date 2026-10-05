import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.use({ trace: "off" });

test.describe("Betel", () => {
  test.skip(!process.env.BETEL_QA, "Ejecutar contra la tienda Betel recién creada con BETEL_QA=1");

  test("identidad, catálogo vacío y contacto en escritorio y móvil", async ({ page, isMobile }, testInfo) => {
    await page.goto("/betel");
    const storefront = page.locator('[data-template="dana"]').first();
    await expect(storefront).toBeVisible();
    await expect(page.getByRole("heading", { name: "Indumentaria & Hogar", exact: true })).toBeVisible();
    const logo = page.getByRole("img", { name: "Betel", exact: true }).first();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => undefined))); });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(storefront).toHaveCSS("background-color", "rgb(248, 237, 226)");
    await expect(page.getByText("Elegidos para vos", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Indumentaria y Hogar", { exact: true })).toHaveCount(0);
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("href", "/betel/contacto");
    await expect(footer.getByText(/^© \d{4} Betel\. Todos los derechos reservados\.$/)).toHaveCSS("color", "rgb(75, 36, 21)");
    expect(await storefront.locator("main > section").first().evaluate(section => getComputedStyle(section, "::after").backgroundImage)).toBe("none");
    if (!isMobile) await expect(page.locator("header").getByRole("link", { name: "Contacto", exact: true })).toBeVisible();
    await mkdir(".impeccable/review", { recursive: true });
    await page.screenshot({ path: `.impeccable/review/betel-${testInfo.project.name}.png`, fullPage: true });

    await page.goto("/betel/productos");
    await expect(page.getByText("No encontramos productos. Probá otra búsqueda o categoría.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.locator("footer").getByRole("link", { name: "Contacto", exact: true }).click();
    await expect(page.getByRole("link", { name: "estefaniadaianagomez@gmail.com", exact: true })).toHaveAttribute("href", "mailto:estefaniadaianagomez@gmail.com");
    await expect(page.getByRole("link", { name: "Escribir por WhatsApp", exact: true })).toHaveAttribute("href", "https://wa.me/543813488267");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (isMobile) {
      await page.getByRole("button", { name: /menú/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("href", "/betel/contacto");
    }
  });

  test("el titular puede ingresar al panel", async ({ page }) => {
    test.skip(!process.env.BETEL_OWNER_PASSWORD, "La contraseña se recibe solo por variable de entorno.");
    await page.goto("/login");
    await page.getByPlaceholder("Email", { exact: true }).fill("estefaniadaianagomez@gmail.com");
    await page.getByPlaceholder("Contraseña", { exact: true }).fill(process.env.BETEL_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(/\/gestion(?:\?|$)/);
    await expect(page.getByText("Así está tu negocio, Betel.", { exact: true })).toBeVisible();
  });
});
