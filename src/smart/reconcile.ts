import { META_KEY, type SmartMeta } from "./types";

/** The subset of an Excalidraw element this module reads/writes (kept loose on purpose). */
export interface El {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  version?: number;
  versionNonce?: number;
  updated?: number;
  customData?: Record<string, unknown>;
  boundElements?: { id: string; type: string }[] | null;
  containerId?: string | null;
  points?: [number, number][];
  startBinding?: { elementId: string; focus?: number; gap?: number } | null;
  endBinding?: { elementId: string; focus?: number; gap?: number } | null;
  [k: string]: unknown;
}

/** Fields a user can restyle by hand. If they differ from the previous generation, they are kept. */
const OVERRIDABLE = [
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "roundness",
  "fontFamily",
  "fontSize",
  "textAlign",
  "verticalAlign",
  "startArrowhead",
  "endArrowhead",
  "link",
] as const;

const TEXT_FIELDS = ["text", "originalText"] as const;

export const metaOf = (e: El): SmartMeta | undefined =>
  (e.customData as Record<string, SmartMeta> | undefined)?.[META_KEY];

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

const nonce = () => Math.floor(Math.random() * 2 ** 31);

function bump(e: El): El {
  return { ...e, version: (e.version ?? 0) + 1, versionNonce: nonce(), updated: Date.now() };
}

export interface ReconcileInput {
  /** Live elements currently on the canvas that belong to the instance. */
  current: El[];
  /** What the previous props generated (materialized at the origin). */
  baseline: El[];
  /** What the new props generate (materialized at the origin). */
  next: El[];
  /** Role (suffix) of the element whose position anchors the layout. */
  rootId: string;
}

export interface ReconcileResult {
  /** Final elements for the instance (kept + changed + new + newly deleted), by id. */
  elements: El[];
  removedIds: string[];
  addedIds: string[];
  /** Translation applied to the regenerated layout. */
  dx: number;
  dy: number;
}

/**
 * Merge a freshly generated layout into the elements already on the canvas:
 * - geometry follows the new layout, anchored where the root currently sits (so moving the
 *   component first and editing it later keeps its position);
 * - style and text edits made by hand survive (a field is an override when it differs from what the
 *   previous generation produced);
 * - arrows from outside that are bound to a surviving element stay bound (ids are stable);
 * - parts that no longer exist are marked deleted, parts that are new are added.
 */
export function reconcile({ current, baseline, next, rootId }: ReconcileInput): ReconcileResult {
  const cur = new Map(current.map((e) => [e.id, e]));
  const base = new Map(baseline.map((e) => [e.id, e]));
  const nextIds = new Set(next.map((e) => e.id));
  const instanceIds = new Set([...cur.keys(), ...base.keys(), ...nextIds]);

  const curRoot = cur.get(rootId);
  const baseRoot = base.get(rootId);
  let dx = 0;
  let dy = 0;
  if (curRoot && baseRoot) {
    dx = curRoot.x - baseRoot.x;
    dy = curRoot.y - baseRoot.y;
  } else {
    // Root was deleted: anchor on any part that exists both on the canvas and in the old layout.
    const common = baseline.find((e) => cur.has(e.id));
    if (common) {
      dx = cur.get(common.id)!.x - common.x;
      dy = cur.get(common.id)!.y - common.y;
    }
  }

  const out: El[] = [];
  const addedIds: string[] = [];

  for (const n of next) {
    const c = cur.get(n.id);
    const b = base.get(n.id);
    if (!c) {
      out.push({ ...n, x: n.x + dx, y: n.y + dy });
      addedIds.push(n.id);
      continue;
    }
    const merged: El = { ...c, ...n, x: n.x + dx, y: n.y + dy, isDeleted: false };

    for (const f of OVERRIDABLE) {
      if (b && !deepEqual(c[f], b[f])) merged[f] = c[f]; // the user changed it: keep their value
    }
    for (const f of TEXT_FIELDS) {
      if (b && f in c && !deepEqual(c[f], b[f])) {
        merged[f] = c[f];
        merged.width = c.width;
        merged.height = c.height;
      }
    }
    // Arrows from outside the instance that are attached here must stay attached.
    const external = (c.boundElements ?? []).filter((be) => !instanceIds.has(be.id));
    const internal = n.boundElements ?? [];
    const all = [...internal, ...external];
    merged.boundElements = all.length ? all : null;
    // Structure that belongs to the canvas, not the generator, stays as the user left it.
    for (const f of ["groupIds", "frameId", "index", "locked"] as const)
      if (f in c) merged[f] = c[f];
    merged.customData = { ...(c.customData ?? {}), ...(n.customData ?? {}) };
    out.push(bump(merged));
  }

  const removedIds: string[] = [];
  for (const c of current) {
    if (!nextIds.has(c.id)) {
      removedIds.push(c.id);
      out.push(bump({ ...c, isDeleted: true }));
    }
  }
  return { elements: out, removedIds, addedIds, dx, dy };
}

