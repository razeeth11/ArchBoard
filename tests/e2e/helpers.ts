import { expect, type Page } from "@playwright/test";

export async function openEditor(page: Page, path = "/app") {
  await page.goto(path);
  await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("save-status")).toBeVisible();
}

export async function drawRect(page: Page, x = 300, y = 250, w = 160, h = 90) {
  await page.waitForTimeout(100);
  await page.keyboard.press("r");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + w, y + h, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
}

export async function apiReady(page: Page) {
  await page.waitForFunction(() => !!window.__archboard?.api);
}

export async function elementCount(page: Page) {
  await apiReady(page);
  return page.evaluate(() => window.__archboard!.api.getSceneElements().length);
}

export async function elementIds(page: Page) {
  await apiReady(page);
  return page.evaluate(() => window.__archboard!.api.getSceneElements().map((e) => e.id));
}

/** Wait until autosave has committed (status settles on "Saved locally"). */
export const readIdb = <T>(page: Page, store: string, key?: string) =>
  page.evaluate(
    ([s, k]) =>
      new Promise<T>((resolve, reject) => {
        const req = indexedDB.open("archboard");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const os = req.result.transaction(s!).objectStore(s!);
          const r = k ? os.get(k) : os.getAll();
          r.onsuccess = () => resolve(r.result as T);
        };
      }),
    [store, key] as const,
  );

export async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-status")).toContainText("Saved locally");
  await page.waitForTimeout(700); // > debounce, so any trailing save has run
  await expect(page.getByTestId("save-status")).toContainText("Saved locally");
}
