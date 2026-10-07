import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { apiReady, elementCount } from "./helpers";

test("catalog lists 40+ templates grouped by category, each with a preview", async ({ page }) => {
  await page.goto("/templates");
  const cards = page.locator("main ul li a[href^='/templates/']");
  expect(await cards.count()).toBeGreaterThanOrEqual(40);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("System design templates");
  const first = page.locator("main img").first();
  await first.scrollIntoViewIfNeeded();
  await expect
    .poll(() => first.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBeGreaterThan(0);
});

test("a template page opens its diagram as a new scene in the editor", async ({ page }) => {
  await page.goto("/templates/url-shortener");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("URL Shortener");
  await page.getByRole("link", { name: "Open in ArchBoard" }).click();
  await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 30_000 });
  await apiReady(page);
  await expect(page).toHaveURL(/scene=/);
  await expect(page).not.toHaveURL(/template=/);
  expect(await elementCount(page)).toBeGreaterThan(15);
  const arrows = await page.evaluate(() =>
    window
      .__archboard!.api.getSceneElements()
      .filter((e) => e.type === "arrow")
      .map((a) => ({
        s: !!(a as { startBinding?: unknown }).startBinding,
        e: !!(a as { endBinding?: unknown }).endBinding,
      })),
  );
  expect(arrows.length).toBeGreaterThan(3);
  expect(arrows.every((a) => a.s && a.e)).toBe(true);
});

test("an unknown template shows an error instead of an empty editor", async ({ page }) => {
  await page.goto("/app?template=does-not-exist");
  await expect(page.getByTestId("share-error")).toContainText("does not exist");
});

test("guides, comparisons and components are reachable from the navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Guides" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guides");
  expect(await page.locator("main h2 a").count()).toBeGreaterThanOrEqual(10);
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Compare" })
    .click();
  await expect(page.locator("main h2 a")).toHaveCount(5);
  await page.getByRole("link", { name: "ArchBoard vs Excalidraw" }).click();
  await expect(page.getByRole("heading", { name: "Choose Excalidraw when" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose ArchBoard when" })).toBeVisible();
});

test("diagram DSL guide documents the grammar and the examples", async ({ page }) => {
  await page.goto("/guides/diagram-dsl");
  await expect(page.getByRole("heading", { name: "Grammar" })).toBeVisible();
  expect(await page.locator("main article pre").count()).toBeGreaterThanOrEqual(10);
});

test("component pages list properties", async ({ page }) => {
  await page.goto("/components/load-balanced-service");
  await expect(page.getByRole("table")).toContainText("Replicas");
});

for (const path of [
  "/",
  "/templates",
  "/templates/chat-application",
  "/guides",
  "/guides/system-design-diagram",
  "/vs/draw-io",
  "/components",
  "/components/cqrs",
]) {
  test(`${path} has no axe violations and a valid structure`, async ({ page }) => {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations).toEqual([]);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const t of ld) expect(() => JSON.parse(t)).not.toThrow();
  });
}
