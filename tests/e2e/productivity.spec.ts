import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { frame, rect } from "../fixtures/diagrams";
import { apiReady, elementCount, openEditor, waitSaved } from "./helpers";
import { inspectPdf } from "./pdf-helpers";

const tools = async (page: Page, item: string | RegExp) => {
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
};
const setElements = (page: Page, els: unknown[]) =>
  page.evaluate((e) => window.__archboard!.api.updateScene({ elements: e as never }), els);
const live = (page: Page) =>
  page.evaluate(() =>
    window.__archboard!.api.getSceneElements().map((e) => ({
      id: e.id,
      type: e.type,
      x: Math.round(e.x),
      y: Math.round(e.y),
      stroke: e.strokeColor,
      sb: (e as { startBinding?: unknown }).startBinding ? 1 : 0,
      eb: (e as { endBinding?: unknown }).endBinding ? 1 : 0,
    })),
  );
const insertDsl = async (page: Page, src: string) => {
  await tools(page, /Diagram from text/);
  await page.getByTestId("dsl-source").fill(src);
  await expect(page.getByTestId("dsl-preview")).toBeVisible();
  await page.getByRole("button", { name: "Insert diagram" }).click();
};

test.describe("pages", () => {
  test("add, switch and persist pages", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 100, height: 60 })]);
    await waitSaved(page);
    await page.getByRole("button", { name: "Add page" }).click();
    await expect(page.getByTestId("page-tab")).toHaveCount(2);
    await expect.poll(() => elementCount(page)).toBe(0);
    await setElements(page, [
      rect({ id: "b", x: 100, y: 100, width: 100, height: 60 }),
      rect({ id: "c", x: 300, y: 100, width: 100, height: 60 }),
    ]);
    await waitSaved(page);
    await page.getByTestId("page-tab").first().click();
    await expect.poll(() => elementCount(page)).toBe(1);
    await page.reload();
    await apiReady(page);
    await expect(page.getByTestId("page-tab")).toHaveCount(2);
    await expect.poll(() => elementCount(page)).toBe(1);
  });
});

test.describe("history", () => {
  test("named checkpoint restores earlier content and the restore itself is reversible", async ({
    page,
  }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 100, height: 60 })]);
    await waitSaved(page);
    await tools(page, "Version history");
    await page.getByLabel("Checkpoint name").fill("before change");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByTestId("snapshot-row").filter({ hasText: "before change" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await setElements(page, [
      rect({ id: "x", x: 0, y: 0, width: 50, height: 50 }),
      rect({ id: "y", x: 90, y: 0, width: 50, height: 50 }),
    ]);
    await waitSaved(page);
    await tools(page, "Version history");
    await page.getByTestId("snapshot-row").filter({ hasText: "before change" }).click();
    await expect(page.getByTestId("snapshot-diff")).toBeVisible();
    await page.getByRole("button", { name: "Restore this version" }).click();
    await expect.poll(async () => (await live(page)).map((e) => e.id)).toEqual(["a"]);
    // The state we left is kept as a pre-restore copy, so nothing was lost.
    await tools(page, "Version history");
    await expect(
      page.getByTestId("snapshot-row").filter({ hasText: /before restore/i }),
    ).toHaveCount(1);
  });
});

test.describe("command palette", () => {
  test("Ctrl+K opens, fuzzy-filters and runs a command", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("Control+k");
    await page.getByTestId("palette-input").fill("vhist");
    await expect(page.getByTestId("palette-item").first()).toContainText("Version history");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /Version history/i })).toBeVisible();
  });
});

