import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../lib/prisma";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(/\/gestion(?:\?|$)/);
}

test("equipo: altas, permisos, roles y revocación de sesiones", async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/landing_saas");
  test.skip(!["localhost", "127.0.0.1"].includes(database.hostname), "Los fixtures requieren una base local.");
  const prefix = `qa_team_${randomUUID()}`;
  const operatorEmail = `${prefix}_operator@example.invalid`;
  const adminEmail = `${prefix}_admin@example.invalid`;
  const password = "team-test-1234";
  const memberContext = await browser.newContext({ baseURL: info.project.use.baseURL });
  const adminContext = await browser.newContext({ baseURL: info.project.use.baseURL });
  try {
    await login(page, "demo@landing.test", "demo1234");
    await page.goto("/gestion/usuarios");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Usuarios");
    await expect(page.getByText("Titular · Cuenta protegida")).toBeVisible();
    await page.getByRole("button", { name: "Nuevo usuario", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo usuario", exact: true });
    await dialog.getByLabel("Nombre", { exact: true }).fill("Operador de prueba");
    await dialog.getByLabel("Email", { exact: true }).fill(operatorEmail);
    await dialog.getByLabel("Contraseña", { exact: true }).fill(password);
    await dialog.getByRole("button", { name: "Crear usuario", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const operator = await prisma.user.findUniqueOrThrow({ where: { email: operatorEmail } });
    const createAdmin = await page.request.post("/api/admin/users", { data: { name: "Administrador de prueba", email: adminEmail, password, role: "ADMIN" } });
    expect(createAdmin.status()).toBe(201);
    const admin = (await createAdmin.json()).user;
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "demo@landing.test" } });
    expect((await page.request.patch(`/api/admin/users/${owner.id}`, { data: { status: "SUSPENDED" } })).status()).toBe(403);
    await page.reload();
    await page.getByLabel("Buscar usuarios").fill("de prueba");
    await expect(page.getByRole("row").filter({ hasText: operatorEmail })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: adminEmail })).toBeVisible();
    await expect(page.getByText("Cargando usuarios…")).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `.impeccable/review/${info.project.name}.png`, fullPage: true });
    await page.getByRole("row").filter({ hasText: operatorEmail }).getByRole("button", { name: "Acciones de Operador de prueba", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar usuario", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Editar usuario", exact: true });
    await edit.getByLabel("Nombre", { exact: true }).fill("Operador de prueba editado");
    await page.screenshot({ path: `.impeccable/review/${info.project.name}-form.png`, fullPage: true });
    await edit.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(edit).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: operatorEmail })).toContainText("Operador de prueba editado");

    const memberPage = await memberContext.newPage();
    await login(memberPage, operatorEmail, password);
    await memberPage.goto("/gestion/configuracion");
    await expect(memberPage).toHaveURL(/\/gestion$/);
    await memberPage.goto("/gestion/configuracion/diseno");
    await expect(memberPage).toHaveURL(/\/gestion$/);
    await memberPage.goto("/vista-previa/tienda");
    await expect(memberPage).toHaveURL(/\/gestion$/);
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(200);
    expect((await memberPage.request.get("/api/admin/users")).status()).toBe(403);
    expect((await memberPage.request.patch("/api/admin/commerce-settings", { data: { name: "Sin permiso" } })).status()).toBe(403);
    expect((await memberPage.request.post("/api/uploads", { data: { scope: "logos", contentType: "image/webp", size: 100 } })).status()).toBe(403);

    const adminPage = await adminContext.newPage();
    await login(adminPage, adminEmail, password);
    await adminPage.goto("/gestion/usuarios");
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText("Usuarios");
    expect((await adminPage.request.patch(`/api/admin/users/${admin.id}`, { data: { status: "SUSPENDED" } })).status()).toBe(403);
    expect((await adminPage.request.patch(`/api/admin/users/${owner.id}`, { data: { role: "OPERATOR" } })).status()).toBe(403);
    expect((await adminPage.request.post("/api/admin/users", { data: { name: "Repetido", email: operatorEmail, password } })).status()).toBe(409);
    expect((await adminPage.request.patch(`/api/admin/users/${operator.id}`, { data: { role: "ADMIN" } })).status()).toBe(200);
    expect((await memberPage.request.get("/api/admin/users")).status()).toBe(200);
    expect((await adminPage.request.patch(`/api/admin/users/${operator.id}`, { data: { role: "OPERATOR" } })).status()).toBe(200);
    expect((await memberPage.request.get("/api/admin/users")).status()).toBe(403);

    await page.getByRole("row").filter({ hasText: operatorEmail }).getByRole("button", { name: "Acciones de Operador de prueba editado", exact: true }).click();
    await page.getByRole("menuitem", { name: "Suspender acceso", exact: true }).click();
    const suspend = page.getByRole("dialog", { name: "Suspender acceso", exact: true });
    await suspend.getByRole("button", { name: "Suspender acceso", exact: true }).click();
    await expect(suspend).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: operatorEmail })).toContainText("Suspendido");
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(401);
    expect((await adminPage.request.patch(`/api/admin/users/${operator.id}`, { data: { status: "ACTIVE" } })).status()).toBe(200);
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(401);
    await memberContext.clearCookies();
    await login(memberPage, operatorEmail, password);
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(200);
    expect((await adminPage.request.patch(`/api/admin/users/${operator.id}`, { data: { password: "team-new-password123" } })).status()).toBe(200);
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(401);
    await memberContext.clearCookies();
    await login(memberPage, operatorEmail, "team-new-password123");
    expect((await memberPage.request.get("/api/admin/products")).status()).toBe(200);
  } finally {
    await memberContext.close(); await adminContext.close();
    await prisma.user.deleteMany({ where: { email: { in: [operatorEmail, adminEmail] } } });
  }
});
