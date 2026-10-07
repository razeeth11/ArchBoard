import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/excalidraw/element/types";
import { step, throwIfAborted, type Hooks } from "./abort";
import {
  applySvgAccessibility,
  exportDimensions,
  exportFileName,
  listFrames,
  pickElements,
  rasterLimitError,
  type ExportOptions,
} from "./options";

export interface SceneSnapshot {
  elements: readonly ExcalidrawElement[];
  appState: Pick<AppState, "selectedElementIds" | "viewBackgroundColor">;
  files: BinaryFiles;
  sceneTitle: string;
}

export interface RenderResult {
  blob: Blob;
  filename: string;
  pages?: number;
  width?: number;
  height?: number;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

async function lib() {
  return import("@excalidraw/excalidraw");
}

function exportAppState(scene: SceneSnapshot, o: ExportOptions) {
  return {
    exportBackground: o.background === "solid",
    exportWithDarkMode: o.dark,
    exportEmbedScene: o.embedScene,
    viewBackgroundColor: scene.appState.viewBackgroundColor,
  };
}

function resolveTitle(scene: SceneSnapshot, o: ExportOptions) {
  return o.title.trim() || scene.sceneTitle;
}

function pick(scene: SceneSnapshot, o: ExportOptions) {
  const picked = pickElements(scene.elements, scene.appState.selectedElementIds, o);
  if (picked.elements.length === 0) {
    throw new ExportError(
      o.scope === "selection"
        ? "Nothing is selected. Select some elements or export the whole canvas."
        : o.scope === "frame"
          ? "Choose a frame to export."
          : "The canvas is empty: draw something first.",
    );
  }
  return picked;
}

function usedFiles(elements: readonly ExcalidrawElement[], files: BinaryFiles): BinaryFiles {
  const out: BinaryFiles = {};
  for (const e of elements) {
    if (e.type === "image" && e.fileId && files[e.fileId]) out[e.fileId] = files[e.fileId]!;
  }
  return out;
}

export async function renderSvgElement(
  scene: SceneSnapshot,
  o: ExportOptions,
  elements: ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement | null,
): Promise<SVGSVGElement> {
  const { exportToSvg } = await lib();
  const svg = await exportToSvg({
    elements: elements as never,
    appState: exportAppState(scene, o),
    files: usedFiles(elements, scene.files),
    exportPadding: o.padding,
    exportingFrame: frame as never,
  });
  applySvgAccessibility(svg, resolveTitle(scene, o), o.description);
  return svg;
}

async function renderPng(scene: SceneSnapshot, o: ExportOptions, h: Hooks): Promise<RenderResult> {
  const { elements, frame } = pick(scene, o);
  const { exportToBlob, getCommonBounds } = await lib();
  const [x1, y1, x2, y2] = getCommonBounds(elements as never);
  const dims = exportDimensions({ width: x2 - x1, height: y2 - y1 }, o.padding, o.scale);
  const limit = rasterLimitError(dims.width, dims.height);
  if (limit) throw new ExportError(limit);

  await step(h, "Rendering PNG", 0.3);
  const blob = await exportToBlob({
    elements: elements as never,
    appState: exportAppState(scene, o),
    files: usedFiles(elements, scene.files),
    exportPadding: o.padding,
    exportingFrame: frame as never,
    mimeType: "image/png",
    getDimensions: (w: number, hh: number) => ({
      width: w * o.scale,
      height: hh * o.scale,
      scale: o.scale,
    }),
  });
  throwIfAborted(h.signal);
  return {
    blob,
    filename: exportFileName(resolveTitle(scene, o), "png"),
    width: dims.width,
    height: dims.height,
  };
}

export async function serializeSvg(svg: SVGSVGElement): Promise<string> {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}

async function renderSvg(scene: SceneSnapshot, o: ExportOptions, h: Hooks): Promise<RenderResult> {
  const { elements, frame } = pick(scene, o);
  await step(h, "Rendering SVG", 0.3);
  const svg = await renderSvgElement(scene, o, elements, frame);
  if (o.svgTextAsPaths) {
    await step(h, "Converting text to outlines", 0.6);
    const { convertTextToPaths, extractEmbeddedFonts, loadFaces } = await import("./fonts");
    const faces = await loadFaces(extractEmbeddedFonts(svg));
    convertTextToPaths(svg, faces);
  }
  throwIfAborted(h.signal);
  const blob = new Blob([await serializeSvg(svg)], { type: "image/svg+xml" });
  return {
    blob,
    filename: exportFileName(resolveTitle(scene, o), "svg"),
    width: parseFloat(svg.getAttribute("width") ?? "0"),
    height: parseFloat(svg.getAttribute("height") ?? "0"),
  };
}

async function renderPdf(scene: SceneSnapshot, o: ExportOptions, h: Hooks): Promise<RenderResult> {
  const sheetsSpec: { elements: ExcalidrawElement[]; frame: ExcalidrawFrameLikeElement | null }[] =
    [];
  const frames = listFrames(scene.elements);
  if (o.pdf.framesAsPages && o.scope === "scene" && frames.length > 0) {
    for (const f of frames) {
      sheetsSpec.push(pickFrame(scene, f));
    }
  } else {
    sheetsSpec.push(pick(scene, o));
  }
  const sheets = [];
  for (const [i, s] of sheetsSpec.entries()) {
    await step(
      h,
      `Preparing page ${i + 1} of ${sheetsSpec.length}`,
      0.05 + (0.1 * i) / sheetsSpec.length,
    );
    sheets.push({ svg: await renderSvgElement(scene, o, s.elements, s.frame) });
  }
  const { buildPdf } = await import("./pdf");
  const blob = await buildPdf(
    sheets,
    o.pdf,
    { title: resolveTitle(scene, o), description: o.description },
    h,
  );
  return { blob, filename: exportFileName(resolveTitle(scene, o), "pdf"), pages: sheets.length };
}

function pickFrame(scene: SceneSnapshot, frame: ExcalidrawFrameLikeElement) {
  return {
    frame,
    elements: scene.elements.filter(
      (e) => !e.isDeleted && (e.id === frame.id || e.frameId === frame.id),
    ),
  };
}

async function renderJson(scene: SceneSnapshot, o: ExportOptions, h: Hooks): Promise<RenderResult> {
  const { elements } = pick(scene, o);
  await step(h, "Serializing", 0.5);
  const { serializeAsJSON } = await lib();
  const json = serializeAsJSON(
    elements as never,
    { viewBackgroundColor: scene.appState.viewBackgroundColor } as never,
    usedFiles(elements, scene.files),
    "local",
  );
  return {
    blob: new Blob([json], { type: "application/json" }),
    filename: exportFileName(resolveTitle(scene, o), "json"),
  };
}

export async function renderExport(
  scene: SceneSnapshot,
  o: ExportOptions,
  hooks: Hooks = {},
): Promise<RenderResult> {
  throwIfAborted(hooks.signal);
  const result =
    o.format === "png"
      ? await renderPng(scene, o, hooks)
      : o.format === "svg"
        ? await renderSvg(scene, o, hooks)
        : o.format === "pdf"
          ? await renderPdf(scene, o, hooks)
          : await renderJson(scene, o, hooks);
  hooks.onProgress?.({ stage: "Done", value: 1 });
  return result;
}

export interface Preview {
  url: string;
  kind: "image";
}

/** Cheap preview: scale 1, never embeds the scene; PDFs preview their first page as SVG. */
export async function renderPreview(
  scene: SceneSnapshot,
  o: ExportOptions,
  hooks: Hooks = {},
): Promise<Preview> {
  const base: ExportOptions = { ...o, scale: 1, embedScene: false, svgTextAsPaths: false };
  if (o.format === "png" || o.format === "json") {
    const r = await renderPng(scene, { ...base, format: "png" }, hooks);
    return { url: URL.createObjectURL(r.blob), kind: "image" };
  }
  const first =
    o.format === "pdf" &&
    o.pdf.framesAsPages &&
    o.scope === "scene" &&
    listFrames(scene.elements).length > 0
      ? pickFrame(scene, listFrames(scene.elements)[0]!)
      : pick(scene, o);
  const svg = await renderSvgElement(scene, base, first.elements, first.frame);
  const blob = new Blob([await serializeSvg(svg)], { type: "image/svg+xml" });
  return { url: URL.createObjectURL(blob), kind: "image" };
}

export async function copyExport(
  scene: SceneSnapshot,
  o: ExportOptions,
  as: "png" | "svg",
  hooks: Hooks = {},
) {
  if (as === "svg") {
    const { elements, frame } = pick(scene, o);
    const svg = await renderSvgElement(scene, { ...o, embedScene: false }, elements, frame);
    await navigator.clipboard.writeText(await serializeSvg(svg));
    return;
  }
  // Passing a promise keeps the user-gesture requirement satisfied in Safari while we render.
  const blobPromise = renderPng(scene, { ...o, format: "png" }, hooks).then((r) => r.blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}

/** Output pixel size for raster formats, used by the dialog to warn before rendering. */
export async function estimateRasterSize(scene: SceneSnapshot, o: ExportOptions) {
  const picked = pickElements(scene.elements, scene.appState.selectedElementIds, o);
  if (picked.elements.length === 0) return null;
  const { getCommonBounds } = await lib();
  const [x1, y1, x2, y2] = getCommonBounds(picked.elements as never);
  return exportDimensions({ width: x2 - x1, height: y2 - y1 }, o.padding, o.scale);
}
