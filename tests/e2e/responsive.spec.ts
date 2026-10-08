import { expect, test } from "./fixtures";
import { openEditor } from "./helpers";

const WIDTHS = [320, 375, 768, 1024, 1440];
const SITE_PAGES = [
  "/",
  "/templates",
  "/templates/url-shortener",
  "/guides",
  "/guides/diagram-dsl",
  "/vs",
  "/vs/excalidraw",
  "/components",
  "/components/cqrs",
  "/about",
  "/privacy",
  "/credits",
  "/changelog",
];

for (const w of WIDTHS) {
  test(`site pages have no horizontal scroll at ${w}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: 800 });
    const bad: string[] = [];
    for (const p of SITE_PAGES) {
      await page.goto(p);
      const o = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (o.sw > o.cw) bad.push(`${p} ${o.sw}>${o.cw}`);
    }
    expect(bad).toEqual([]);
  });
}

test("header collapses into a menu on phones and shows full links on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByText("Menu")).toBeVisible();
  await page.getByText("Menu", { exact: true }).click();
  await page.getByRole("link", { name: "Templates", exact: true }).first().click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("navigation", { name: "Primary" }).getByText("Menu")).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Guides" }),
  ).toBeVisible();
});

/** Below 1024px the editor actions live in one compact menu; from there up they are buttons. */
async function openAction(page: import("@playwright/test").Page, w: number, name: string) {
  if (w < 1024) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  } else {
    await page.getByRole("button", { name, exact: true }).click();
  }
}

for (const w of [375, 768, 1024, 1440]) {
  test(`editor controls stay on screen at ${w}px, with every panel open`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: 800 });
    await openEditor(page);
    const offscreen = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("button, [role=tab], input")]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            const cs = getComputedStyle(b);
            // Excalidraw keeps an invisible checkbox for its (hidden) library trigger and parks its
            // closed sidebar off-screen by design.
            if (b.closest(".sidebar, .layer-ui__library, .sidebar-trigger__label-element"))
              return false;
            return (
              r.width > 0 && cs.visibility !== "hidden" && (r.right > innerWidth + 1 || r.left < -1)
            );
          })
          .map((b) => (b.getAttribute("aria-label") || b.textContent || b.tagName).slice(0, 24)),
      );
    const scrollW = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(await offscreen()).toEqual([]);
    expect(await scrollW()).toBeLessThanOrEqual(0);

    await openAction(page, w, "Components");
    const panel = page.locator("#components-panel");
    await expect(panel).toBeVisible();
    for (const tab of ["Smart", "Blocks", "Tech", "Kits", "Icons", "SVG"]) {
      await panel.getByRole("tab", { name: new RegExp(tab) }).click();
      const [sw, cw] = await panel
        .locator("div.overflow-y-auto")
        .evaluate((e) => [e.scrollWidth, e.clientWidth]);
      expect(sw, `${tab} tab scrollWidth`).toBeLessThanOrEqual(cw);
    }
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
    await page.getByRole("button", { name: "Close components panel" }).click();

    await openAction(page, w, "Scenes");
    const scenes = (await page.locator("#workspace-panel").boundingBox())!;
    expect(scenes.x).toBeGreaterThanOrEqual(-1);
    expect(scenes.x + scenes.width).toBeLessThanOrEqual(w + 1);
  });
}

test("dialogs fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await openEditor(page);
  for (const item of [
    /Diagram from text/,
    /Mermaid/,
    "Share via link",
    "Style presets",
    "Version history",
  ]) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: item }).click();
    const d = page.getByRole("dialog");
    await expect(d).toBeVisible();
    const b = (await d.boundingBox())!;
    expect(b.x, String(item)).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, String(item)).toBeLessThanOrEqual(376);
    expect(b.y + b.height, String(item)).toBeLessThanOrEqual(701);
    await page.keyboard.press("Escape");
  }
});
