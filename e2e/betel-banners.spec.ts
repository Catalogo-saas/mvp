import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.use({ trace: "off" });
test("fotos de indumentaria de Betel en escritorio y móvil", async ({ page, isMobile }, testInfo) => {
  test.skip(!process.env.BETEL_QA, "Verificar contra la tienda real con BETEL_QA=1");
  test.setTimeout(60_000);
  await page.goto("/betel", { waitUntil: "domcontentloaded" });
  const hero = page.locator('[data-template="dana"] main > section').first();
  await expect(hero).toHaveAttribute("data-fit-background", "true");
  await expect(hero).toHaveAttribute("data-position", isMobile ? "top-center" : "middle-left");
  await expect(hero).toHaveAttribute("data-height", "medium");
  const image = hero.locator("img").first();
  await expect(image).toHaveAttribute("src", new RegExp(`betel-fashion-${isMobile ? "mobile" : "desktop"}-[a-f0-9]+\\.jpg$`));
  await image.evaluate(async element => { await (element as HTMLImageElement).decode(); });
  expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(isMobile ? 1000 : 2000);
  await expect(hero.getByRole("heading", { name: "Indumentaria & Hogar", exact: true })).toBeVisible();
  await expect(hero.getByText("Estilo para vos y tu hogar", { exact: true })).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => undefined))); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({ path: `.impeccable/review/betel-banner-${testInfo.project.name}.png`, fullPage: true });
});
