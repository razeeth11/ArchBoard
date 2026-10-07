import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { chooseOption, downloadExport } from "./export-helpers";
import { apiReady, elementCount, openEditor, waitSaved } from "./helpers";
import { inspectPdf } from "./pdf-helpers";

const panel = (page: Page) => page.getByRole("complementary", { name: "Components" });
const search = (page: Page) => panel(page).getByPlaceholder("Search…");
const tab = (page: Page, name: RegExp | string) => panel(page).getByRole("tab", { name });

const summary = (page: Page) =>
  page.evaluate(() => {
    const api = window.__archboard!.api;
    return api.getSceneElements().map((e) => ({
      id: e.id,
      type: e.type,
      groupIds: e.groupIds,
      x: e.x,
      y: e.y,
      w: e.width,
      h: e.height,
      archboard: (e.customData as { archboard?: { id: string; kind: string } } | undefined)
        ?.archboard,
    }));
  });

const storedSvgs = (page: Page) =>
  page.evaluate(() =>
    Object.values(window.__archboard!.api.getFiles()).map((f) => {
      const b64 = f.dataURL.split(",")[1] ?? "";
      return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    }),
  );

test.beforeEach(async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await tab(page, /^Blocks/).click(); // Smart is the default tab
});

test("a block inserts as one selected group with its icon file and metadata", async ({ page }) => {
  await search(page).fill("redis");
  await page.getByTestId("library-item").first().click();
  await expect.poll(() => elementCount(page)).toBe(3);
  const els = await summary(page);
  expect(els.map((e) => e.type).sort()).toEqual(["image", "rectangle", "text"]);
  const groups = new Set(els.map((e) => e.groupIds.at(-1)));
  expect(groups.size).toBe(1);
  expect(els.find((e) => e.archboard)?.archboard).toMatchObject({
    id: "cache-redis",
    kind: "block",
  });
  const selected = await page.evaluate(() =>
    Object.keys(window.__archboard!.api.getAppState().selectedElementIds),
  );
  expect(selected).toHaveLength(3);
  expect((await storedSvgs(page))[0]).toContain("<svg");
});

test("every component, technology and kit shape inserts cleanly (no console errors)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  let clicked = 0;
  for (const name of [/^Blocks/, /^Tech/, /^Kits/]) {
    await tab(page, name).click();
    const items = panel(page).getByTestId("library-item");
    const n = await items.count();
    expect(n).toBeGreaterThan(30);
    for (let i = 0; i < n; i++) {
      await items.nth(i).click();
      clicked++;
    }
  }
  await expect
    .poll(
      async () => new Set((await summary(page)).map((e) => e.archboard?.id).filter(Boolean)).size,
      { timeout: 60_000 },
    )
    .toBe(clicked);
  // Everything must still be a valid scene: it saves and the editor stays responsive.
  await waitSaved(page);
});

test("items can be dragged onto the canvas and land under the cursor", async ({ page }) => {
  await search(page).fill("cdn");
  const card = page.getByTestId("library-item").first();
  const target = { x: 420, y: 380 };
  await card.dragTo(page.getByTestId("editor-root"), { targetPosition: target });
  await expect.poll(() => elementCount(page)).toBe(3);
  const els = await summary(page);
  const rect = els.find((e) => e.type === "rectangle")!;
  const scroll = await page.evaluate(() => {
    const s = window.__archboard!.api.getAppState();
    return { x: s.scrollX, y: s.scrollY, zoom: s.zoom.value };
  });
  const cx = (rect.x + rect.w / 2 + scroll.x) * scroll.zoom;
  const cy = (rect.y + rect.h / 2 + scroll.y) * scroll.zoom;
  expect(Math.abs(cx - target.x)).toBeLessThan(40);
  expect(Math.abs(cy - target.y)).toBeLessThan(60);
});

test("repeated inserts do not stack on top of each other", async ({ page }) => {
  await search(page).fill("service");
  const card = page.getByTestId("library-item").first();
  for (let i = 0; i < 4; i++) await card.click();
  await expect.poll(() => elementCount(page)).toBe(12);
  const rects = (await summary(page)).filter((e) => e.type === "rectangle");
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(overlap, `blocks ${i} and ${j} overlap`).toBe(false);
    }
  }
});