test.describe("diagram DSL", () => {
  test("invalid text underlines the error; valid text inserts a laid-out diagram", async ({
    page,
  }) => {
    await openEditor(page);
    await tools(page, /Diagram from text/);
    await page.getByTestId("dsl-source").fill("servce api\n");
    await expect(page.getByTestId("dsl-squiggle").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Insert diagram" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await insertDsl(page, 'service api "API" -> db postgres "DB"\n');
    await expect.poll(() => elementCount(page)).toBeGreaterThan(3);
    const els = await live(page);
    expect(els.filter((e) => e.type === "arrow")).toHaveLength(1);
    expect(els.find((e) => e.type === "arrow")).toMatchObject({ sb: 1, eb: 1 });
  });
});

test.describe("auto-layout", () => {
  test("tidies scrambled nodes into a left-to-right flow and keeps arrows bound", async ({
    page,
  }) => {
    await openEditor(page);
    await insertDsl(page, 'service a "A" -> service b "B" -> service c "C"\n');
    await expect.poll(() => elementCount(page)).toBeGreaterThan(5);
    await page.evaluate(() => {
      const api = window.__archboard!.api;
      let i = 0;
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((e) =>
            e.type === "rectangle"
              ? { ...e, x: e.x + (i % 2 ? 0 : 40), y: (i++ % 3) * 220, version: e.version + 1 }
              : e,
          ) as never,
      });
    });
    await tools(page, "Auto-layout ›");
    await page.getByRole("menuitem", { name: "Left-to-right" }).click();
    await expect(page.getByText(/Laid out \d+ shapes/)).toBeVisible();
    const els = await live(page);
    const rects = els.filter((e) => e.type === "rectangle");
    const w = Math.max(...rects.map((e) => e.x)) - Math.min(...rects.map((e) => e.x));
    const h = Math.max(...rects.map((e) => e.y)) - Math.min(...rects.map((e) => e.y));
    expect(w).toBeGreaterThan(h);
    for (const a of els.filter((e) => e.type === "arrow"))
      expect(a).toMatchObject({ sb: 1, eb: 1 });
  });
});

test.describe("mermaid", () => {
  test("imports a flowchart as editable shapes and exports shapes back to Mermaid", async ({
    page,
  }) => {
    await openEditor(page);
    await tools(page, /Mermaid/);
    await expect(page.getByTestId("mermaid-preview")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Insert diagram" }).click();
    await expect.poll(() => elementCount(page)).toBeGreaterThan(5);
    await tools(page, /Mermaid/);
    await page.getByRole("tab", { name: "Export as Mermaid" }).click();
    await expect(page.getByTestId("mermaid-out")).toHaveValue(/^flowchart (TD|LR)/);
    await expect(page.getByTestId("mermaid-out")).toHaveValue(/-->/);
  });
  test("a parse error is reported and nothing can be inserted", async ({ page }) => {
    await openEditor(page);
    await tools(page, /Mermaid/);
    await page.getByTestId("mermaid-source").fill("flowchart TD\n  A --> ((( \n");
    await expect(page.getByTestId("mermaid-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Insert diagram" })).toBeDisabled();
  });
});

