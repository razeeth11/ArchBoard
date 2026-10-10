import { fitBoundText } from "@/library/fitText";

/** The minimal element shape the Design panel needs; real Excalidraw elements satisfy it. */
export interface TEl {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  isDeleted?: boolean;
  containerId?: string | null;
  points?: readonly (readonly [number, number])[];
  version: number;
  versionNonce: number;
  [k: string]: unknown;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FREE = new Set(["text"]); // standalone text keeps its own size
export const isBoundText = (e: TEl) => e.type === "text" && !!e.containerId;

/** Elements the panel acts on: the selection without bound labels (they follow their shape). */
export function targets(all: readonly TEl[], selected: Readonly<Record<string, unknown>>): TEl[] {
  return all.filter((e) => !e.isDeleted && selected[e.id] && !isBoundText(e));
}

export function boundsOf(els: readonly TEl[]): Box | null {
  if (!els.length) return null;
  const x1 = Math.min(...els.map((e) => e.x));
  const y1 = Math.min(...els.map((e) => e.y));
  const x2 = Math.max(...els.map((e) => e.x + e.width));
  const y2 = Math.max(...els.map((e) => e.y + e.height));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const bump = <T extends TEl>(e: T): T => ({
  ...e,
  version: e.version + 1,
  versionNonce: Math.floor(Math.random() * 2 ** 31),
});

const MIN = 4;

/**
 * Move and/or scale the selection to a new bounding box. Geometry scales with the box, bound labels
 * follow their shape (and are re-wrapped if they no longer fit), standalone text keeps its size.
 * With `keepRatio` the other dimension follows.
 */
export function applyBox(
  all: readonly TEl[],
  selected: Readonly<Record<string, unknown>>,
  next: Partial<Box>,
  keepRatio: boolean,
): TEl[] {
  const picked = targets(all, selected);
  const b = boundsOf(picked);
  if (!b) return [...all];
  let w = next.w ?? b.w;
  let h = next.h ?? b.h;
  if (keepRatio && b.w > 0 && b.h > 0) {
    if (next.w !== undefined && next.h === undefined) h = (w * b.h) / b.w;
    else if (next.h !== undefined && next.w === undefined) w = (h * b.w) / b.h;
  }
  w = Math.max(MIN, w);
  h = Math.max(MIN, h);
  const nx = next.x ?? b.x;
  const ny = next.y ?? b.y;
  const sx = b.w > 0 ? w / b.w : 1;
  const sy = b.h > 0 ? h / b.h : 1;
  const ids = new Set(picked.map((e) => e.id));
  const moved = new Map<string, TEl>();

  for (const e of picked) {
    const px = nx + (e.x - b.x) * sx;
    const py = ny + (e.y - b.y) * sy;
    if (FREE.has(e.type)) {
      // Text is repositioned by its centre, not stretched.
      const cx = nx + (e.x + e.width / 2 - b.x) * sx;
      const cy = ny + (e.y + e.height / 2 - b.y) * sy;
      moved.set(e.id, bump({ ...e, x: cx - e.width / 2, y: cy - e.height / 2 }));
    } else if (e.points) {
      const pts = e.points.map(([a, c]) => [a * sx, c * sy] as [number, number]);
      moved.set(
        e.id,
        bump({ ...e, x: px, y: py, width: e.width * sx, height: e.height * sy, points: pts }),
      );
    } else {
      moved.set(
        e.id,
        bump({
          ...e,
          x: px,
          y: py,
          width: Math.max(MIN, e.width * sx),
          height: Math.max(MIN, e.height * sy),
        }),
      );
    }
  }
  // Labels follow their shape.
  const out = all.map((e) => {
    const m = moved.get(e.id);
    if (m) return m;
    if (isBoundText(e) && e.containerId && ids.has(e.containerId)) {
      const c = moved.get(e.containerId)!;
      const old = all.find((x) => x.id === e.containerId)!;
      const relY = (e.y - old.y) / Math.max(old.height, 1);
      return bump({ ...e, x: c.x + (c.width - e.width) / 2, y: c.y + relY * c.height });
    }
    return e;
  });
  return fitBoundText(out as never[]) as unknown as TEl[];
}

export function setOpacity(
  all: readonly TEl[],
  selected: Readonly<Record<string, unknown>>,
  opacity: number,
): TEl[] {
  const v = Math.min(100, Math.max(0, Math.round(opacity)));
  return all.map((e) => (!e.isDeleted && selected[e.id] ? bump({ ...e, opacity: v }) : e));
}

/** Rotation in degrees for a single selected element. */
export function setRotation(
  all: readonly TEl[],
  selected: Readonly<Record<string, unknown>>,
  degrees: number,
): TEl[] {
  const rad = (((degrees % 360) + 360) % 360) * (Math.PI / 180);
  return all.map((e) => {
    if (e.isDeleted || !selected[e.id]) return e;
    return bump({ ...e, angle: rad });
  });
}