test("kits cover the required diagram types and ERD uses crow's-foot arrowheads", async ({
  page,
}) => {
  await tab(page, /^Kits/).click();
  for (const kit of [
    "UML",
    "Sequence",
    "ERD",
    "C4 model",
    "Flowchart / BPMN-lite",
    "Network topology",
    "User flow / wireframe",
    "Data flow",
  ]) {
    await expect(panel(page).getByRole("button", { name: kit, exact: true })).toBeVisible();
  }
  await panel(page).getByRole("button", { name: "ERD", exact: true }).click();
  await search(page).fill("one to many");
  await page.getByTestId("library-item").first().click();
  await expect.poll(() => elementCount(page)).toBe(1);
  const arrow = await page.evaluate(() => {
    const a = window.__archboard!.api.getSceneElements()[0] as unknown as {
      type: string;
      startArrowhead: string;
      endArrowhead: string;
    };
    return { type: a.type, start: a.startArrowhead, end: a.endArrowhead };
  });
  expect(arrow).toEqual({ type: "arrow", start: "crowfoot_one", end: "crowfoot_many" });
});

test.describe("icons", () => {
  test("bundled icon search works offline and inserts an icon with its name", async ({ page }) => {
    await tab(page, "Icons").click();
    await search(page).fill("kafka");
    const cells = panel(page).getByTestId("icon-cell");
    await expect.poll(() => cells.count()).toBeGreaterThan(1);
    await cells.first().click();
    await expect.poll(() => elementCount(page)).toBe(2);
    expect((await summary(page)).map((e) => e.type).sort()).toEqual(["image", "text"]);
  });

  test("online search is off by default and sends nothing until enabled", async ({ page }) => {
    const calls: string[] = [];
    page.on("request", (r) => r.url().includes("iconify.design") && calls.push(r.url()));
    await tab(page, "Icons").click();
    await search(page).fill("server");
    await expect.poll(() => panel(page).getByTestId("icon-cell").count()).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    expect(calls).toEqual([]);
    await expect(panel(page).getByLabel(/Also search online/)).not.toBeChecked();
  });

  test("when enabled, results are sanitized before use and attributed", async ({ page }) => {
    const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
    await page.route("https://api.iconify.design/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/search") {
        return route.fulfill({
          headers: cors,
          body: JSON.stringify({
            icons: ["tabler:evil-icon", "fa-solid:not-allowed", "mdi:../etc"],
          }),
        });
      }
      if (url.pathname === "/collections") {
        return route.fulfill({
          headers: cors,
          body: JSON.stringify({
            tabler: {
              name: "Tabler Icons",
              license: { title: "MIT" },
              author: { name: "Paweł Kuna" },
            },
          }),
        });
      }
      if (url.pathname === "/tabler.json") {
        return route.fulfill({
          headers: cors,
          body: JSON.stringify({
            width: 24,
            height: 24,
            icons: {
              "evil-icon": {
                body: '<path d="M2 2h20v20H2z" onclick="alert(1)"/><script>alert(1)</script><image href="https://evil.example/t.png"/>',
              },
            },
          }),
        });
      }
      return route.abort();
    });
    await tab(page, "Icons").click();
    await panel(page)
      .getByLabel(/Also search online/)
      .check();
    await search(page).fill("evil");
    const results = page.getByTestId("online-results").getByTestId("icon-cell");
    await expect(results).toHaveCount(1); // disallowed set and malformed names are dropped
    await results.first().click();
    await expect.poll(() => elementCount(page)).toBe(2);
    const svgs = (await storedSvgs(page)).join("\n");
    expect(svgs).toContain("<path");
    expect(svgs).not.toMatch(/script|onclick|evil\.example/i);
    const meta = (await summary(page)).find((e) => e.archboard)?.archboard as
      { license?: string } | undefined;
    expect(meta?.license).toContain("Tabler Icons");
  });

  test.describe("network failure", () => {
    // The browser itself logs the blocked request; that is the failure this test provokes.
    test.use({ allowedConsoleErrors: [/Failed to load resource|ERR_FAILED/] });
    test("online failures degrade to a helpful message while bundled icons keep working", async ({
      page,
    }) => {
      await page.route("https://api.iconify.design/**", (route) => route.abort());
      await tab(page, "Icons").click();
      await panel(page)
        .getByLabel(/Also search online/)
        .check();
      await search(page).fill("server");
      await expect(page.getByTestId("online-message")).toContainText(/unavailable|offline/i);
      await expect.poll(() => panel(page).getByTestId("icon-cell").count()).toBeGreaterThan(0);
    });
  });
});

