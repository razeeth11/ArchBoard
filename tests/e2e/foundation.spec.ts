import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openEditor } from "./helpers";

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

test("whiteboard has a Home button and every visible button has a tooltip", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>("button")).filter(
            (b) =>
              !b.hasAttribute("title") &&
              (b.getAttribute("aria-label") || b.textContent?.trim()) &&
              b.getClientRects().length > 0,
          ).length,
      ),
    )
    .toBe(0);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
});
