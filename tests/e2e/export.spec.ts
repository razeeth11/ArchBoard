import AxeBuilder from "@axe-core/playwright";
import { PNG } from "pngjs";
import { expect, test } from "./fixtures";
import { diagrams, frame, rect } from "../fixtures/diagrams";
import { chooseOption, downloadExport, loadDiagram, openExport } from "./export-helpers";
import { apiReady, openEditor, readIdb, waitSaved } from "./helpers";
import { inspectPdf } from "./pdf-helpers";

const [clientServer, , textFonts, , framed] = diagrams();
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.beforeEach(async ({ page }) => {
  await openEditor(page);
  await loadDiagram(page, clientServer!);
  await openExport(page);
});

test("opens from the toolbar and the keyboard shortcut, and is accessible", async ({ page }) => {
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export" })).toBeHidden();
  await page.keyboard.press("Control+Shift+E");
  await expect(page.getByRole("dialog", { name: "Export" })).toBeVisible();
});

test.describe("PNG", () => {
  test("is a valid PNG at 1x–4x with padding", async ({ page }) => {
    // Content is 480×80; default padding 16 → 512×112 at 1x.
    const sizes: Record<string, [number, number]> = {
      "1×": [512, 112],
      "2×": [1024, 224],
      "3×": [1536, 336],
      "4×": [2048, 448],
    };
    for (const [label, [w, h]] of Object.entries(sizes)) {
      await chooseOption(page, "Scale", label);
      const { buf, dl } = await downloadExport(page, "PNG");
      expect(dl.suggestedFilename()).toMatch(/^untitled-\d{4}-\d{2}-\d{2}\.png$/);
      expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
      const png = PNG.sync.read(buf);
      expect([png.width, png.height]).toEqual([w, h]);
    }
    await chooseOption(page, "Scale", "1×");
    await page.getByLabel(/^Padding/).fill("0");
    const png = PNG.sync.read((await downloadExport(page, "PNG")).buf);
    expect([png.width, png.height]).toEqual([480, 80]);
  });

  test("transparent and solid backgrounds, light and dark", async ({ page }) => {
    await chooseOption(page, "Scale", "1×");
    const corner = (buf: Buffer) => {
      const p = PNG.sync.read(buf);
      return Array.from(p.data.subarray(0, 4));
    };
    expect(corner((await downloadExport(page, "PNG")).buf)).toEqual([255, 255, 255, 255]);

    await chooseOption(page, "Background", "Transparent");
    expect(corner((await downloadExport(page, "PNG")).buf)[3]).toBe(0);

    await chooseOption(page, "Background", "Solid");
    await page.getByLabel("Dark mode").check();
    const dark = corner((await downloadExport(page, "PNG")).buf);
    expect(dark[3]).toBe(255);
    expect(dark[0]!).toBeLessThan(60);
  });

  test("embedded scene data round-trips through import", async ({ page }) => {
    await page.getByLabel("Embed scene data").check();
    const { buf, dl } = await downloadExport(page, "PNG");
    expect(buf.includes(Buffer.from("tEXt"))).toBe(true);
    expect(buf.includes(Buffer.from("excalidraw"))).toBe(true);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Scenes", exact: true }).click();
    await page
      .getByTestId("import-input")
      .setInputFiles({ name: dl.suggestedFilename(), mimeType: "image/png", buffer: buf });
    await expect(page.getByTestId("scene-row")).toHaveCount(2);
    await page.getByTestId("scene-row").first().getByRole("button").first().click();
    await expect
      .poll(() => page.evaluate(() => window.__archboard!.api.getSceneElements().length))
      .toBe(5);
  });

  test("refuses rasters bigger than the browser can render, with a helpful message", async ({
    page,
  }) => {
    await apiReady(page);
    await page.evaluate(() => {
      const api = window.__archboard!.api;
      const els = api.getSceneElements().slice();
      api.updateScene({
        elements: [{ ...els[0]!, width: 9000, height: 100, version: 9, versionNonce: 9 }] as never,
      });
    });
    await page.keyboard.press("Escape");
    await openExport(page).catch(() => undefined);
    await chooseOption(page, "Scale", "4×");
    await expect(page.getByTestId("size-info")).toContainText("larger than your browser");
    await page.getByRole("button", { name: "Download PNG" }).click();
    await expect(page.getByRole("alert")).toContainText("Lower the scale or export as SVG/PDF");
  });

  test("copies a PNG to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy PNG" }).click();
    await expect(page.getByText("Copied PNG to the clipboard.")).toBeVisible();
    const sig = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const blob = await items[0]!.getType("image/png");
      return Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8));
    });
    expect(Buffer.from(sig)).toEqual(PNG_SIG);
  });
});

