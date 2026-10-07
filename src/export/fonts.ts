import type { Font } from "opentype.js";

/** A single embedded font file with a unique id, usable by opentype.js and jsPDF. */
export interface Face {
  id: string;
  family: string;
  font: Font;
  ttf: Uint8Array;
}

interface EmscriptenModule {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
  decompress?: (b: Uint8Array) => Uint8Array | false;
}

let decompressorPromise: Promise<(b: Uint8Array) => Uint8Array> | null = null;

const assetUrl = (name: string) =>
  `${(window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH ?? "/"}${name}`;

/**
 * wawoff2's emscripten glue only exports itself under Node (`module.exports = Module` sits behind an
 * ENVIRONMENT_IS_NODE check), so once bundled for the browser it exports nothing. We therefore load
 * the glue as a same-origin classic script (no eval, CSP-friendly) after pre-seeding the global
 * `Module` it extends, and wait for its runtime-initialized callback.
 */
function woff2Decompressor() {
  return (decompressorPromise ??= new Promise<(b: Uint8Array) => Uint8Array>((resolve, reject) => {
    const w = window as unknown as { Module?: EmscriptenModule };
    const mod: EmscriptenModule = {};
    const timer = setTimeout(() => reject(new Error("Font engine failed to initialize")), 15_000);
    mod.onRuntimeInitialized = () => {
      clearTimeout(timer);
      // Don't leave a global behind, but only after the glue's own postRun hooks have finished.
      setTimeout(() => (w.Module = undefined), 0);
      resolve((b) => {
        const out = mod.decompress?.(b);
        if (!out) throw new Error("Invalid WOFF2 font");
        return out;
      });
    };
    w.Module = mod;
    const el = document.createElement("script");
    el.src = assetUrl("woff2-decompress.js");
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Could not load the font engine"));
    };
    document.head.appendChild(el);
  }).catch((e) => {
    decompressorPromise = null;
    throw e;
  }));
}

const FONT_FACE_RE = /@font-face\s*{([^}]*)}/g;

export interface EmbeddedFontSource {
  family: string;
  woff2: Uint8Array;
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Excalidraw inlines the glyph subsets it used as base64 woff2 inside the exported SVG's <style>. */
export function extractEmbeddedFonts(svg: Element): EmbeddedFontSource[] {
  const out: EmbeddedFontSource[] = [];
  for (const style of Array.from(svg.querySelectorAll("style"))) {
    const css = style.textContent ?? "";
    for (const m of css.matchAll(FONT_FACE_RE)) {
      const body = m[1] ?? "";
      const family = /font-family:\s*["']?([^;"']+)["']?/.exec(body)?.[1]?.trim();
      const data = /url\(\s*["']?data:[^;,]*;base64,([^)"']+)["']?\s*\)/.exec(body)?.[1];
      if (family && data) out.push({ family, woff2: base64ToU8(data) });
    }
  }
  return out;
}

export async function loadFaces(sources: EmbeddedFontSource[]): Promise<Face[]> {
  if (!sources.length) return [];
  const [decompress, opentype] = await Promise.all([woff2Decompressor(), import("opentype.js")]);
  const faces: Face[] = [];
  for (const [i, src] of sources.entries()) {
    try {
      // Copy: the decoder returns a view into wasm memory that the next call overwrites.
      const ttf = Uint8Array.from(decompress(src.woff2));
      const ab = ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength) as ArrayBuffer;
      faces.push({
        id: `${src.family.replace(/[^A-Za-z0-9]/g, "")}-${i}`,
        family: src.family,
        font: opentype.parse(ab),
        ttf,
      });
    } catch {
      /* an undecodable face is skipped; its text falls back to the default font */
    }
  }
  return faces;
}

const covers = (font: Font, ch: string) => {
  if (/\s/.test(ch)) return true;
  const cp = ch.codePointAt(0)!;
  return font.charToGlyphIndex(String.fromCodePoint(cp)) > 0;
};

export interface Run {
  text: string;
  face: Face | null;
}

const parseFamilies = (attr: string | null): string[] =>
  (attr ?? "")
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