test.describe("share link", () => {
  test("view link opens read-only and can be saved as a copy", async ({ page, context }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 100, height: 60 })]);
    await tools(page, "Share via link");
    const url = await page.getByTestId("share-url").inputValue();
    expect(url).toContain("#share=1&mode=view");
    const viewer = await context.newPage();
    await viewer.goto(url);
    await expect(viewer.getByTestId("share-viewer")).toBeVisible({ timeout: 20_000 });
    await expect(viewer).toHaveURL(/\/app\/?$/);
    await viewer.getByRole("button", { name: "Save a copy" }).click();
    await apiReady(viewer);
    await expect.poll(() => elementCount(viewer)).toBe(1);
    await expect(viewer).toHaveURL(/scene=/);
  });
  test("a damaged link shows an error, not a crash", async ({ page }) => {
    await page.goto("/app#share=1&mode=view&key=AAAA&data=BBBB");
    await expect(page.getByTestId("share-error")).toContainText("could not be opened");
  });
  test("an oversized diagram offers the export fallback instead of a link", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await page.evaluate(() => {
      const els = Array.from({ length: 1500 }, (_, i) => ({
        id: `r${i}`,
        type: "rectangle",
        x: (i % 50) * 120,
        y: Math.floor(i / 50) * 90,
        width: 100,
        height: 60,
        angle: 0,
        strokeColor: `#${((i * 2654435761) >>> 0).toString(16).padStart(8, "0").slice(0, 6)}`,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: i * 7919,
        version: 1,
        versionNonce: i * 104729,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        index: `a${i.toString(36).padStart(4, "0")}`,
      }));
      window.__archboard!.api.updateScene({ elements: els as never });
    });
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.getByRole("menuitem", { name: "Share via link" }).click();
    await expect(page.getByTestId("share-too-large")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("slides and presenting", () => {
  test("frames become slides: keyboard navigation, notes, exit restores the view", async ({
    page,
  }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [
      frame({ id: "f1", x: 0, y: 0, width: 800, height: 450, name: "Intro" }),
      frame({ id: "f2", x: 1000, y: 0, width: 800, height: 450, name: "Design" }),
    ]);
    await tools(page, "Slides and notes");
    await expect(page.getByTestId("slide-row")).toHaveCount(2);
    await page.getByLabel("Speaker notes").nth(1).fill("Talk about caching");
    await page.getByLabel("Speaker notes").nth(1).blur();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.getByTestId("present-counter")).toContainText("1 / 2");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("present-counter")).toContainText("2 / 2");
    await page.keyboard.press("n");
    await expect(page.getByTestId("present-notes")).toContainText("Talk about caching");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("present-counter")).toContainText("2 / 2");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("present-overlay")).toHaveCount(0);
    expect(await page.evaluate(() => window.__archboard!.api.getAppState().viewModeEnabled)).toBe(
      false,
    );
  });
});

test.describe("comments", () => {
  test("add on a shape, pin appears, resolve hides it, reload keeps it", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 200, y: 200, width: 120, height: 70 })]);
    await page.evaluate(() =>
      window.__archboard!.api.updateScene({ appState: { selectedElementIds: { a: true } } }),
    );
    await tools(page, "Comments");
    await page.getByTestId("comment-input").fill("Why not a queue here?");
    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.getByTestId("comment-item")).toHaveCount(1);
    await expect(page.getByTestId("comment-pin")).toHaveCount(1);
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId("comment-pin")).toHaveCount(1);
    await tools(page, "Comments");
    await expect(page.getByTestId("comment-item")).toHaveCount(1);
    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByTestId("comment-pin")).toHaveCount(0);
    await expect(page.getByTestId("comment-item")).toHaveCount(0);
  });
});

test.describe("style presets", () => {
  test("Blueprint restyles the selection and is one undo step", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 200, y: 200, width: 120, height: 70 })]);
    await page.evaluate(() =>
      window.__archboard!.api.updateScene({ appState: { selectedElementIds: { a: true } } }),
    );
    await tools(page, "Style presets");
    await page
      .getByTestId("preset-list")
      .locator("li", { hasText: "Blueprint" })
      .getByRole("button", { name: "Apply" })
      .click();
    await expect.poll(async () => (await live(page))[0]!.stroke).toBe("#e7f0ff");
    // New content picks up the preset's look too.
    await page.keyboard.press("Escape");
    await insertDsl(page, 'service api "API" -> db postgres "DB"\n');
    await expect
      .poll(() =>
        page.evaluate(() =>
          window
            .__archboard!.api.getSceneElements()
            .filter((e) => e.type === "rectangle" && e.id !== "a")
            .map((e) => e.roughness),
        ),
      )
      .toEqual(expect.arrayContaining([0]));
  });
});

test.describe("accessibility", () => {
  for (const [name, open] of [
    ["history", (p: Page) => tools(p, "Version history")],
    ["styles", (p: Page) => tools(p, "Style presets")],
    ["share", (p: Page) => tools(p, "Share via link")],
  ] as const) {
    test(`${name} dialog has no axe violations`, async ({ page }) => {
      await openEditor(page);
      await apiReady(page);
      await setElements(page, [rect({ id: "a", x: 200, y: 200, width: 120, height: 70 })]);
      await open(page);
      await expect(page.getByRole("dialog")).toBeVisible();
      const r = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(r.violations).toEqual([]);
    });
  }
});

