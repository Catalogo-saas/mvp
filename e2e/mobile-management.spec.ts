import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page, browserName, isMobile }, info) => {
  test.skip(info.title.startsWith("touch sorting") && (browserName !== "chromium" || !isMobile), "Touch synthesis uses Chromium.");
  test.skip(info.title.startsWith("prefetched loading") && process.env.PLAYWRIGHT_LOADING_QA !== "1", "Loading checks require next start.");
  // These checks only edit local drafts. Saving is tested against a mocked API.
  await page.route("**/api/admin/**", async route => {
    if (["PUT", "PATCH", "POST", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 409, json: { error: "No se permite guardar datos reales en esta prueba." } });
    } else await route.continue();
  });
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("demo@landing.test");
  await page.getByPlaceholder("Contraseña").fill("Ropa1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/gestion");
  await expect(page.getByRole("heading", { name: "Inicio", level: 1, exact: true })).toBeVisible();
});

async function addCategory(page: Page, name: string, parent?: string) {
  if (parent) {
    await page.getByRole("button", { name: `Acciones de ${parent}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Crear subcategoría" }).click();
  } else await page.getByRole("button", { name: "Agregar categoría", exact: true }).click();
  await page.getByRole("textbox", { name: "Nombre de Nueva categoría", exact: true }).fill(name);
}

test("categories retain readable editable names and reachable actions at every width", async ({ page, isMobile }, info) => {
  await page.goto("/gestion/categorias");
  const root = "Ropa para hombre";
  await addCategory(page, root);
  await addCategory(page, "Pantalones", root);
  await addCategory(page, "Pantalones de vestir y accesorios para ocasiones especiales", `${root} / Pantalones`);
  for (const width of isMobile ? [320, 375, 390, 430, 768] : [1280]) {
    await page.setViewportSize({ width, height: 844 });
    const names = page.locator(".category-name-input");
    await expect(page.getByRole("heading", { name: "Categorías", level: 1 })).toHaveCount(1);
    await expect(page.locator(".category-product-count").first())[width < 768 ? "toBeHidden" : "toBeVisible"]();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    for (const field of await names.all()) {
      const bounds = await field.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, viewport: innerWidth }));
      expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    }
    if (width === 390 || width === 1280) {
      await page.screenshot({ path: info.outputPath(`categories-${width}.png`), fullPage: true });
    }
  }
  const deepMenu = page.getByRole("button", { name: `Acciones de ${root} / Pantalones / Pantalones de vestir y accesorios para ocasiones especiales`, exact: true });
  await deepMenu.click();
  const menu = page.getByRole("menu", { name: /Acciones de Ropa para hombre \/ Pantalones \/ Pantalones de vestir/ });
  await expect(menu.getByRole("menuitem", { name: "Crear subcategoría" })).toHaveCount(0);
  const menuBounds = await menu.boundingBox();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("category drafts preserve search, descendants, keyboard sorting, save and revert", async ({ page }) => {
  await page.goto("/gestion/categorias");
  await addCategory(page, "QA A");
  await addCategory(page, "QA B");
  await addCategory(page, "QA Child", "QA A");
  await page.getByRole("button", { name: "Ocultar QA A y subcategorías", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mostrar QA Child", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Contraer QA A", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre de QA Child", exact: true })).toBeHidden();
  await page.getByRole("textbox", { name: "Buscar categorías", exact: true }).fill("QA Child");
  await expect(page.getByRole("textbox", { name: "Nombre de QA Child", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reordenar QA Child", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Buscar categorías", exact: true }).fill("");
  const handle = page.getByRole("button", { name: "Reordenar QA A", exact: true });
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect.poll(async () => page.locator(".category-tree > .admin-sortable-item > .category-row .category-name-input").evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value).filter(name => name.startsWith("QA")))).toEqual(["QA B", "QA A"]);
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.locator(".category-panel .admin-notice.is-error")).toHaveText("No se permite guardar datos reales en esta prueba.");
  await expect(page.getByRole("textbox", { name: "Nombre de QA A", exact: true })).toBeVisible();
  let releaseSave!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  await page.route("**/api/admin/categories/tree", async route => {
    const body = route.request().postDataJSON();
    await saveGate;
    await route.fulfill({ json: { categories: body.categories.map((category: Record<string, unknown>) => ({ ...category, slug: "qa", count: 0, imageUrl: null, updatedAt: "2026-10-03T00:00:00.000Z" })) } });
  });
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  try {
    await expect(page.getByRole("textbox", { name: "Nombre de QA A", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Agregar categoría", exact: true })).toBeDisabled();
  } finally { releaseSave(); }
  await expect(page.locator(".category-save-bar")).toHaveCount(0);
  await expect(page.locator(".category-panel")).toHaveAttribute("aria-busy", "false");
  const field = page.getByRole("textbox", { name: "Nombre de QA A", exact: true });
  await field.fill("QA edited");
  await page.getByRole("button", { name: "Revertir cambios", exact: true }).click();
  await page.getByRole("dialog", { name: "Revertir cambios" }).getByRole("button", { name: "Revertir", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre de QA A", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ordenar alfabéticamente", exact: true }).click();
  const rootNames = await page.locator(".category-tree > .admin-sortable-item > .category-row .category-name-input").evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value));
  expect(rootNames).toEqual([...rootNames].sort((a, b) => a.localeCompare(b)));
  await page.getByRole("button", { name: "Acciones de QA A", exact: true }).click();
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
  await page.getByRole("dialog", { name: "Eliminar categoría", exact: true }).getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre de QA A", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Nombre de QA Child", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Nombre de QA B", exact: true })).toBeVisible();
});

test("banner personalization uses the visible mobile viewport and restores focus", async ({ page, isMobile }, info) => {
  await page.goto("/gestion/configuracion/diseno");
  if (isMobile) await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Página de inicio", exact: true }).click();
  await page.getByRole("button", { name: "Editar Banners", exact: true }).first().click();
  const trigger = page.getByRole("button", { name: "Personalizar", exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Personalizar banner 1", exact: true });
  await expect(dialog).toBeVisible();
  if (isMobile) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 420 }, { width: 667, height: 375 }]) {
      await page.setViewportSize(viewport);
      await dialog.getByRole("textbox", { name: "Enlace al hacer clic" }).focus();
      await expect.poll(() => dialog.evaluate(element => ({ top: Math.round(element.getBoundingClientRect().top), height: Math.round(element.getBoundingClientRect().height), width: Math.round(element.getBoundingClientRect().width) }))).toEqual({ top: 0, ...viewport });
      await dialog.getByRole("checkbox", { name: "Ajustar fondo al texto" }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("button", { name: "Listo", exact: true })).toBeInViewport();
      expect(await dialog.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    }
    await page.screenshot({ path: info.outputPath("banner-short-viewport.png") });
  } else {
    const bounds = await dialog.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(620);
  }
  await dialog.getByRole("button", { name: "Listo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("unsaved category edits still guard navigation", async ({ page, isMobile }) => {
  await page.goto("/gestion/categorias");
  await addCategory(page, "QA unsaved");
  const nav = page.getByRole("navigation", { name: isMobile ? "Navegación principal" : "Secciones de gestión" });
  await nav.getByRole("link", { name: "Productos", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Cambios sin guardar" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre de QA unsaved", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Productos", exact: true }).click();
  await confirmation.getByRole("button", { name: "Salir sin guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Productos", level: 1 })).toBeVisible();
  await expect(nav).toBeVisible();
});

test("touch sorting moves siblings while swipes on names scroll the page", async ({ page, context, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || !isMobile, "Touch input is synthesized through Chromium's device protocol.");
  await page.goto("/gestion/categorias");
  await addCategory(page, "QA Touch A");
  await addCategory(page, "QA Touch B");
  const handle = page.getByRole("button", { name: "Reordenar QA Touch A", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  const target = await page.getByRole("button", { name: "Reordenar QA Touch B", exact: true }).boundingBox();
  const session = await context.newCDPSession(page);
  const touch = async (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) => session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const x = source!.x + source!.width / 2;
  const startY = source!.y + source!.height / 2;
  await touch("touchStart", x, startY);
  // Allow the sensor's press delay to distinguish dragging from scrolling.
  await page.waitForTimeout(300);
  const endY = target!.y + target!.height / 2;
  for (let step = 1; step <= 8; step++) await touch("touchMove", x, startY + (endY - startY) * step / 8);
  await touch("touchEnd");
  await expect.poll(async () => page.locator(".category-tree > .admin-sortable-item > .category-row .category-name-input").evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value).filter(name => name.startsWith("QA Touch")))).toEqual(["QA Touch B", "QA Touch A"]);
  const before = await page.evaluate(() => scrollY);
  const field = await page.getByRole("textbox", { name: "Nombre de QA Touch A", exact: true }).boundingBox();
  await touch("touchStart", field!.x + 10, field!.y + 10);
  for (let step = 1; step <= 8; step++) await touch("touchMove", field!.x + 10, field!.y + 10 + step * 12);
  await touch("touchEnd");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before);
  await session.detach();
});

test("prefetched loading states keep navigation available during a slow transition", async ({ page, isMobile }) => {
  test.skip(process.env.PLAYWRIGHT_LOADING_QA !== "1", "Run against next start: production enables route prefetching.");
  let prefetched = false;
  page.on("response", response => {
    if (response.url().includes("/gestion/productos") && response.request().headers()["next-router-prefetch"] === "1") {
      // Partial RSC prefetches can keep their stream open after the loading UI arrives.
      prefetched = response.ok();
    }
  });
  await page.goto("/gestion/categorias");
  const nav = page.getByRole("navigation", { name: isMobile ? "Navegación principal" : "Secciones de gestión" });
  const products = nav.getByRole("link", { name: "Productos", exact: true });
  await products.scrollIntoViewIfNeeded();
  await expect.poll(() => prefetched, { timeout: 15_000 }).toBe(true);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/gestion/productos?*", async route => {
    if (route.request().headers()["next-router-prefetch"] !== "1") await gate;
    await route.continue();
  });
  try {
    await products.click();
    await expect(page.getByRole("status").filter({ hasText: "Cargando Productos" })).toBeAttached();
    await expect(page.locator(".admin-loading--list")).toBeVisible();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Inicio", exact: true })).toBeVisible();
  } finally { release(); }
  await products.click();
  await expect(page.getByRole("heading", { level: 1, name: "Productos", exact: true })).toBeVisible();
  await expect(page.locator(".admin-loading")).toHaveCount(0);
});
