import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { rect } from "../fixtures/diagrams";
import { chooseOption, downloadExport, openExport } from "./export-helpers";
import { apiReady, elementCount, openEditor, waitSaved } from "./helpers";

const setElements = (page: Page, els: unknown[]) =>
  page.evaluate((e) => window.__archboard!.api.updateScene({ elements: e as never }), els);

async function runFeatures(page: Page) {
  await openEditor(page);
  await apiReady(page);
  await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 160, height: 80 })]);

  // DSL (ELK worker + icons)
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitem", { name: /Diagram from text/ }).click();
  await page.getByTestId("dsl-source").fill('service api "API" -> db postgres "DB"\n');
  await expect(page.getByTestId("dsl-preview")).toBeVisible();
  await page.getByRole("button", { name: "Insert diagram" }).click();
  await expect.poll(() => elementCount(page)).toBeGreaterThan(4);

  // Mermaid (lazy library)
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitem", { name: /Mermaid/ }).click();
  await expect(page.getByTestId("mermaid-preview")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  // Export: PNG, SVG with text outlined (wasm font decoding), PDF
  for (const [fmt, name] of [
    ["PNG", "PNG"],
    ["SVG", "SVG"],
    ["PDF", "PDF"],
  ] as const) {
    await openExport(page);
    await chooseOption(page, "Format", name);
    const { buf } = await downloadExport(page, fmt);
    expect(buf.length).toBeGreaterThan(500);
    await page.keyboard.press("Escape");
  }

  // History and share (WebCrypto, compression streams)
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share via link" }).click();
  await expect(page.getByTestId("share-url")).toHaveValue(/#share=/);
  await page.keyboard.press("Escape");
}

test.describe("offline (service worker)", () => {
  test("after one visit the editor reloads and keeps working with no network", async ({
    page,
    context,
  }) => {
    await openEditor(page);
    await apiReady(page);
    await setElements(page, [rect({ id: "a", x: 100, y: 100, width: 120, height: 60 })]);
    await waitSaved(page);
    // The worker installs after first load; wait until it controls the page and the shell is cached.
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.active) return false;
        const keys = await caches.keys();
        const pre = keys.find((k) => k.startsWith("archboard-precache-"));
        return !!pre && (await (await caches.open(pre)).keys()).length > 20;
      },
      null,
      { timeout: 60_000 },
    );
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 30_000 });
    await apiReady(page);
    await expect.poll(() => elementCount(page)).toBe(1);
    // Editing and saving still work without a connection.
    await setElements(page, [
      rect({ id: "a", x: 100, y: 100, width: 120, height: 60 }),
      rect({ id: "b", x: 300, y: 100, width: 120, height: 60 }),
    ]);
    await waitSaved(page);
    expect(failed).toEqual([]);
    await context.setOffline(false);
  });

  test("the worker never answers cross-origin requests or caches user data", async ({ page }) => {
    await openEditor(page);
    const src = await page.evaluate(() => fetch("/sw.js").then((r) => r.text()));
    expect(src).toContain("url.origin !== self.location.origin");
    expect(src).not.toMatch(/indexedDB/);
  });
});

test.describe("content security policy", () => {
  const csp = readFileSync("out/csp.txt", "utf8").trim();
  // The font decoder worker ships with its own policy (it needs eval; the page must not).
  const workerCsp = /woff2-worker\.js\n\s+Content-Security-Policy: (.+)/.exec(
    readFileSync("out/_headers", "utf8"),
  )![1]!;

  test("ships without unsafe-eval and with hashed inline scripts", () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/script-src[^;]*'sha256-/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  // Excalidraw lists a third-party font fallback (esm.sh) beside each local font URL. The policy blocks
  // it, which only logs a console message; the local copies always load (see the no-third-party test).
  test.use({ allowedConsoleErrors: [/esm\.sh\/@excalidraw/] });

  test("every major feature works under the shipped policy with zero other violations", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        (window as unknown as { __csp: string[] }).__csp.push(
          `${e.violatedDirective} ${e.blockedURI}`,
        ),
      );
    });
    await page.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (type === "worker" && route.request().url().endsWith("woff2-worker.js")) {
        const res = await route.fetch();
        return route.fulfill({
          response: res,
          headers: { ...res.headers(), "content-security-policy": workerCsp },
        });
      }
      if (type !== "document") return route.continue();
      const res = await route.fetch();
      await route.fulfill({
        response: res,
        headers: { ...res.headers(), "content-security-policy": csp },
      });
    });
    await runFeatures(page);
    await waitSaved(page);
    const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(violations.filter((v) => !/esm\.sh\/@excalidraw/.test(v))).toEqual([]);
  });
});

test("no request ever leaves the origin during normal use", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", ""].includes(u.hostname) && u.protocol.startsWith("http"))
      external.push(r.url());
  });
  await runFeatures(page);
  await waitSaved(page);
  expect(external).toEqual([]);
});

test.describe("scale", () => {
  test("5,000 elements load, save and restore after a reload", async ({ page }) => {
    await openEditor(page);
    await apiReady(page);
    const t0 = Date.now();
    await page.evaluate(() => {
      const els = Array.from({ length: 5000 }, (_, i) => ({
        id: `r${i}`,
        type: "rectangle",
        x: (i % 100) * 140,
        y: Math.floor(i / 100) * 100,
        width: 120,
        height: 70,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: i + 1,
        version: 1,
        versionNonce: i + 7,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        index: `a${i.toString(36).padStart(5, "0")}`,
      }));
      window.__archboard!.api.updateScene({ elements: els as never });
    });
    await expect.poll(() => elementCount(page)).toBe(5000);
    await waitSaved(page);
    const saveMs = Date.now() - t0;
    await page.reload();
    await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible({ timeout: 30_000 });
    await apiReady(page);
    await expect.poll(() => elementCount(page), { timeout: 30_000 }).toBe(5000);
    console.log(`5k elements: set+save ${saveMs} ms`);
    expect(saveMs).toBeLessThan(20_000);
  });
});
