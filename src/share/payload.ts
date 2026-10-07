import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { SHARE_VERSION, type SharePayload } from "./link";

/** Snapshot the live scene as a share payload. Images are optional because they dominate link size. */
export function buildPayload(
  title: string,
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
  bg: string | undefined,
  includeImages: boolean,
): SharePayload {
  const live = elements.filter((e) => !e.isDeleted && (includeImages || e.type !== "image"));
  const out: SharePayload["files"] = {};
  if (includeImages) {
    for (const e of live) {
      const f = e.type === "image" && e.fileId ? files[e.fileId] : undefined;
      if (f) out[f.id] = { mimeType: f.mimeType, dataURL: f.dataURL, created: f.created };
    }
  }
  return { v: SHARE_VERSION, title, elements: live, viewBackgroundColor: bg, files: out };
}

/** A payload as `.excalidraw` JSON, so the normal import path (blobs, validation) can reuse it. */
export function payloadToExcalidrawJson(p: SharePayload): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "archboard-share",
    elements: p.elements,
    appState: { viewBackgroundColor: p.viewBackgroundColor ?? "#ffffff" },
    files: Object.fromEntries(Object.entries(p.files).map(([id, f]) => [id, { id, ...f }])),
  });
}
