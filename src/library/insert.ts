import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { BLOCKS, TECH, buildBlock, buildTech } from "./blocks";
import { fitBoundText } from "./fitText";
import { Builder, DEFAULT_STYLE, type BuiltItem, type StyleCtx } from "./builder";
import { fetchOnlineIcon, getOnlineLicense, parseOnlineRef } from "./iconify";
import { getIcon, parseIconRef } from "./icons";
import { KIT_ITEMS } from "./kits";
import { importSvgText, svgToDataURL } from "./svg";

/** What the panel hands to click/drag handlers. Small and JSON-safe so it can ride in a drag event. */
export type Payload =
  | { type: "block"; id: string }
  | { type: "tech"; id: string }
  | { type: "kit"; id: string }
  | { type: "smart"; id: string }
  | { type: "icon"; ref: string; online?: boolean };

export const DRAG_MIME = "application/x-archboard-item";

export function parsePayload(raw: string): Payload | null {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (
      (p.type === "block" || p.type === "tech" || p.type === "kit" || p.type === "smart") &&
      typeof p.id === "string"
    ) {
      return { type: p.type, id: p.id };
    }
    if (p.type === "icon" && typeof p.ref === "string") {
      return { type: "icon", ref: p.ref, online: p.online === true };
    }
  } catch {
    /* not ours */
  }
  return null;
}

/** Turn a payload into elements. Throws a user-presentable Error when it cannot. */
export async function buildPayload(
  p: Payload,
  style: StyleCtx = DEFAULT_STYLE,
): Promise<BuiltItem> {
  if (p.type === "block") {
    const def = BLOCKS.find((b) => b.id === p.id);
    if (!def) throw new Error("Unknown component");
    return buildBlock(def, style);
  }
  if (p.type === "tech") {
    const def = TECH.find((t) => t.id === p.id);
    if (!def) throw new Error("Unknown technology");
    return buildTech(def, style);
  }
  if (p.type === "kit") {
    const def = KIT_ITEMS.find((k) => k.id === p.id);
    if (!def) throw new Error("Unknown shape");
    return def.build(style);
  }
  if (p.type === "smart") throw new Error("Smart components are inserted through insertSmart");
  // Icon: bundled sets first; otherwise (opt-in) the online API, sanitized.
  const name = parseIconRef(p.ref).name;
  const local = p.online ? null : await getIcon(p.ref).catch(() => null);
  const data = local ?? (parseOnlineRef(p.ref) ? await fetchOnlineIcon(p.ref) : null);
  if (!data) throw new Error("That icon is not available");
  const b = new Builder(style);
  b.iconData(p.ref, data, 0, 0, 72);
  b.text(-24, 80, name, { size: 14, align: "center" });
  const item = b.finish({ kind: "icon", id: p.ref });
  if (p.online) {
    const lic = await getOnlineLicense(parseIconRef(p.ref).prefix).catch(() => null);
    if (lic) (item.meta as Record<string, unknown>).license = `${lic.name} — ${lic.license}`;
  }
  return item;
}

/** Build an item for a sanitized, normalized SVG imported by the user (kept as a crisp vector image). */
export function buildSvgImage(svgText: string, name: string, maxSide = 320): BuiltItem {
  const n = importSvgText(svgText);
  const k = Math.min(1, maxSide / Math.max(n.width, n.height)) || 1;
  const w = Math.max(8, n.width * k);
  const h = Math.max(8, n.height * k);
  const id = `svg_${Math.abs(hash(n.svg)).toString(36)}`;
  const b = new Builder();
  b.svgImage(id, n.svg, 0, 0, w, h);
  return b.finish({ kind: "icon", id: `svg:${name}` });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

let cascade = 0;

type Box = { x1: number; y1: number; x2: number; y2: number };

/**
 * Pick a spot near `center` where an item of size w×h does not overlap anything already on the
 * canvas, spiralling outwards. Falls back to a small cascade when the area is crowded.
 */
export function findFreeSpot(
  taken: Box[],
  center: { x: number; y: number },
  w: number,
  h: number,
): { x: number; y: number } | null {
  const gap = 24;
  const stepX = w + gap;
  const stepY = h + gap;
  const hits = (cx: number, cy: number) =>
    taken.some(
      (b) => cx - w / 2 < b.x2 && cx + w / 2 > b.x1 && cy - h / 2 < b.y2 && cy + h / 2 > b.y1,
    );
  for (let ring = 0; ring <= 6; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const cx = center.x + dx * stepX;
        const cy = center.y + dy * stepY;
        if (!hits(cx, cy)) return { x: cx, y: cy };
      }
    }
  }
  return null;
}