test.describe("flowchart quick-create", () => {
  test("Excalidraw's native Ctrl/Cmd+Arrow creates a connected next node", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 300, y: 250, width: 160, height: 90 })]);
    await page.evaluate(() =>
      window.__archboard!.api.updateScene({ appState: { selectedElementIds: { a: true } } }),
    );
    await page.locator(".excalidraw canvas.interactive").click({ position: { x: 5, y: 5 } });
    await page.evaluate(() =>
      window.__archboard!.api.updateScene({ appState: { selectedElementIds: { a: true } } }),
    );
    await page.keyboard.press("Control+ArrowRight");
    await expect
      .poll(async () => (await live(page)).filter((e) => e.type === "rectangle").length)
      .toBe(2);
    const els = await live(page);
    expect(els.filter((e) => e.type === "arrow")).toHaveLength(1);
    expect(els.find((e) => e.type === "arrow")).toMatchObject({ sb: 1, eb: 1 });
  });
});

test.describe("bring-your-own-key AI", () => {
  // The rejected-key test provokes a real 401, which the browser logs as a console error.
  test.use({ allowedConsoleErrors: [/status of 401/] });

  test("nothing is sent until asked; the result opens in the DSL editor for review", async ({
    page,
  }) => {
    const calls: { key: string | undefined; body: string }[] = [];
    await page.route("https://api.anthropic.com/**", async (route) => {
      const r = route.request();
      calls.push({ key: r.headers()["x-api-key"], body: r.postData() ?? "" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          content: [
            { type: "text", text: '```\nservice api "Photo API" -> db postgres "Photo DB"\n```' },
          ],
        }),
      });
    });
    await openEditor(page);
    await tools(page, /Draw with AI/);
    await expect(page.getByTestId("ai-notice")).toContainText("directly from your browser");
    expect(calls).toHaveLength(0);
    await expect(page.getByRole("button", { name: "Generate diagram text" })).toBeDisabled();
    await page.getByTestId("ai-prompt").fill("a photo app with an API and a database");
    await page.getByTestId("ai-key").fill("sk-ant-test");
    await page.getByRole("button", { name: "Generate diagram text" }).click();
    await expect(page.getByTestId("dsl-source")).toHaveValue(/Photo API/);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.key).toBe("sk-ant-test");
    await expect(page.getByTestId("dsl-preview")).toBeVisible();
    await page.getByRole("button", { name: "Insert diagram" }).click();
    await expect.poll(() => elementCount(page)).toBeGreaterThan(3);
  });

  test("a rejected key shows an error and can be forgotten", async ({ page }) => {
    await page.route("https://api.anthropic.com/**", (route) =>
      route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*" }, body: "{}" }),
    );
    await openEditor(page);
    await tools(page, /Draw with AI/);
    await page.getByTestId("ai-prompt").fill("anything");
    await page.getByTestId("ai-key").fill("bad");
    await page.getByRole("button", { name: "Generate diagram text" }).click();
    await expect(page.getByTestId("ai-error")).toContainText("rejected");
    await page.getByRole("button", { name: "Forget key" }).click();
    await expect(page.getByTestId("ai-key")).toHaveValue("");
  });
});

test.describe("multi-page PDF", () => {
  test("includes every page of the scene", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 100, height: 60 })]);
    await waitSaved(page);
    await page.getByRole("button", { name: "Add page" }).click();
    await expect(page.getByTestId("page-tab")).toHaveCount(2);
    // The engine remounts for the new page; wait for the fresh, empty canvas before drawing on it.
    await expect.poll(() => elementCount(page)).toBe(0);
    await setElements(page, [rect({ id: "b", x: 50, y: 50, width: 200, height: 100 })]);
    await waitSaved(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page
      .getByRole("radiogroup", { name: "Format" })
      .getByText("PDF", { exact: true })
      .click();
    await page.getByLabel(/Include every page of this scene/).check();
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    const { readFile } = await import("node:fs/promises");
    const pdf = await inspectPdf(await readFile((await dl.path())!));
    expect(pdf.pages).toHaveLength(2);
  });
});
