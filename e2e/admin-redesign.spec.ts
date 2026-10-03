import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("demo@landing.test");
  await page.getByPlaceholder("Contraseña").fill("Ropa1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(panel|gestion)/);
});

test("the dashboard and sales are different screens", async ({ page }) => {
  await page.goto("/gestion");
  await expect(page.locator(".order-list-row")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inicio");
  await page.goto("/gestion/pedidos");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ventas");
  await expect(page.getByRole("button", { name: /Nueva venta|Nuevo pedido/ })).toHaveCount(0);
});

test("quick-buy options stay within the desktop preview", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop preview layout.");
  await page.goto("/gestion/configuracion/diseno");
  await page.getByRole("button", { name: "Productos", exact: true }).click();
  await page.getByRole("checkbox", { name: "Habilitar botón de compra rápida", exact: true }).check();
  const preview = page.frameLocator('iframe[title="Vista previa de la tienda"]');
  await preview.getByRole("button", { name: "Compra rápida: Camisa de lino", exact: true }).click();
  const menu = preview.getByRole("group", { name: "Compra rápida de Camisa de lino", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Elegí una opción", { exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Agregar al carrito", exact: true })).toBeDisabled();
  const bounds = await menu.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
});

test("featured category image picker keeps the design editor in view", async ({ page }, info) => {
  await page.goto("/gestion/configuracion/diseno");
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Página de inicio", exact: true }).click();
  await page.getByRole("button", { name: "Editar Categorías destacadas" }).click();

  const upload = page.locator(".home-category-tile .design-upload").first();
  await expect(upload).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await upload.click();
  const chooser = await chooserPromise;
  await chooser.setFiles([]);

  const layout = await page.evaluate(() => ({
    scrollY: window.scrollY,
    pageHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight
  }));
  expect(layout.scrollY).toBe(0);
  expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  await expect(page.getByRole("button", { name: "Agregar categoría" })).toBeVisible();
  if (info.project.name === "mobile") await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();
});

test("mobile management has only a fixed bottom navigation", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile-only navigation.");
  await page.goto("/gestion/productos");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();
  await expect(page.locator(".admin-sidebar")).toBeHidden();
  await page.getByRole("combobox", { name: "Elementos por página" }).scrollIntoViewIfNeeded();
  const position = await nav.evaluate(element => ({ style: getComputedStyle(element).position, bottom: element.getBoundingClientRect().bottom, height: innerHeight }));
  expect(position.style).toBe("fixed");
  expect(Math.abs(position.bottom - position.height)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("template previews do not publish or create purchases", async ({ page }, info) => {
  const mutations: string[] = [];
  page.on("request", request => {
    if (["POST", "PATCH", "PUT"].includes(request.method()) && /\/api\/(admin\/design-draft|orders)(\?|$)/.test(request.url())) mutations.push(request.url());
  });
  await page.goto("/gestion/configuracion/diseno");
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Plantilla", exact: true }).click();
  for (const template of ["Roma", "Dana", "Vene"]) {
    await page.getByRole("button", { name: new RegExp(template + " ·") }).click();
    const preview = page.frameLocator('iframe[title="Vista previa de la tienda"]');
    await expect(preview.locator(`[data-template="${template.toLowerCase()}"]`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Guardar borrador", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Publicar/ })).toBeEnabled();
  expect(mutations).toEqual([]);
});
