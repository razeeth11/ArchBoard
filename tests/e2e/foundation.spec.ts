import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATIC_PAGES = [
  "/",
  "/templates",
  "/components",
  "/about",
  "/privacy",
  "/credits",
  "/changelog",
  "/vs",
];

for (const path of STATIC_PAGES) {
  test(`static page ${path} has SEO basics and no serious a11y issues`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.title()).not.toBe("");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    const res = await new AxeBuilder({ page }).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad).toEqual([]);
  });
}

test("editor loads from landing CTA without sign-in and without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.getByRole("link", { name: "Start drawing" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("self-hosted fonts are requested from our origin, not a CDN", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.hostname !== "localhost") external.push(r.url());
  });
  await page.goto("/app");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 15_000 });
  expect(external).toEqual([]);
});
