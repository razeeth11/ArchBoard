import { expect, test } from "./fixtures";
import {
  apiReady,
  drawRect,
  elementCount,
  elementIds,
  openEditor,
  readIdb,
  waitSaved,
} from "./helpers";

test("draw, hard reload: everything is still there, in the same scene", async ({ page }) => {
  await openEditor(page);
  await drawRect(page);
  await drawRect(page, 520, 300);
  expect(await elementCount(page)).toBe(2);
  const ids = await elementIds(page);
  await waitSaved(page);

  await page.reload();
  await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible();
  await expect.poll(() => elementCount(page)).toBe(2);
  expect(await elementIds(page)).toEqual(ids);
  await expect(page).toHaveURL(/\?scene=/);
});

test("changes flush when the tab is hidden, before the debounce fires", async ({ page }) => {
  await openEditor(page);
  await drawRect(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  await page.reload();
  await expect.poll(() => elementCount(page)).toBe(1);
});

test("multiple scenes: create, switch, rename, duplicate, trash with undo", async ({ page }) => {
  await openEditor(page);
  await drawRect(page);
  await waitSaved(page);
  const firstUrl = page.url();

  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await page.getByRole("button", { name: "New scene" }).click();
  await expect.poll(() => page.url()).not.toBe(firstUrl);
  await expect.poll(() => elementCount(page)).toBe(0);
  await drawRect(page);
  await drawRect(page, 520, 300);
  await waitSaved(page);

  const rows = page.getByTestId("scene-row");
  await expect(rows).toHaveCount(2);

  // switch back to the first scene (older one is the second row)
  await rows.nth(1).getByRole("button").first().click();
  await expect.poll(() => elementCount(page)).toBe(1);

  // rename via menu
  await rows
    .nth(1)
    .getByRole("button", { name: /Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Scene name").fill("Order service");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Order service", exact: true })).toBeVisible();

  // duplicate
  await page.getByRole("button", { name: "Actions for Order service", exact: true }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(rows).toHaveCount(3);
  await expect.poll(() => elementCount(page)).toBe(1);

  // trash + undo
  await page.getByRole("button", { name: /Actions for Order service \(copy\)/ }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expect(page.getByText(/Moved .* to trash/)).toBeVisible();
  await expect(rows).toHaveCount(2);
  await page
    .getByRole("region", { name: "Notifications" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(rows).toHaveCount(3);

  // everything survives a reload
  await page.reload();
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await expect(page.getByTestId("scene-row")).toHaveCount(3);
});

test("images are stored as deduplicated blobs and survive reload", async ({ page }) => {
  await openEditor(page);
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await page.evaluate(async (dataURL) => {
    const api = window.__archboard!.api;
    // Two distinct file ids carrying identical bytes must collapse to one stored blob.
    api.addFiles([
      { id: "fileA", mimeType: "image/png", dataURL, created: Date.now() },
      { id: "fileB", mimeType: "image/png", dataURL, created: Date.now() },
    ] as never);
    const mk = (id: string, fileId: string, x: number) => ({
      id,
      type: "image",
      fileId,
      x,
      y: 100,
      width: 80,
      height: 80,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 1,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      status: "saved",
      scale: [1, 1],
      index: null,
      crop: null,
    });
    api.updateScene({ elements: [mk("imgA", "fileA", 100), mk("imgB", "fileB", 300)] as never });
  }, png);
  await waitSaved(page);

  const pages = await readIdb<{ fileRefs: Record<string, { hash: string }> }[]>(page, "pages");
  const hashes = pages.flatMap((p) => Object.values(p.fileRefs).map((r) => r.hash));
  expect(hashes).toHaveLength(2);
  expect(new Set(hashes).size).toBe(1); // identical bytes stored once
  const blobs = await readIdb<{ hash: string }[]>(page, "blobs");
  expect(blobs.filter((b) => b.hash === hashes[0])).toHaveLength(1);

  await page.reload();
  await expect.poll(() => elementCount(page)).toBe(2);
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.__archboard!.api.getFiles()).sort()))
    .toEqual(["fileA", "fileB"]);
});

test("library and settings survive reload", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() =>
    window.__archboard!.api.updateLibrary({
      libraryItems: [
        {
          id: "lib-1",
          status: "unpublished",
          created: Date.now(),
          elements: [
            {
              id: "lr",
              type: "rectangle",
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              angle: 0,
              strokeColor: "#000",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              strokeStyle: "solid",
              roughness: 1,
              opacity: 100,
              groupIds: [],
              frameId: null,
              roundness: null,
              seed: 1,
              version: 1,
              versionNonce: 1,
              isDeleted: false,
              boundElements: null,
              updated: 1,
              link: null,
              locked: false,
              index: "a0",
            },
          ],
        },
      ] as never,
      merge: false,
    }),
  );
  await page.getByRole("button", { name: /^Theme:/ }).click(); // system → light
  await page.getByRole("button", { name: /^Theme:/ }).click(); // light → dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(
      async () =>
        (await readIdb<{ items: unknown[] } | undefined>(page, "libraries", "default"))?.items
          .length ?? 0,
    )
    .toBe(1);
});

test("viewport (scroll/zoom) is restored", async ({ page }) => {
  await openEditor(page);
  await drawRect(page);
  await apiReady(page);
  await page.evaluate(() =>
    window.__archboard!.api.updateScene({
      appState: { zoom: { value: 1.5 }, scrollX: 120, scrollY: -40 } as never,
    }),
  );
  await waitSaved(page);
  await page.reload();
  await apiReady(page);
  await expect
    .poll(() => page.evaluate(() => window.__archboard!.api.getAppState().zoom.value))
    .toBeCloseTo(1.5, 2);
  expect(await page.evaluate(() => window.__archboard!.api.getAppState().scrollX)).toBeCloseTo(
    120,
    0,
  );
});
