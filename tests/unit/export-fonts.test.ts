import { describe, expect, it, vi } from "vitest";
import { throwIfAborted, isAbort, step } from "@/export/abort";
import {
  bindTextToFaces,
  convertTextToPaths,
  extractEmbeddedFonts,
  planRuns,
  type Face,
} from "@/export/fonts";

/** A stand-in face covering a fixed character set, with deterministic metrics. */
function face(id: string, family: string, chars: string): Face {
  const font = {
    charToGlyphIndex: (c: string) => (chars.includes(c) ? 1 : 0),
    getAdvanceWidth: (t: string, size: number) => t.length * size * 0.5,
    getPath: (t: string, x: number, y: number) => ({ toPathData: () => `M${x} ${y}h${t.length}` }),
  };
  return { id, family, font: font as never, ttf: new Uint8Array([1]) };
}

const SVG = (inner: string) =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><defs><style class="style-fonts">@font-face { font-family: Excalifont; src: url(data:font/woff2;base64,AQID); }</style></defs>${inner}</svg>`,
    "image/svg+xml",
  ).documentElement;

describe("embedded font extraction", () => {
  it("reads family and base64 payload from @font-face rules", () => {
    const fonts = extractEmbeddedFonts(SVG(""));
    expect(fonts).toHaveLength(1);
    expect(fonts[0]?.family).toBe("Excalifont");
    expect(Array.from(fonts[0]!.woff2)).toEqual([1, 2, 3]);
  });
  it("returns nothing when no fonts are embedded", () => {
    expect(
      extractEmbeddedFonts(
        new DOMParser().parseFromString(
          "<svg xmlns='http://www.w3.org/2000/svg'/>",
          "image/svg+xml",
        ).documentElement,
      ),
    ).toEqual([]);
  });
});

describe("planRuns", () => {
  const latin = face("L-0", "Excalifont", "abcdef ");
  const cjk = face("X-1", "Xiaolai", "你好");
  it("uses the first family in the chain that covers each character", () => {
    const runs = planRuns("ab你好cd", "Excalifont, Xiaolai", [latin, cjk]);
    expect(runs.map((r) => [r.text, r.face?.id])).toEqual([
      ["ab", "L-0"],
      ["你好", "X-1"],
      ["cd", "L-0"],
    ]);
  });
  it("marks uncovered glyphs with no face", () => {
    expect(planRuns("a?", "Excalifont", [latin]).map((r) => r.face?.id ?? null)).toEqual([
      "L-0",
      null,
    ]);
  });
});

describe("convertTextToPaths", () => {
  const line = (t: string, extra = "") =>
    `<g transform="translate(5 6)"><text x="10" y="20" font-family="Excalifont" font-size="20px" fill="#f00" text-anchor="start" direction="ltr" ${extra}>${t}</text></g>`;
  it("replaces covered text with a path group and drops dead font data", () => {
    const svg = SVG(line("abc"));
    const r = convertTextToPaths(svg, [face("L-0", "Excalifont", "abc")]);
    expect(r).toEqual({ converted: 1, kept: 0 });
    expect(svg.querySelector("text")).toBeNull();
    expect(svg.querySelectorAll("g > g path")).toHaveLength(1);
    expect(svg.querySelector("g > g")?.getAttribute("fill")).toBe("#f00");
    expect(svg.querySelector("style")).toBeNull();
  });
  it("keeps text it cannot outline (missing glyphs, RTL) so nothing is lost", () => {
    const svg = SVG(line("abc?") + line("abc", 'direction="rtl"').replace('direction="ltr"', ""));
    const r = convertTextToPaths(svg, [face("L-0", "Excalifont", "abc")]);
    expect(r.converted).toBe(0);
    expect(r.kept).toBe(2);
    expect(svg.querySelectorAll("text")).toHaveLength(2);
  });
  it("anchors middle/end text by measured width", () => {
    const svg = SVG(line("abcd").replace('text-anchor="start"', 'text-anchor="middle"'));
    convertTextToPaths(svg, [face("L-0", "Excalifont", "abcd")]);
    // width = 4 chars * 20 * 0.5 = 40; start x = 10 - 20 = -10
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M-10 20h4");
  });
});

describe("bindTextToFaces (PDF)", () => {
  it("keeps live text but binds each run to a registered face id", () => {
    const svg = SVG(
      '<text x="0" y="10" font-family="Excalifont, Xiaolai" font-size="20px" fill="#000" text-anchor="start" direction="ltr">ab你</text>',
    );
    const used = bindTextToFaces(svg, [
      face("L-0", "Excalifont", "ab"),
      face("X-1", "Xiaolai", "你"),
    ]);
    const texts = Array.from(svg.querySelectorAll("text"));
    expect(texts.map((t) => [t.textContent, t.getAttribute("font-family")])).toEqual([
      ["ab", "L-0"],
      ["你", "X-1"],
    ]);
    expect(texts[1]?.getAttribute("x")).toBe("20"); // advanced by the first run's width
    expect(
      Array.from(used)
        .map((f) => f.id)
        .sort(),
    ).toEqual(["L-0", "X-1"]);
    expect(svg.querySelector("style")).toBeNull();
  });
});

describe("abort helpers", () => {
  it("throws AbortError once aborted and step() honours it", async () => {
    const ctrl = new AbortController();
    const onProgress = vi.fn();
    await step({ signal: ctrl.signal, onProgress }, "work", 0.5);
    expect(onProgress).toHaveBeenCalledWith({ stage: "work", value: 0.5 });
    ctrl.abort();
    expect(() => throwIfAborted(ctrl.signal)).toThrow();
    await expect(step({ signal: ctrl.signal }, "x", 1)).rejects.toSatisfy(isAbort);
  });
});
