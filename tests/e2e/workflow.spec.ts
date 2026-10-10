import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { rect } from "../fixtures/diagrams";
import { apiReady, elementCount, openEditor, waitSaved } from "./helpers";

const state = (page: Page) =>
  page.evaluate(() => {
    const api = window.__archboard!.api;
    return {
      tool: api.getAppState().activeTool.type,
      locked: api.getAppState().activeTool.locked,
      els: api.getSceneElements().map((e) => ({
        id: e.id,
        type: e.type,
        w: Math.round(e.width),
        h: Math.round(e.height),
        x: Math.round(e.x),
        text: (e as { text?: string }).text,
      })),
    };
  });
const drag = async (page: Page, x1: number, y1: number, x2: number, y2: number) => {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 5 });
  await page.mouse.up();
};

test.describe("tool stays active", () => {
  test("the chosen tool is kept after drawing, until the user picks another", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await page.keyboard.press("r");
    await drag(page, 300, 250, 400, 320);
    await drag(page, 450, 250, 550, 320);
    const s = await state(page);
    expect(s.els.filter((e) => e.type === "rectangle")).toHaveLength(2);
    expect(s.tool).toBe("rectangle");
    expect(s.locked).toBe(true);
    await page.keyboard.press("v");
    expect((await state(page)).tool).toBe("selection");
  });

  test("clicking the padlock turns it off and the choice is remembered", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    // The padlock in the toolbar; Q is its keyboard shortcut.
    await page.keyboard.press("q");
    await expect.poll(async () => (await state(page)).locked).toBe(false);
    await page.keyboard.press("r");
    await drag(page, 300, 250, 400, 320);
    expect((await state(page)).tool).toBe("selection"); // reverts, as the user asked
    await waitSaved(page);
    await page.reload();
    await apiReady(page);
    await expect.poll(async () => (await state(page)).locked).toBe(false);
  });
});

test.describe("new editor and recent scenes", () => {
  test("opening /app always starts a fresh whiteboard; an untouched empty one is reused", async ({
    page,
  }) => {
    await page.goto("/app");
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 20_000 });
    const first = new URL(page.url()).searchParams.get("scene");
    expect(first).toBeTruthy();
    await page.goto("/app");
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("scene")).toBe(first); // still empty: reused, no pile-up

    await apiReady(page);
    await page.evaluate(
      (e) => window.__archboard!.api.updateScene({ elements: e as never }),
      [rect({ id: "a", x: 100, y: 100, width: 120, height: 60 })],
    );
    await waitSaved(page);
    await page.goto("/app");
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible();
    await apiReady(page);
    const second = new URL(page.url()).searchParams.get("scene");
    expect(second).not.toBe(first);
    expect(await elementCount(page)).toBe(0);
  });

  test("a reload keeps the same scene (the id is in the address)", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await page.evaluate(
      (e) => window.__archboard!.api.updateScene({ elements: e as never }),
      [rect({ id: "a", x: 100, y: 100, width: 120, height: 60 })],
    );
    await waitSaved(page);
    const url = page.url();
    await page.reload();
    await apiReady(page);
    expect(page.url()).toBe(url);
    expect(await elementCount(page)).toBe(1);
  });

  test("home lists recent scenes; choosing one resumes it, New whiteboard starts another", async ({
    page,
  }) => {
    await openEditor(page);
    await apiReady(page);
    await page.evaluate(
      (e) => window.__archboard!.api.updateScene({ elements: e as never }),
      [rect({ id: "a", x: 100, y: 100, width: 120, height: 60 })],
    );
    await waitSaved(page);
    const sceneId = new URL(page.url()).searchParams.get("scene")!;
    await page.goto("/");
    const recent = page.getByTestId("recent-scenes");
    await expect(recent).toBeVisible({ timeout: 15_000 });
    await expect(recent.getByTestId("recent-item")).toHaveCount(1);
    await recent.getByTestId("recent-item").click();
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 20_000 });
    expect(new URL(page.url()).searchParams.get("scene")).toBe(sceneId);
    await apiReady(page);
    expect(await elementCount(page)).toBe(1);

    await page.goto("/");
    await page.getByTestId("recent-scenes").getByRole("link", { name: "New whiteboard" }).click();
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 20_000 });
    await apiReady(page);
    expect(new URL(page.url()).searchParams.get("scene")).not.toBe(sceneId);
    expect(await elementCount(page)).toBe(0);
  });

  test("the home page shows no recent section when there is nothing to resume", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("recent-scenes")).toHaveCount(0);
  });
});