test.describe("SVG import", () => {
  const evil = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" onload="alert(1)">
    <script>alert(2)</script><rect width="40" height="20" fill="#3b82f6" onclick="alert(3)"/>
    <image href="https://evil.example/track.png" width="5" height="5"/><a href="javascript:alert(4)"><circle cx="10" cy="10" r="5"/></a></svg>`;
  const shapes = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="30" height="20" fill="#f00"/><circle cx="70" cy="30" r="15" fill="#0f0"/><path d="M10 80 L50 60 L90 80 Z" fill="#00f"/></svg>`;

  test("file import strips scripts, handlers and remote references", async ({ page }) => {
    await tab(page, "SVG").click();
    await page
      .getByTestId("svg-file-input")
      .setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from(evil) });
    await expect.poll(() => elementCount(page)).toBe(1);
    expect((await summary(page))[0]!.type).toBe("image");
    const svg = (await storedSvgs(page))[0]!;
    expect(svg).toContain("<rect");
    expect(svg).not.toMatch(/script|onload|onclick|evil\.example|javascript:/i);
  });

  test("editable-shapes mode converts to native elements", async ({ page }) => {
    await tab(page, "SVG").click();
    await panel(page).getByText("Editable shapes", { exact: true }).click();
    await page.getByTestId("svg-file-input").setInputFiles({
      name: "shapes.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(shapes),
    });
    await expect.poll(() => elementCount(page)).toBe(3);
    const types = (await summary(page)).map((e) => e.type).sort();
    expect(types).toEqual(["ellipse", "line", "rectangle"]);
    expect(new Set((await summary(page)).map((e) => e.groupIds.at(-1))).size).toBe(1);
  });

  test("pasted markup in the textarea is sanitized the same way", async ({ page }) => {
    await tab(page, "SVG").click();
    await panel(page).getByLabel("Or paste SVG markup").fill(evil);
    await panel(page).getByRole("button", { name: "Import pasted SVG" }).click();
    await expect.poll(() => elementCount(page)).toBe(1);
    expect((await storedSvgs(page))[0]).not.toMatch(/script|onload/i);
  });

  test("pasting SVG onto the canvas is intercepted and sanitized", async ({ page }) => {
    await apiReady(page);
    await page.evaluate((markup) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", markup);
      document.body.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    }, evil);
    await expect.poll(() => elementCount(page)).toBe(1);
    expect((await storedSvgs(page))[0]).not.toMatch(/script|onload/i);
  });

  test("dropping an .svg file on the canvas is sanitized and placed at the cursor", async ({
    page,
  }) => {
    await apiReady(page);
    await page.evaluate((markup) => {
      const dt = new DataTransfer();
      dt.items.add(new File([markup], "dropped.svg", { type: "image/svg+xml" }));
      document.querySelector('[data-testid="editor-root"]')!.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: dt,
          clientX: 500,
          clientY: 300,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, evil);
    await expect.poll(() => elementCount(page)).toBe(1);
    expect((await storedSvgs(page))[0]).not.toMatch(/script|onload|evil\.example/i);
  });

  test("rejects files that are not SVG with a clear message", async ({ page }) => {
    await tab(page, "SVG").click();
    await page.getByTestId("svg-file-input").setInputFiles({
      name: "x.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<html>nope</html>"),
    });
    await expect(page.getByText("does not look like an SVG")).toBeVisible();
    expect(await elementCount(page)).toBe(0);
  });
});

test("inserted blocks persist across reload and export as vector PDF with their icons", async ({
  page,
}) => {
  await search(page).fill("kafka");
  await page.getByTestId("library-item").first().click();
  await expect.poll(() => elementCount(page)).toBe(3);
  await waitSaved(page);
  await page.reload();
  await expect.poll(() => elementCount(page)).toBe(3);
  await expect.poll(() => storedSvgs(page).then((s) => s.length)).toBe(1);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByTestId("export-preview")).toBeVisible({ timeout: 20_000 });
  await chooseOption(page, "Format", "PDF");
  const pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
  expect(pdf.pages[0]!.paintsImages).toBe(0); // the icon is drawn as vector paths, not a bitmap
  expect(pdf.pages[0]!.paintsPaths).toBeGreaterThan(2);
  expect(pdf.pages[0]!.text).toContain("Topic / stream");
  await chooseOption(page, "Format", "PNG");
  expect((await downloadExport(page, "PNG")).buf.subarray(1, 4).toString()).toBe("PNG");
});

test("the components panel is accessible", async ({ page }) => {
  for (const name of [/^Blocks/, /^Tech/, /^Kits/, "Icons", "SVG"]) {
    await tab(page, name).click();
    const axe = await new AxeBuilder({ page }).include("#components-panel").analyze();
    expect(
      axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
      String(name),
    ).toEqual([]);
  }
});

test("credits page lists every bundled icon set with a reachable license file", async ({
  page,
  request,
}) => {
  await page.goto("/credits");
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(6);
  const hrefs = await page
    .locator("table tbody a[href^='/licenses/']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs).toHaveLength(6);
  for (const h of hrefs) {
    const res = await request.get(h);
    expect(res.ok()).toBe(true);
    expect((await res.text()).length).toBeGreaterThan(200);
  }
  await expect(page.getByText("Excalidraw", { exact: false }).first()).toBeVisible();
});