type Pt = [number, number];
const absPoints = (a: El): Pt[] => (a.points ?? []).map(([px, py]) => [a.x + px, a.y + py]);

/**
 * Point where the ray from `box`'s centre towards `from` leaves the shape (plus `gap`), using the
 * real outline for ellipses and diamonds and the bounding box for everything else.
 */
export function edgePoint(box: El, from: Pt, gap: number): Pt {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const hw = box.width / 2;
  const hh = box.height / 2;
  const dx = from[0] - cx;
  const dy = from[1] - cy;
  if ((dx === 0 && dy === 0) || hw === 0 || hh === 0) return [cx + hw + gap, cy];
  let t: number;
  if (box.type === "ellipse") t = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
  else if (box.type === "diamond") t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else
    t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  const len = Math.hypot(dx, dy);
  const k = t + gap / len; // push the end `gap` px outside the outline along the same ray
  return [cx + dx * k, cy + dy * k];
}

/** Straight route between two bound shapes, or null if either end is missing. */
export function routeArrow(
  arrow: El,
  byId: Map<string, El>,
): { x: number; y: number; points: Pt[]; width: number; height: number } | null {
  const s = arrow.startBinding && byId.get(arrow.startBinding.elementId);
  const e = arrow.endBinding && byId.get(arrow.endBinding.elementId);
  if (!s || !e) return null;
  const sc: Pt = [s.x + s.width / 2, s.y + s.height / 2];
  const ec: Pt = [e.x + e.width / 2, e.y + e.height / 2];
  const p1 = edgePoint(s, ec, arrow.startBinding?.gap ?? 8);
  const p2 = edgePoint(e, sc, arrow.endBinding?.gap ?? 8);
  return {
    x: p1[0],
    y: p1[1],
    points: [
      [0, 0],
      [p2[0] - p1[0], p2[1] - p1[1]],
    ],
    width: Math.abs(p2[0] - p1[0]),
    height: Math.abs(p2[1] - p1[1]),
  };
}

function withPoints(a: El, abs: Pt[]): El {
  const [ox, oy] = abs[0]!;
  const xs = abs.map((p) => p[0]);
  const ys = abs.map((p) => p[1]);
  return bump({
    ...a,
    x: ox,
    y: oy,
    points: abs.map(([px, py]) => [px - ox, py - oy] as Pt),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  });
}

/**
 * After the instance changed shape, fix arrows that live outside it:
 * unbind ends attached to removed parts, and move ends attached to surviving parts so they meet the
 * part's new edge instead of floating where it used to be.
 */
export function rebindExternal(
  arrows: El[],
  instanceAfter: Map<string, El>,
  removedIds: Set<string>,
): El[] {
  const changed: El[] = [];
  for (const arrow of arrows) {
    if (!arrow.points || arrow.points.length < 2) continue;
    let a = arrow;
    let touched = false;
    for (const end of ["startBinding", "endBinding"] as const) {
      const binding = a[end];
      if (!binding) continue;
      if (removedIds.has(binding.elementId)) {
        a = { ...a, [end]: null };
        touched = true;
        continue;
      }
      const target = instanceAfter.get(binding.elementId);
      if (!target || target.isDeleted) continue;
      const abs = absPoints(a);
      const isStart = end === "startBinding";
      const other = isStart
        ? abs[abs.length > 2 ? 1 : abs.length - 1]!
        : abs[abs.length > 2 ? abs.length - 2 : 0]!;
      const p = edgePoint(target, other, binding.gap ?? 8);
      abs[isStart ? 0 : abs.length - 1] = p;
      a = withPoints(a, abs);
      touched = true;
    }
    if (touched) changed.push(a.version === arrow.version ? bump(a) : a);
  }
  return changed;
}
