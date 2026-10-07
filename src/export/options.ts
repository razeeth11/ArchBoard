import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/excalidraw/element/types";

export type ExportFormat = "png" | "svg" | "pdf" | "json";
export type ExportScope = "scene" | "selection" | "frame";
export type PdfPageSize = "fit" | "a4" | "a3" | "letter" | "custom";
export type PdfOrientation = "auto" | "portrait" | "landscape";

export interface PdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  marginMm: number;
  customWidthMm: number;
  customHeightMm: number;
  /** One PDF page per frame (frames act as slides) instead of a single page. */
  framesAsPages: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  frameId: string | null;
  scale: 1 | 2 | 3 | 4;
  background: "transparent" | "solid";
  dark: boolean;
  padding: number;
  /** PNG/SVG: embed the scene so the file can be re-imported. */
  embedScene: boolean;
  /** SVG: convert text to outlines so fonts can never break. */
  svgTextAsPaths: boolean;
  pdf: PdfOptions;
  /** Accessible name and description (SVG <title>/<desc>, PDF metadata, alt-text helper). */
  title: string;
  description: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "png",
  scope: "scene",
  frameId: null,
  scale: 2,
  background: "solid",
  dark: false,
  padding: 16,
  embedScene: false,
  svgTextAsPaths: false,
  pdf: {
    pageSize: "fit",
    orientation: "auto",
    marginMm: 10,
    customWidthMm: 210,
    customHeightMm: 297,
    framesAsPages: false,
  },
  title: "",
  description: "",
};

export const PAGE_SIZES_MM: Record<Exclude<PdfPageSize, "fit" | "custom">, [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
  letter: [215.9, 279.4],
};

/** SVG/CSS pixels are 96 per inch. */
export const PX_TO_MM = 25.4 / 96;

/** Chrome's practical canvas limit is ~16k per side / ~268M pixels; stay below both. */
export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_PIXELS = 200_000_000;

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Stored settings are untrusted (older versions, manual edits): clamp everything. */
export function sanitizeOptions(raw: unknown): ExportOptions {
  const d = DEFAULT_EXPORT_OPTIONS;
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const p = (typeof r.pdf === "object" && r.pdf !== null ? r.pdf : {}) as Record<string, unknown>;
  const scale = clamp(r.scale, 1, 4, d.scale);
  return {
    format: oneOf(r.format, ["png", "svg", "pdf", "json"], d.format),
    scope: oneOf(r.scope, ["scene", "selection", "frame"], d.scope),
    frameId: typeof r.frameId === "string" ? r.frameId : null,
    scale: Math.round(scale) as ExportOptions["scale"],
    background: oneOf(r.background, ["transparent", "solid"], d.background),
    dark: r.dark === true,
    padding: Math.round(clamp(r.padding, 0, 200, d.padding)),
    embedScene: r.embedScene === true,
    svgTextAsPaths: r.svgTextAsPaths === true,
    pdf: {
      pageSize: oneOf(p.pageSize, ["fit", "a4", "a3", "letter", "custom"], d.pdf.pageSize),
      orientation: oneOf(p.orientation, ["auto", "portrait", "landscape"], d.pdf.orientation),
      marginMm: clamp(p.marginMm, 0, 50, d.pdf.marginMm),
      customWidthMm: clamp(p.customWidthMm, 20, 5000, d.pdf.customWidthMm),
      customHeightMm: clamp(p.customHeightMm, 20, 5000, d.pdf.customHeightMm),
      framesAsPages: p.framesAsPages === true,
    },
    title: typeof r.title === "string" ? r.title.slice(0, 200) : "",
    description: typeof r.description === "string" ? r.description.slice(0, 2000) : "",
  };
}

export interface PickedElements {
  elements: ExcalidrawElement[];
  frame: ExcalidrawFrameLikeElement | null;
}

const isFrame = (e: ExcalidrawElement): e is ExcalidrawFrameLikeElement =>
  e.type === "frame" || e.type === "magicframe";

export function listFrames(all: readonly ExcalidrawElement[]): ExcalidrawFrameLikeElement[] {
  return all.filter((e): e is ExcalidrawFrameLikeElement => !e.isDeleted && isFrame(e));
}

/**
 * Resolve which elements an export covers. Selection pulls in bound text of selected containers
 * and the contents of selected frames, so "selection only" never drops a label.
 */