test.describe("SVG", () => {
  const parse = (page: import("@playwright/test").Page, text: string) =>
    page.evaluate((t) => {
      const doc = new DOMParser().parseFromString(t, "image/svg+xml");
      const svg = doc.documentElement;
      return {
        error: doc.querySelector("parsererror")?.textContent ?? null,
        root: svg.tagName,
        role: svg.getAttribute("role"),
        title: svg.querySelector("title")?.textContent ?? null,
        desc: svg.querySelector("desc")?.textContent ?? null,
        texts: svg.querySelectorAll("text").length,
        paths: svg.querySelectorAll("path").length,
        fontFaces: (t.match(/@font-face/g) ?? []).length,
        viewBox: svg.getAttribute("viewBox"),
      };
    }, text);

  test("is well-formed, keeps text as text, and carries title/description", async ({ page }) => {
    await chooseOption(page, "Format", "SVG");
    await page.getByLabel("Title").fill("Client to server");
    await page.getByLabel(/^Description/).fill("A client sends requests to a server.");
    const { buf, dl } = await downloadExport(page, "SVG");
    expect(dl.suggestedFilename()).toMatch(/^client-to-server-.*\.svg$/);
    const info = await parse(page, buf.toString("utf8"));
    expect(info.error).toBeNull();
    expect(info.root).toBe("svg");
    expect(info.role).toBe("img");
    expect(info.title).toBe("Client to server");
    expect(info.desc).toBe("A client sends requests to a server.");
    expect(info.texts).toBe(2);
    expect(info.fontFaces).toBeGreaterThan(0);
    expect(info.viewBox).toBe("0 0 512 112");
  });

  test("text can be converted to outlines so fonts never break", async ({ page }) => {
    await chooseOption(page, "Format", "SVG");
    const keep = await parse(page, (await downloadExport(page, "SVG")).buf.toString("utf8"));
    await page.getByLabel("Convert text to outlines").check();
    const out = await parse(page, (await downloadExport(page, "SVG")).buf.toString("utf8"));
    expect(out.error).toBeNull();
    expect(out.texts).toBe(0);
    expect(out.fontFaces).toBe(0);
    expect(out.paths).toBeGreaterThan(keep.paths);
  });

  test("embedded scene survives re-import", async ({ page }) => {
    await chooseOption(page, "Format", "SVG");
    await page.getByLabel("Embed scene data").check();
    const { buf, dl } = await downloadExport(page, "SVG");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Scenes", exact: true }).click();
    await page
      .getByTestId("import-input")
      .setInputFiles({ name: dl.suggestedFilename(), mimeType: "image/svg+xml", buffer: buf });
    await expect(page.getByTestId("scene-row")).toHaveCount(2);
  });

  test("copies SVG markup to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await chooseOption(page, "Format", "SVG");
    await page.getByRole("button", { name: "Copy SVG" }).click();
    await expect(page.getByText("Copied SVG to the clipboard.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("<svg");
  });
});

test.describe("PDF", () => {
  test("is a real vector PDF with selectable text and metadata", async ({ page }) => {
    await chooseOption(page, "Format", "PDF");
    await page.getByLabel("Title").fill("Client to server");
    const { buf, dl } = await downloadExport(page, "PDF");
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await inspectPdf(buf);
    expect(pdf.pages).toHaveLength(1);
    const p = pdf.pages[0]!;
    expect(p.text).toContain("Client");
    expect(p.text).toContain("Server");
    expect(p.paintsImages).toBe(0); // vector, not a screenshot
    expect(p.paintsPaths).toBeGreaterThan(0);
    expect(pdf.title).toBe("Client to server");
    // Fit-to-content: ~480×80 px content plus 10 mm margins → wider than tall.
    expect(p.width).toBeGreaterThan(p.height);
  });

  test("embeds every font the drawing uses (no silent fallback to Helvetica)", async ({ page }) => {
    await loadDiagram(page, textFonts!);
    await page.keyboard.press("Escape");
    await openExport(page);
    await chooseOption(page, "Format", "PDF");
    const { buf } = await downloadExport(page, "PDF");
    const raw = buf.toString("latin1");
    // Three families on the canvas → three embedded TrueType font programs.
    expect(raw.match(/\/FontFile2/g)).toHaveLength(3);
    expect(raw).toMatch(/\/FontName \/Excalifont/);
    expect(raw).toMatch(/\/FontName \/Nunito/);
    expect(raw).toMatch(/\/FontName \/ComicShanns/);
    const pdf = await inspectPdf(buf);
    expect(pdf.pages[0]!.text).toContain("Orders API");
  });

  test("standard page sizes and orientation", async ({ page }) => {
    await chooseOption(page, "Format", "PDF");
    await page.getByLabel("Page size").selectOption("a4");
    let pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
    // Wide content + automatic orientation → A4 landscape (842×595 pt).
    expect(pdf.pages[0]!.width).toBeCloseTo(841.89, 0);
    expect(pdf.pages[0]!.height).toBeCloseTo(595.28, 0);

    await page.getByLabel("Orientation").selectOption("portrait");
    pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
    expect(pdf.pages[0]!.width).toBeCloseTo(595.28, 0);

    await page.getByLabel("Page size").selectOption("letter");
    pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
    expect(pdf.pages[0]!.width).toBeCloseTo(612, 0);
    expect(pdf.pages[0]!.height).toBeCloseTo(792, 0);

    await page.getByLabel("Page size").selectOption("custom");
    await page.getByLabel("Width (mm)").fill("100");
    await page.getByLabel("Height (mm)").fill("50");
    await page.getByLabel("Orientation").selectOption("landscape");
    pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
    expect(pdf.pages[0]!.width).toBeCloseTo((100 / 25.4) * 72, 0);
  });

  test("frames become pages", async ({ page }) => {
    await loadDiagram(page, framed!);
    await page.keyboard.press("Escape");
    await openExport(page);
    await chooseOption(page, "Format", "PDF");
    await page.getByLabel(/One page per frame/).check();
    const pdf = await inspectPdf((await downloadExport(page, "PDF")).buf);
    expect(pdf.pages).toHaveLength(2);
    expect(pdf.pages.every((p) => p.paintsImages === 0)).toBe(true);
  });

  test("a long export shows progress and can be cancelled", async ({ page }) => {
    await apiReady(page);
    await page.evaluate(
      (frames) => {
        window.__archboard!.api.updateScene({ elements: frames as never });
      },
      // Many frames, each with content, so there is real work to cancel.
      Array.from({ length: 50 }, (_, i) => {
        const x = (i % 10) * 320;
        const y = Math.floor(i / 10) * 240;
        return [
          frame({ id: `bf${i}`, x, y, width: 300, height: 200, name: `Slide ${i + 1}` }),
          rect({ id: `br${i}`, x: x + 20, y: y + 20, width: 100, height: 60, frameId: `bf${i}` }),
        ];
      }).flat(),
    );
    await page.keyboard.press("Escape");
    await openExport(page);
    await chooseOption(page, "Format", "PDF");
    await page.getByLabel(/One page per frame/).check();
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect(page.getByRole("progressbar", { name: "Export progress" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel export" }).click();
    await expect(page.getByText("Export cancelled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  });
});

test.describe("JSON and scope", () => {
  test("JSON is Excalidraw-compatible", async ({ page }) => {
    await chooseOption(page, "Format", "JSON");
    const { buf, dl } = await downloadExport(page, "JSON");
    expect(dl.suggestedFilename()).toMatch(/\.excalidraw$/);
    const json = JSON.parse(buf.toString("utf8"));
    expect(json.type).toBe("excalidraw");
    expect(json.elements).toHaveLength(5);
  });

  test("selection scope exports only the selected elements (with their labels)", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const api = window.__archboard!.api;
      api.updateScene({ appState: { selectedElementIds: { c: true } } as never });
    });
    await chooseOption(page, "Format", "JSON");
    await chooseOption(page, "Scope", "Selection");
    const json = JSON.parse((await downloadExport(page, "JSON")).buf.toString("utf8"));
    expect(json.elements.map((e: { id: string }) => e.id)).toEqual(["c"]);
  });

  test("empty selection explains itself", async ({ page }) => {
    await chooseOption(page, "Scope", "Selection");
    await page.getByRole("button", { name: "Download PNG" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Nothing is selected");
  });
});

test("last-used settings are remembered across reloads", async ({ page }) => {
  await chooseOption(page, "Format", "PDF");
  await page.getByLabel("Page size").selectOption("a3");
  await waitSaved(page).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator(".excalidraw canvas.interactive")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("radio", { name: "PDF" })).toBeChecked();
  await expect(page.getByLabel("Page size")).toHaveValue("a3");
});

test("imports an .excalidrawlib into the persisted library", async ({ page }) => {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  const lib = {
    type: "excalidrawlib",
    version: 2,
    source: "test",
    libraryItems: [
      {
        id: "lib-a",
        status: "unpublished",
        created: 1,
        name: "Box",
        elements: [{ ...rect({ id: "libr", x: 0, y: 0, width: 40, height: 40 }) }],
      },
    ],
  };
  await page.getByTestId("import-input").setInputFiles({
    name: "boxes.excalidrawlib",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(lib)),
  });
  await expect(page.getByText("Added 1 library item")).toBeVisible();
  await expect
    .poll(async () => {
      const row = await readIdb<{ items: unknown[] } | undefined>(page, "libraries", "default");
      return row?.items.length ?? 0;
    })
    .toBe(1);
});
