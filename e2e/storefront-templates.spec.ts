import { expect, test, type Page } from "@playwright/test";

// Run after scripts/template-qa-fixtures.ts. Never publishes or submits a purchase.
test.skip(process.env.TEMPLATE_QA !== "1", "Requires isolated local template fixtures.");

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

for (const template of ["roma", "dana", "vene"] as const) {
  const url = "/qa-template-" + template;
  test(`${template}: desktop and mobile layouts, fonts and navigation`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "The width matrix includes mobile.");
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url, { waitUntil: "networkidle" });
      await expect(page.locator(`[data-template="${template}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page);
      const font = await page.getByRole("heading", { level: 1 }).evaluate(element => getComputedStyle(element).fontFamily);
      expect(font.toLowerCase()).toContain(template === "roma" ? "poppins" : template === "dana" ? "baskerville" : "sora");
      const featured = page.locator("main section").filter({ has: page.getByRole("heading", { name: template === "vene" ? "Los más vendidos" : "Nueva temporada" }) });
      const layout = await featured.locator("article").first().evaluate(element => {
        const parent = element.parentElement!;
        const style = getComputedStyle(parent);
        return { display: style.display, columns: style.gridTemplateColumns.split(" ").length, scrollable: parent.scrollWidth > parent.clientWidth };
      });
      if (width <= 900) {
        await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toBeVisible();
        expect(layout.display).toBe(template === "vene" ? "grid" : "flex");
        if (template === "vene") expect(layout.columns).toBe(2);
        else expect(layout.scrollable).toBe(true);
        await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
        const menu = page.getByRole("dialog", { name: "Menú de la tienda" });
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
        await expect(menu.getByRole("link", { name: "Crear cuenta" })).toBeVisible();
        await expect(menu.getByText("Mis compras")).toHaveCount(0);
        await menu.getByRole("link", { name: "Contáctanos" }).click();
        await expect(page).toHaveURL(url + "/contacto");
        await page.goto(url + "/productos");
        await expect(page.locator("#catalogo").getByRole("heading", { level: 1 })).toBeVisible();
      } else {
        await expect(page.getByRole("navigation", { name: "Menú de la tienda" })).toBeVisible();
        expect(layout.columns).toBe(4);
        if (template !== "vene") {
          const logo = await page.getByRole("link", { name: "Inicio · " + template.toUpperCase() }).boundingBox();
          expect(Math.abs(logo!.x + logo!.width / 2 - width / 2)).toBeLessThanOrEqual(2);
        }
      }
      await noOverflow(page);
      await page.screenshot({ path: `test-results/${template}-${width}.png` });
    }
  });

  test(`${template}: product, cart, filters and empty results`, async ({ page }) => {
    await page.goto(url + "/productos", { waitUntil: "networkidle" });
    const catalog = page.locator("#catalogo");
    await catalog.locator("article button").first().click();
    await expect(page).toHaveURL(new RegExp(url + "/producto/producto-0$"));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Sweater esencial", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    const cart = page.getByRole("dialog", { name: "Mi carrito" });
    await expect(cart).toBeVisible();
    await expect(cart.getByText("Sweater esencial", { exact: true })).toBeVisible();
    await expect(cart.getByRole("button", { name: "Realizar compra" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cart).toBeHidden();
    await page.goto(url + "/productos", { waitUntil: "networkidle" });
    await catalog.getByRole("button", { name: "Filtrar" }).click();
    const filters = page.getByRole("dialog", { name: "Filtrar productos" });
    await filters.getByRole("radio", { name: "Calzado" }).check();
    await filters.getByRole("button", { name: "Ver productos" }).click();
    await expect(catalog.locator("article")).toHaveCount(5);
    await catalog.getByRole("button", { name: "Filtrar" }).click();
    await filters.getByRole("combobox", { name: "Ordenar por" }).selectOption("price-desc");
    await filters.getByRole("button", { name: "Ver productos" }).click();
    await expect(catalog.locator("article").first()).toContainText("Remera de algodón · Edición natural");
    if (page.viewportSize()!.width <= 900) {
      await page.getByRole("button", { name: "Abrir búsqueda" }).click();
      await page.getByRole("textbox", { name: "Buscar productos", exact: true }).fill("sin-coincidencias-qa");
    } else {
      await page.getByRole("textbox", { name: "Buscar productos en la tienda" }).fill("sin-coincidencias-qa");
    }
    await expect(catalog.getByText("No encontramos productos. Probá otra búsqueda o categoría.")).toBeVisible();
    await noOverflow(page);
  });

  test(`${template}: loads the next product page without replacing earlier cards`, async ({ page }) => {
    await page.goto(url + "/productos", { waitUntil: "networkidle" });
    const catalog = page.locator("#catalogo");
    await expect(catalog.locator("article")).toHaveCount(12);
    await catalog.getByRole("button", { name: "Ver más productos" }).click();
    await expect(catalog.locator("article")).toHaveCount(16);
    await expect(page).toHaveURL(/[?&]pagina=2(?:&|$)/);
    await page.reload();
    await expect(catalog.locator("article")).toHaveCount(16);
    await noOverflow(page);
  });

  test(`${template}: contact retains its template; category page is gone`, async ({ page }) => {
    await page.goto(url + "/contacto");
    await expect(page.locator(`[data-template="${template}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contacto");
    await expect(page.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa.me\//);
    await noOverflow(page);
    const response = await page.goto(url + "/categorias");
    expect(response?.status()).toBe(404);
  });
}