test.describe("automatic lists", () => {
  const typeInShape = async (page: Page, steps: string[]) => {
    await openEditor(page);
    await apiReady(page);
    await page.keyboard.press("r");
    await drag(page, 300, 250, 520, 350);
    await page.keyboard.press("v");
    await page.mouse.dblclick(410, 300);
    for (const s of steps) {
      if (s === "\n") await page.keyboard.press("Enter");
      else await page.keyboard.type(s);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    return (await state(page)).els.find((e) => e.type === "text")?.text;
  };

  test("a bullet list continues on Enter and ends on an empty item", async ({ page }) => {
    const text = await typeInShape(page, ["- first", "\n", "second", "\n", "\n", "after"]);
    expect(text).toBe("- first\n- second\nafter");
  });

  test("a numbered list counts up", async ({ page }) => {
    const text = await typeInShape(page, ["1. one", "\n", "two", "\n", "three"]);
    expect(text).toBe("1. one\n2. two\n3. three");
  });

  test("Ctrl+Shift+8 turns lines into bullets", async ({ page }) => {
    const text = await typeInShape(page, ["a", "\n", "b"]).then(async () => {
      await page.mouse.dblclick(410, 300);
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Control+Shift+8");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      return (await state(page)).els.find((e) => e.type === "text")?.text;
    });
    expect(text).toBe("• a\n• b");
  });
});

test.describe("labels fit their shapes", () => {
  test("a diagram with long labels wraps them inside the shapes", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.getByRole("menuitem", { name: /Diagram from text/ }).click();
    await page
      .getByTestId("dsl-source")
      .fill(
        'service a "Orders service with a really quite long descriptive name" -> db postgres "Primary customer database cluster (eu-west)"\n',
      );
    await expect(page.getByTestId("dsl-preview")).toBeVisible();
    await page.getByRole("button", { name: "Insert diagram" }).click();
    await expect.poll(() => elementCount(page)).toBeGreaterThan(4);
    const bad = await page.evaluate(() => {
      const els = window.__archboard!.api.getSceneElements() as unknown as {
        id: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        containerId?: string;
        text?: string;
      }[];
      const byId = new Map(els.map((e) => [e.id, e]));
      return els
        .filter((e) => e.type === "text" && e.containerId && byId.has(e.containerId))
        .filter((t) => {
          const c = byId.get(t.containerId!)!;
          return (
            t.x < c.x - 1 ||
            t.x + t.width > c.x + c.width + 1 ||
            t.y < c.y - 1 ||
            t.y + t.height > c.y + c.height + 1
          );
        })
        .map((t) => t.text);
    });
    expect(bad).toEqual([]);
  });
});

test.describe("design panel", () => {
  test("numeric position, size and opacity edit the selection, undoably", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await openEditor(page);
    await apiReady(page);
    await page.evaluate(
      (e) => {
        const api = window.__archboard!.api;
        // Its own history step, like a drawn shape, so undo reverts only the panel edits.
        api.updateScene({
          elements: e as never,
          appState: { selectedElementIds: { a: true } },
          captureUpdate: "IMMEDIATELY" as never,
        });
      },
      [rect({ id: "a", x: 100, y: 100, width: 200, height: 100 })],
    );
    const panel = page.getByTestId("design-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Width")).toHaveValue("200");
    await panel.getByLabel("Width").fill("300");
    await panel.getByLabel("Width").press("Enter");
    // "Lock proportions" is on by default: the height follows.
    await expect.poll(async () => (await state(page)).els[0]).toMatchObject({ w: 300, h: 150 });
    await panel.getByLabel("X position").fill("50");
    await panel.getByLabel("X position").press("Enter");
    await expect.poll(async () => (await state(page)).els[0]!.x).toBe(50);
    await panel.getByLabel("Opacity").fill("40");
    await panel.getByLabel("Opacity").press("Enter");
    await expect
      .poll(() => page.evaluate(() => window.__archboard!.api.getSceneElements()[0]!.opacity))
      .toBe(40);
    await page.getByLabel("Lock proportions").uncheck();
    await panel.getByLabel("Height").fill("60");
    await panel.getByLabel("Height").press("Enter");
    await expect.poll(async () => (await state(page)).els[0]).toMatchObject({ w: 300, h: 60 });
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await state(page)).els[0]!.h).toBe(150);
  });

  test("it can be hidden from the Tools menu", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await openEditor(page);
    await apiReady(page);
    await page.evaluate(
      (e) =>
        window.__archboard!.api.updateScene({
          elements: e as never,
          appState: { selectedElementIds: { a: true } },
        }),
      [rect({ id: "a", x: 100, y: 100, width: 200, height: 100 })],
    );
    await expect(page.getByTestId("design-panel")).toBeVisible();
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.getByRole("menuitem", { name: "Design panel" }).click();
    await expect(page.getByTestId("design-panel")).toHaveCount(0);
  });
});
