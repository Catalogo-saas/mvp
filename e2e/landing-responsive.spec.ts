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
  const layout = await footer.locator(":scope > div").evaluate((element) => {
    const style = getComputedStyle(element);
    return { flexDirection: style.flexDirection, right: element.getBoundingClientRect().right };
  });
  expect(layout.flexDirection).toBe("column");

  const overflow = await page.evaluate(() => {
    const viewportRight = document.documentElement.clientWidth;
    return Math.max(0, document.documentElement.scrollWidth - viewportRight, ...Array.from(document.querySelectorAll("footer *"), (element) => element.getBoundingClientRect().right - viewportRight));
  });
  expect(overflow).toBeLessThanOrEqual(1);
});

test("a product card opens its detail without an accidental quick add", async ({ page }) => {
  await page.goto("/demo");
  const productButton = page.locator("#catalogo article button").first();
  await expect(productButton).toBeVisible();
  await productButton.click();
  const dialog = page.getByRole("dialog", { name: /Detalle de/i });
  await expect(dialog).toBeVisible();
  const shareBox = await dialog.getByRole("button", { name: "Compartir producto" }).boundingBox();
  const closeBox = await dialog.getByRole("button", { name: "Cerrar" }).boundingBox();
  expect(shareBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(Math.abs((shareBox?.y ?? 0) - (closeBox?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((shareBox?.height ?? 0) - (closeBox?.height ?? 0))).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("product management keeps the simple responsive action layout", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("demo@landing.test");
  await page.getByPlaceholder("Contraseña").fill("demo1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(panel|gestion)/);
  await page.goto("/gestion/productos");

  const importButton = page.getByRole("button", { name: "Importar", exact: true });
  const exportLink = page.getByRole("link", { name: "Exportar", exact: true });
  const newButton = page.getByRole("button", { name: "Nuevo", exact: true });
  await expect(importButton).toBeVisible();
  await expect(exportLink).toBeVisible();
  await expect(newButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Plantilla", exact: true })).toHaveCount(0);

  if (testInfo.project.name === "mobile") {
    const [importBox, exportBox, newBox] = await Promise.all([importButton.boundingBox(), exportLink.boundingBox(), newButton.boundingBox()]);
    expect(Math.abs((importBox?.y ?? 0) - (exportBox?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(newBox?.y ?? 0).toBeGreaterThan((importBox?.y ?? 0) + (importBox?.height ?? 0));
    expect(newBox?.width ?? 0).toBeGreaterThan((importBox?.width ?? 0) * 1.8);
  }

  await importButton.click();
  const importDialog = page.getByRole("dialog", { name: "Importar productos" });
  await expect(importDialog.getByRole("link", { name: "Descargar plantilla" })).toBeVisible();
  await expect(importDialog.getByRole("button", { name: /Seleccionar archivo/ })).toBeVisible();
  await importDialog.getByRole("button", { name: "Cerrar importación" }).click();

  await newButton.click();
  await expect(page.getByRole("switch", { name: "Producto de oferta" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Visible en la web" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Producto destacado" })).toBeVisible();
  await expect(page.getByText("SKU", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Slug", { exact: true })).toHaveCount(0);
});