/** Scene coordinates of the viewport centre. */
export function viewportCenter(api: ExcalidrawImperativeAPI) {
  const s = api.getAppState();
  return { x: s.width / 2 / s.zoom.value - s.scrollX, y: s.height / 2 / s.zoom.value - s.scrollY };
}

export interface InsertOptions {
  /** Scene coordinates for the item's centre. Defaults to the viewport centre (cascaded). */
  at?: { x: number; y: number };
}

/** Insert an assembled item as one selected group. Returns the new element ids. */
export async function insertItem(
  api: ExcalidrawImperativeAPI,
  item: BuiltItem,
  opts: InsertOptions = {},
): Promise<string[]> {
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const els = fitBoundText(convertToExcalidrawElements(item.skeleton, { regenerateIds: true }));
  return insertElements(api, els, item.files, item.meta, opts);
}

/**
 * Place already-converted elements as one selected, undoable group (used by library items, Mermaid
 * and the diagram DSL). `files` are standalone SVG documents for image elements.
 */
export async function insertElements(
  api: ExcalidrawImperativeAPI,
  els: readonly OrderedExcalidrawElement[],
  files: { id: string; svg: string }[],
  meta: BuiltItem["meta"] | Record<string, unknown>,
  opts: InsertOptions = {},
  rawFiles: BinaryFileData[] = [],
): Promise<string[]> {
  const { CaptureUpdateAction, getCommonBounds } = await import("@excalidraw/excalidraw");
  if (els.length === 0) throw new Error("Nothing to insert");

  const [x1, y1, x2, y2] = getCommonBounds(els);
  let center = opts.at;
  if (!center) {
    const c = viewportCenter(api);
    const taken = api
      .getSceneElements()
      .map((e) => getCommonBounds([e]))
      .map(([ax1, ay1, ax2, ay2]) => ({ x1: ax1, y1: ay1, x2: ax2, y2: ay2 }));
    center = findFreeSpot(taken, c, x2 - x1, y2 - y1) ?? {
      x: c.x + (cascade = (cascade + 1) % 8) * 24,
      y: c.y + cascade * 24,
    };
  }
  const dx = center.x - (x1 + x2) / 2;
  const dy = center.y - (y1 + y2) / 2;
  const groupId = crypto.randomUUID();

  const placed = els.map((e, i) => ({
    ...e,
    x: e.x + dx,
    y: e.y + dy,
    groupIds: [...e.groupIds, groupId],
    ...(i === 0 ? { customData: { ...(e.customData ?? {}), archboard: meta } } : {}),
  }));

  const existing = api.getFiles();
  const add: BinaryFileData[] = [
    ...files
      .filter((f) => !existing[f.id])
      .map((f) => ({
        id: f.id as BinaryFileData["id"],
        mimeType: "image/svg+xml" as const,
        dataURL: svgToDataURL(f.svg) as BinaryFileData["dataURL"],
        created: Date.now(),
      })),
    ...rawFiles.filter((f) => !existing[f.id]),
  ];
  if (add.length) api.addFiles(add);

  const ids = placed.map((e) => e.id);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...placed],
    appState: {
      selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])),
      selectedGroupIds: { [groupId]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return ids;
}

export function resetCascade() {
  cascade = 0;
}
