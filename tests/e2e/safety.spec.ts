import { expect, test } from "./fixtures";
import { drawRect, elementCount, openEditor, waitSaved } from "./helpers";

test("two tabs on the same scene: second tab's edit prompts the first, merge keeps both", async ({
  context,
}) => {
  const a = await context.newPage();
  await openEditor(a);
  await drawRect(a);
  await waitSaved(a);

  const b = await context.newPage();
  await openEditor(b, a.url());
  await expect.poll(() => elementCount(b)).toBe(1);
  await drawRect(b, 520, 300);
  await waitSaved(b);

  // Tab A is told about the external update...
  await expect(a.getByRole("dialog", { name: /updated in another tab/ })).toBeVisible();
  // ...and its own edit made now conflicts instead of silently overwriting.
  await a.getByRole("button", { name: "Merge" }).click();
  await expect(a.getByRole("dialog", { name: /updated in another tab/ })).toBeHidden();
  await expect.poll(() => elementCount(a)).toBe(2);
  await waitSaved(a);

  await a.reload();
  await expect.poll(() => elementCount(a)).toBe(2);
});

test("conflicting save is blocked and 'Reload latest' restores the other tab's data", async ({
  context,
}) => {
  const a = await context.newPage();
  await openEditor(a);
  await drawRect(a);
  await waitSaved(a);
  const b = await context.newPage();
  await openEditor(b, a.url());
  await drawRect(b, 520, 300);
  await waitSaved(b);

  await expect(a.getByRole("dialog", { name: /updated in another tab/ })).toBeVisible();
  await a.getByRole("button", { name: /Reload latest/ }).click();
  await expect.poll(() => elementCount(a)).toBe(2);
});

test("corrupt scene opens a recovery dialog, keeps raw data, and offers another scene", async ({
  page,
}) => {
  await openEditor(page);
  await drawRect(page);
  await waitSaved(page);
  const sceneId = new URL(page.url()).searchParams.get("scene")!;

  // Create a second healthy scene so recovery has somewhere to go, then corrupt the first.
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await page.getByRole("button", { name: "New scene" }).click();
  await waitSaved(page);
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("archboard");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("pages", "readwrite");
          const store = tx.objectStore("pages");
          const idx = store.index("sceneId").getAll(id);
          idx.onsuccess = () => {
            for (const p of idx.result) store.put({ ...p, elements: "garbage" });
          };
          tx.oncomplete = () => resolve();
        };
      }),
    sceneId,
  );

  await page.goto(`/app?scene=${sceneId}`);
  const dlg = page.getByRole("dialog", { name: "This scene could not be opened" });
  await expect(dlg).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dlg.getByRole("button", { name: "Download raw data" }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(sceneId);
  await dlg.getByRole("button", { name: /^Open/ }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible();
});

test("backup downloads valid JSON and import restores it as new scenes", async ({ page }) => {
  await openEditor(page);
  await drawRect(page);
  await waitSaved(page);
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Backup", exact: true }).click(),
  ]);
  const path = await dl.path();
  const fs = await import("node:fs/promises");
  const data = JSON.parse(await fs.readFile(path, "utf8"));
  expect(data.type).toBe("archboard-backup");
  expect(data.scenes.length).toBeGreaterThanOrEqual(1);

  await page.getByTestId("import-input").setInputFiles(path);
  await expect(page.getByTestId("scene-row")).toHaveCount(data.scenes.length * 2);
});
