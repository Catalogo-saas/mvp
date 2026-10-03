import { expect, test } from "@playwright/test";

test("the main value and CTA remain usable without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu tienda online");
  await expect(page.getByRole("link", { name: /Quiero mi tienda/i }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the public footer stacks cleanly on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Footer mobile layout is covered by the mobile project.");
  await page.goto("/demo");

  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  const layout = await footer.locator(":scope > div").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { columns: style.gridTemplateColumns.split(" ").length, right: element.getBoundingClientRect().right };
  });
  expect(layout.columns).toBe(1);

  const overflow = await page.evaluate(() => {
    const viewportRight = document.documentElement.clientWidth;
    return Math.max(0, document.documentElement.scrollWidth - viewportRight, ...Array.from(document.querySelectorAll("footer *"), (element) => element.getBoundingClientRect().right - viewportRight));
  });
  expect(overflow).toBeLessThanOrEqual(1);
});

test("a product card opens its own page with sharing metadata", async ({ page }) => {
  await page.goto("/demo/productos");
  const productButton = page.locator("#catalogo article button").first();
  await expect(productButton).toBeVisible();
  await productButton.click();
  await expect(page).toHaveURL(/\/producto\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartir producto" })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
  await expect(page.getByRole("dialog", { name: /Detalle de/i })).toHaveCount(0);
});

test("secondary public pages keep the fixed menu and nested categories", async ({ page }, testInfo) => {
  await page.goto("/demo/productos");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const drawer = page.getByRole("dialog", { name: "Menú de la tienda" });
    await drawer.locator("summary").first().click();
    await expect(drawer.getByText("Mujer", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Mostrar subcategorías de Mujer" }).click();
    await expect(drawer.getByText("Camisas y blusas", { exact: true })).toBeVisible();
  } else {
    const nav = page.getByRole("navigation", { name: "Menú de la tienda" });
    await expect(nav.getByRole("link", { name: "Inicio" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Productos", exact: true })).toBeVisible();
    await nav.getByRole("button", { name: /Categorías/ }).focus();
    await expect(nav.getByRole("link", { name: "Camisas y blusas" })).toBeVisible();
  }
});

test("product management keeps the simple responsive action layout", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("demo@landing.test");
  await page.getByPlaceholder("Contraseña").fill("Ropa1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(panel|gestion)/);
  await page.goto("/gestion/productos");

  const moreButton = page.getByRole("button", { name: "Más opciones de productos" });
  const newButton = page.getByRole("link", { name: "Agregar producto", exact: true }).first();
  await expect(moreButton).toBeVisible();
  await expect(newButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Importar productos", exact: true })).toBeHidden();

  if (testInfo.project.name === "mobile") {
    const bottomNav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(bottomNav).toBeVisible();
    expect(await bottomNav.evaluate(element => getComputedStyle(element).position)).toBe("fixed");
    await expect(page.locator(".admin-sidebar")).toBeHidden();
    const rowHeight = await page.locator(".catalog-row").first().evaluate(element => element.getBoundingClientRect().height);
    expect(rowHeight).toBeLessThan(130);
  }

  await moreButton.click();
  const moreMenu = page.getByRole("menu", { name: "Más opciones de productos", exact: true });
  await expect(moreMenu.getByRole("menuitem", { name: "Exportar productos" })).toBeVisible();
  await moreMenu.getByRole("menuitem", { name: "Importar productos", exact: true }).click();
  const importDialog = page.getByRole("dialog", { name: "Importar productos" });
  await expect(importDialog.getByRole("link", { name: "Descargar plantilla" })).toBeVisible();
  await expect(importDialog.getByLabel("Seleccionar archivo")).toBeVisible();
  await importDialog.getByRole("button", { name: "Cerrar Importar productos", exact: true }).click();

  await newButton.click();
  await expect(page).toHaveURL(/\/gestion\/productos\/nuevo$/);
  await expect(page.getByRole("textbox", { name: "Oferta $" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Visibilidad" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Envío gratis para este producto" })).toBeVisible();
  await expect(page.getByText("Slug", { exact: true })).toHaveCount(0);
});
