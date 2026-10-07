import { describe, expect, it } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  DEFAULT_EXPORT_OPTIONS,
  PX_TO_MM,
  applySvgAccessibility,
  exportDimensions,
  exportFileName,
  listFrames,
  pdfPageLayout,
  pickElements,
  rasterLimitError,
  sanitizeOptions,
} from "@/export/options";

const el = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: "rectangle",
    isDeleted: false,
    frameId: null,
    ...extra,
  }) as unknown as ExcalidrawElement;

describe("sanitizeOptions", () => {
  it("returns defaults for garbage", () => {
    expect(sanitizeOptions(null)).toEqual(DEFAULT_EXPORT_OPTIONS);
    expect(sanitizeOptions("nope")).toEqual(DEFAULT_EXPORT_OPTIONS);
    expect(sanitizeOptions([])).toEqual(DEFAULT_EXPORT_OPTIONS);
  });
  it("clamps and rejects invalid values", () => {
    const o = sanitizeOptions({
      format: "gif",
      scale: 99,
      padding: -5,
      background: "pink",
      pdf: { pageSize: "huge", marginMm: 1e9, customWidthMm: 1 },
      title: "x".repeat(1000),
    });
    expect(o.format).toBe("png");
    expect(o.scale).toBe(4);
    expect(o.padding).toBe(0);
    expect(o.background).toBe("solid");
    expect(o.pdf.pageSize).toBe("fit");
    expect(o.pdf.marginMm).toBe(50);
    expect(o.pdf.customWidthMm).toBe(20);
    expect(o.title).toHaveLength(200);
  });
  it("keeps valid stored settings (remembered between sessions)", () => {
    const stored = {
      ...DEFAULT_EXPORT_OPTIONS,
      format: "pdf" as const,
      scale: 3 as const,
      dark: true,
    };
    expect(sanitizeOptions(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
});

describe("pickElements", () => {
  const all = [
    el("a"),
    el("b"),
    el("t", { type: "text", containerId: "a" }),
    el("gone", { isDeleted: true }),
    el("f", { type: "frame" }),
    el("inFrame", { frameId: "f" }),
  ];
  it("scene = all live elements", () => {
    expect(
      pickElements(all, {}, { scope: "scene", frameId: null }).elements.map((e) => e.id),
    ).toEqual(["a", "b", "t", "f", "inFrame"]);
  });
  it("selection pulls in bound text and frame contents", () => {
    const ids = (sel: Record<string, boolean>) =>
      pickElements(all, sel, { scope: "selection", frameId: null }).elements.map((e) => e.id);
    expect(ids({ a: true })).toEqual(["a", "t"]);
    expect(ids({ f: true })).toEqual(["f", "inFrame"]);
    expect(ids({})).toEqual([]);
  });
  it("frame scope returns the frame and its children", () => {
    const r = pickElements(all, {}, { scope: "frame", frameId: "f" });
    expect(r.frame?.id).toBe("f");
    expect(r.elements.map((e) => e.id)).toEqual(["f", "inFrame"]);
    expect(pickElements(all, {}, { scope: "frame", frameId: "nope" }).elements).toEqual([]);
  });
  it("listFrames ignores deleted frames", () => {
    expect(
      listFrames([el("f", { type: "frame" }), el("g", { type: "frame", isDeleted: true })]),
    ).toHaveLength(1);
  });
});

describe("sizes and layout", () => {
  it("scales content plus padding", () => {
    expect(exportDimensions({ width: 100, height: 50 }, 10, 2)).toEqual({
      width: 240,
      height: 140,
    });
  });
  it("flags oversized rasters but allows normal ones", () => {
    expect(rasterLimitError(2000, 1000)).toBeNull();
    expect(rasterLimitError(20000, 100)).toMatch(/larger than your browser/);
    expect(rasterLimitError(15000, 15000)).toMatch(/larger/);
  });
  it("fit-to-content page = content + margins", () => {
    const l = pdfPageLayout(960, 480, {
      ...DEFAULT_EXPORT_OPTIONS.pdf,
      pageSize: "fit",
      marginMm: 10,
    });
    expect(l.pageWidthMm).toBeCloseTo(960 * PX_TO_MM + 20);
    expect(l.x).toBe(10);
    expect(l.width).toBeCloseTo(960 * PX_TO_MM);
  });
  it("A4 auto-orients to content and centers without upscaling", () => {
    const small = pdfPageLayout(200, 100, {
      ...DEFAULT_EXPORT_OPTIONS.pdf,
      pageSize: "a4",
      orientation: "auto",
    });
    expect([small.pageWidthMm, small.pageHeightMm]).toEqual([297, 210]);
    expect(small.width).toBeCloseTo(200 * PX_TO_MM); // never scaled up
    expect(small.x).toBeCloseTo((297 - small.width) / 2);
    const tall = pdfPageLayout(100, 400, {
      ...DEFAULT_EXPORT_OPTIONS.pdf,
      pageSize: "a4",
      orientation: "auto",
    });
    expect([tall.pageWidthMm, tall.pageHeightMm]).toEqual([210, 297]);
  });
  it("shrinks large content to fit inside margins", () => {
    const l = pdfPageLayout(4000, 3000, {
      ...DEFAULT_EXPORT_OPTIONS.pdf,
      pageSize: "a3",
      orientation: "landscape",
      marginMm: 10,
    });
    expect(l.pageWidthMm).toBe(420);
    expect(l.width).toBeLessThanOrEqual(420 - 20 + 1e-6);
    expect(l.height).toBeLessThanOrEqual(297 - 20 + 1e-6);
    expect(l.width / l.height).toBeCloseTo(4000 / 3000);
  });
  it("custom size and explicit orientation", () => {
    const l = pdfPageLayout(100, 100, {
      ...DEFAULT_EXPORT_OPTIONS.pdf,
      pageSize: "custom",
      customWidthMm: 100,
      customHeightMm: 200,
      orientation: "landscape",
    });
    expect([l.pageWidthMm, l.pageHeightMm]).toEqual([200, 100]);
  });
});

describe("file names and accessibility", () => {
  it("slugifies titles and picks extensions", () => {
    const d = new Date("2026-01-02T00:00:00Z");
    expect(exportFileName("Orders API — v2!", "png", d)).toBe("orders-api-v2-2026-01-02.png");
    expect(exportFileName("", "json", d)).toBe("archboard-2026-01-02.excalidraw");
    expect(exportFileName("héllo wörld", "pdf", d)).toBe("hello-world-2026-01-02.pdf");
  });
  it("adds role, title and desc to an SVG", () => {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>',
      "image/svg+xml",
    );
    const svg = doc.documentElement as unknown as SVGSVGElement;
    applySvgAccessibility(svg, "Orders <API>", "Client calls & server replies");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-labelledby")).toBe("archboard-title archboard-desc");
    expect(svg.children[0]?.tagName).toBe("title");
    expect(svg.children[0]?.textContent).toBe("Orders <API>");
    expect(svg.children[1]?.tagName).toBe("desc");
    expect(new XMLSerializer().serializeToString(svg)).toContain("Orders &lt;API&gt;");
  });
  it("adds nothing when title and description are empty", () => {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
      "image/svg+xml",
    );
    const svg = doc.documentElement as unknown as SVGSVGElement;
    applySvgAccessibility(svg, "", "");
    expect(svg.getAttribute("aria-labelledby")).toBeNull();
    expect(svg.children).toHaveLength(0);
  });
});