/** Split a line into runs, each covered by the first face (in font-family order) that has every glyph. */
export function planRuns(text: string, familyAttr: string | null, faces: Face[]): Run[] {
  const families = parseFamilies(familyAttr);
  const candidates = families.flatMap((f) => faces.filter((face) => face.family === f));
  const runs: Run[] = [];
  for (const ch of Array.from(text)) {
    const face = candidates.find((c) => covers(c.font, ch)) ?? null;
    const last = runs[runs.length - 1];
    if (last && last.face === face) last.text += ch;
    else runs.push({ text: ch, face });
  }
  return runs;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const TEXT_ONLY_ATTRS = new Set([
  "x",
  "y",
  "font-family",
  "font-size",
  "text-anchor",
  "direction",
  "dominant-baseline",
  "style",
  "xml:space",
]);

interface TextTarget {
  el: SVGTextElement;
  x: number;
  y: number;
  size: number;
  anchor: string;
  rtl: boolean;
  text: string;
  family: string | null;
}

function collectText(svg: Element): TextTarget[] {
  return Array.from(svg.querySelectorAll("text")).flatMap((el) => {
    if (el.children.length > 0) return []; // only plain single-run lines are rewritten
    const size = parseFloat(el.getAttribute("font-size") ?? "");
    const x = parseFloat(el.getAttribute("x") ?? "0");
    const y = parseFloat(el.getAttribute("y") ?? "0");
    if (!Number.isFinite(size) || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [
      {
        el: el as SVGTextElement,
        x,
        y,
        size,
        anchor: el.getAttribute("text-anchor") ?? "start",
        rtl: (el.getAttribute("direction") ?? "") === "rtl",
        text: el.textContent ?? "",
        family: el.getAttribute("font-family"),
      },
    ];
  });
}

function copyPaintAttrs(from: Element, to: Element) {
  for (const a of Array.from(from.attributes)) {
    if (!TEXT_ONLY_ATTRS.has(a.name)) to.setAttribute(a.name, a.value);
  }
}

function runOrigins(t: TextTarget, runs: Run[]): { run: Run; x: number; width: number }[] {
  const widths = runs.map((r) =>
    r.face ? r.face.font.getAdvanceWidth(r.text, t.size) : r.text.length * t.size * 0.6,
  );
  const total = widths.reduce((a, b) => a + b, 0);
  let x = t.anchor === "middle" ? t.x - total / 2 : t.anchor === "end" ? t.x - total : t.x;
  return runs.map((run, i) => {
    const origin = { run, x, width: widths[i]! };
    x += widths[i]!;
    return origin;
  });
}

/** Replace text with vector outlines. RTL and glyph-less text is left as live text. */
export function convertTextToPaths(
  svg: Element,
  faces: Face[],
): { converted: number; kept: number } {
  let converted = 0;
  let kept = 0;
  for (const t of collectText(svg)) {
    const runs = planRuns(t.text, t.family, faces);
    if (t.rtl || !t.text.trim() || runs.some((r) => !r.face)) {
      kept++;
      continue;
    }
    const g = svg.ownerDocument.createElementNS(SVG_NS, "g");
    copyPaintAttrs(t.el, g);
    for (const { run, x } of runOrigins(t, runs)) {
      const p = svg.ownerDocument.createElementNS(SVG_NS, "path");
      p.setAttribute("d", run.face!.font.getPath(run.text, x, t.y, t.size).toPathData(2));
      g.appendChild(p);
    }
    t.el.replaceWith(g);
    converted++;
  }
  if (!svg.querySelector("text")) {
    // No live text left: the embedded font payload is dead weight.
    svg
      .querySelectorAll("style")
      .forEach((s) => /@font-face/.test(s.textContent ?? "") && s.remove());
  }
  return { converted, kept };
}

/**
 * For PDF: keep text live (selectable) but point every run at a uniquely named face
 * that we register with jsPDF, splitting lines where glyph coverage changes.
 */
export function bindTextToFaces(svg: Element, faces: Face[]): Set<Face> {
  const used = new Set<Face>();
  for (const t of collectText(svg)) {
    const runs = planRuns(t.text, t.family, faces);
    if (t.rtl || !t.text) continue;
    const origins = runOrigins(t, runs);
    if (origins.every((o) => !o.run.face)) continue;
    const doc = svg.ownerDocument;
    const frag: Element[] = [];
    for (const { run, x } of origins) {
      const el = doc.createElementNS(SVG_NS, "text");
      copyPaintAttrs(t.el, el);
      el.setAttribute("x", String(x));
      el.setAttribute("y", String(t.y));
      el.setAttribute("font-size", String(t.size));
      el.setAttribute("text-anchor", "start");
      if (run.face) {
        el.setAttribute("font-family", run.face.id);
        used.add(run.face);
      } else {
        el.setAttribute("font-family", t.family?.split(",")[0] ?? "helvetica");
      }
      el.textContent = run.text;
      frag.push(el);
    }
    t.el.replaceWith(...frag);
  }
  svg
    .querySelectorAll("style")
    .forEach((s) => /@font-face/.test(s.textContent ?? "") && s.remove());
  return used;
}
