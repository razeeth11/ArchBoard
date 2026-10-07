import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BuiltItem } from "./builder";
import { buildSvgImage, insertItem } from "./insert";
import { MAX_SVG_BYTES, SvgImportError, importSvgText } from "./svg";

export type SvgMode = "image" | "shapes";

export interface SvgImportResult {
  ids: string[];
  /** Human-readable notes (e.g. truncation). */
  notes: string[];
}

/** Sanitize an untrusted SVG and insert it as a vector image or as editable shapes. */
export async function importSvgIntoScene(
  api: ExcalidrawImperativeAPI,
  text: string,
  name: string,
  mode: SvgMode,
  at?: { x: number; y: number },
): Promise<SvgImportResult> {
  const notes: string[] = [];
  if (mode === "shapes") {
    const { svgToEditable } = await import("./svgEditable");
    const n = importSvgText(text); // sanitize + normalize first: conversion only ever sees clean markup
    const r = svgToEditable(n.svg);
    if (r.count === 0) {
      notes.push("No convertible shapes found, so it was inserted as an image instead.");
    } else {
      if (r.truncated) notes.push("Very large SVG: only the first 1,500 shapes were converted.");
      const item: BuiltItem = {
        skeleton: r.skeleton,
        files: [],
        width: r.width,
        height: r.height,
        meta: { kind: "icon", id: `svg-shapes:${name}` },
      };
      return {
        ids: await insertItem(api, item, { at }),
        notes: [...notes, "Curves are approximated as lines."],
      };
    }
  }
  return { ids: await insertItem(api, buildSvgImage(text, name), { at }), notes };
}

export async function readSvgFile(file: File): Promise<string> {
  if (file.size > MAX_SVG_BYTES) throw new SvgImportError("SVG is larger than 2 MB.");
  return file.text();
}

export const isSvgFile = (f: File) => f.type === "image/svg+xml" || /\.svg$/i.test(f.name);

export const looksLikeSvg = (t: string) =>
  /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(t);
