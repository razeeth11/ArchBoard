import { expect, type Download, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { apiReady } from "./helpers";
import type { Diagram } from "../fixtures/diagrams";

export async function loadDiagram(page: Page, d: Diagram) {
  await apiReady(page);
  await page.evaluate((elements) => {
    const api = window.__archboard!.api;
    api.updateScene({ elements: elements as never });
    api.scrollToContent(undefined, { fitToContent: true });
  }, d.elements);
}

export async function openExport(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Export" })).toBeVisible();
  await expect(page.getByTestId("export-preview")).toBeVisible({ timeout: 20_000 });
}

export async function chooseOption(page: Page, group: string, label: string) {
  await page.getByRole("radiogroup", { name: group }).getByText(label, { exact: true }).click();
}

export async function downloadExport(
  page: Page,
  format: string,
): Promise<{ dl: Download; buf: Buffer }> {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: `Download ${format}` }).click(),
  ]);
  const path = await dl.path();
  return { dl, buf: await readFile(path) };
}