export function pickElements(
  all: readonly ExcalidrawElement[],
  selectedIds: Readonly<Record<string, unknown>>,
  opts: Pick<ExportOptions, "scope" | "frameId">,
): PickedElements {
  const live = all.filter((e) => !e.isDeleted);
  if (opts.scope === "scene") return { elements: live, frame: null };

  if (opts.scope === "frame") {
    const frame = live.find((e) => e.id === opts.frameId && isFrame(e)) as
      ExcalidrawFrameLikeElement | undefined;
    if (!frame) return { elements: [], frame: null };
    return { elements: live.filter((e) => e.id === frame.id || e.frameId === frame.id), frame };
  }

  const ids = new Set(Object.keys(selectedIds).filter((k) => selectedIds[k]));
  for (const e of live) {
    if (e.frameId && ids.has(e.frameId)) ids.add(e.id);
    if ("containerId" in e && e.containerId && ids.has(e.containerId)) ids.add(e.id);
  }
  return { elements: live.filter((e) => ids.has(e.id)), frame: null };
}

/** Pixel size of an export (before the scale factor) for a content box. */
export function exportDimensions(
  box: { width: number; height: number },
  padding: number,
  scale: number,
): { width: number; height: number } {
  return {
    width: Math.ceil((box.width + padding * 2) * scale),
    height: Math.ceil((box.height + padding * 2) * scale),
  };
}

/** Returns an error message when a raster export would exceed browser canvas limits. */
export function rasterLimitError(width: number, height: number): string | null {
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE || width * height > MAX_CANVAS_PIXELS) {
    return `This export would be ${width}×${height}px, which is larger than your browser can render. Lower the scale or export as SVG/PDF, which stay sharp at any size.`;
  }
  return null;
}

export interface PageLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  /** Where the content sits on the page. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Page geometry for one PDF sheet whose content is `contentWpx × contentHpx`. */
export function pdfPageLayout(contentWpx: number, contentHpx: number, pdf: PdfOptions): PageLayout {
  const cw = contentWpx * PX_TO_MM;
  const ch = contentHpx * PX_TO_MM;
  const m = pdf.marginMm;
  if (pdf.pageSize === "fit") {
    return { pageWidthMm: cw + 2 * m, pageHeightMm: ch + 2 * m, x: m, y: m, width: cw, height: ch };
  }
  let [pw, ph] =
    pdf.pageSize === "custom"
      ? [pdf.customWidthMm, pdf.customHeightMm]
      : PAGE_SIZES_MM[pdf.pageSize];
  const wantLandscape =
    pdf.orientation === "landscape" || (pdf.orientation === "auto" && contentWpx > contentHpx);
  if (wantLandscape !== pw > ph) [pw, ph] = [ph, pw];
  const availW = Math.max(1, pw - 2 * m);
  const availH = Math.max(1, ph - 2 * m);
  // Never upscale beyond real size: small diagrams stay crisp and true-to-size.
  const k = Math.min(availW / cw, availH / ch, 1);
  const w = cw * k;
  const h = ch * k;
  return {
    pageWidthMm: pw,
    pageHeightMm: ph,
    x: (pw - w) / 2,
    y: (ph - h) / 2,
    width: w,
    height: h,
  };
}

export function exportFileName(title: string, format: ExportFormat, now = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "archboard";
  const date = now.toISOString().slice(0, 10);
  const ext = format === "json" ? "excalidraw" : format;
  return `${slug}-${date}.${ext}`;
}

const XML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeXml = (s: string) => s.replace(/[&<>"]/g, (c) => XML_ESC[c]!);

/** Add an accessible name/description to an exported SVG. Works on any SVGSVGElement-like DOM node. */
export function applySvgAccessibility(svg: SVGSVGElement, title: string, description: string) {
  const doc = svg.ownerDocument;
  const ns = "http://www.w3.org/2000/svg";
  svg.setAttribute("role", "img");
  const ids: string[] = [];
  if (title) {
    const t = doc.createElementNS(ns, "title");
    t.setAttribute("id", "archboard-title");
    t.textContent = title;
    svg.insertBefore(t, svg.firstChild);
    ids.push("archboard-title");
  }
  if (description) {
    const d = doc.createElementNS(ns, "desc");
    d.setAttribute("id", "archboard-desc");
    d.textContent = description;
    svg.insertBefore(d, title ? svg.children[1]! : svg.firstChild);
    ids.push("archboard-desc");
  }
  if (ids.length) svg.setAttribute("aria-labelledby", ids.join(" "));
}
