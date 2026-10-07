import { edgePoint, routeArrow, type El } from "@/smart/reconcile";

export type LayoutKind = "down" | "right" | "layered" | "tree" | "radial";

export const LAYOUTS: { kind: LayoutKind; label: string; description: string }[] = [
  { kind: "down", label: "Top-down", description: "Layers flow from top to bottom" },
  { kind: "right", label: "Left-to-right", description: "Layers flow from left to right" },
  {
    kind: "layered",
    label: "Layered (compact)",
    description: "Layered with tighter spacing and straighter edges",
  },
  { kind: "tree", label: "Tree", description: "Hierarchy with a root at the top" },
  { kind: "radial", label: "Radial", description: "Root in the centre, children on rings" },
];

const OPTIONS: Record<LayoutKind, Record<string, string>> = {
  down: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.spacing.nodeNode": "50",
    "elk.layered.spacing.nodeNodeBetweenLayers": "90",
  },
  right: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.spacing.nodeNode": "50",
    "elk.layered.spacing.nodeNodeBetweenLayers": "110",
  },
  layered: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.spacing.nodeNode": "30",
    "elk.layered.spacing.nodeNodeBetweenLayers": "60",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
  },
  tree: { "elk.algorithm": "mrtree", "elk.direction": "DOWN", "elk.spacing.nodeNode": "40" },
  radial: { "elk.algorithm": "radial", "elk.spacing.nodeNode": "60", "elk.radial.radius": "180" },
};

interface ElkLike {
  layout(graph: unknown): Promise<{ children?: { id: string; x?: number; y?: number }[] }>;
}

let elk: Promise<ElkLike> | null = null;

/** In the browser layout runs in a Web Worker (off the main thread); elsewhere the bundled engine is used. */
function getElk(): Promise<ElkLike> {
  elk ??= (async () => {
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      const { default: ELK } = await import("elkjs/lib/elk-api");
      const base =
        (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH ?? "/";
      return new ELK({ workerUrl: `${base}elk-worker.min.js` }) as unknown as ElkLike;
    }
    const { default: ELK } = await import("elkjs/lib/elk.bundled");
    return new ELK() as unknown as ElkLike;
  })();
  return elk;
}

interface Unit {
  key: string;
  members: El[];
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Node units: a shape plus its bound label, or a whole group moving as one. */
export function buildUnits(elements: readonly El[]): { units: Unit[]; owner: Map<string, string> } {
  const live = elements.filter((e) => !e.isDeleted && e.type !== "arrow");
  const byId = new Map(live.map((e) => [e.id, e]));
  const groups = new Map<string, El[]>();
  const owner = new Map<string, string>();
  const shapes = live.filter((e) => ["rectangle", "ellipse", "diamond"].includes(e.type));
  // An icon sitting inside a shape (the DSL puts one in every node) belongs to that shape's unit.
  const iconHost = (e: El) => {
    if (e.type !== "image" || (e as unknown as { groupIds?: string[] }).groupIds?.length)
      return undefined;
    let best: El | undefined;
    for (const s of shapes) {
      const inside =
        e.x >= s.x - 1 &&
        e.y >= s.y - 1 &&
        e.x + e.width <= s.x + s.width + 1 &&
        e.y + e.height <= s.y + s.height + 1;
      if (inside && (!best || s.width * s.height < best.width * best.height)) best = s;
    }
    return best;
  };
  for (const e of live) {
    const host =
      e.type === "text" && e.containerId && byId.has(e.containerId)
        ? byId.get(e.containerId)!
        : (iconHost(e) ?? e);
    const groupIds = (host as unknown as { groupIds?: string[] }).groupIds ?? [];
    const key = groupIds.length ? `g:${groupIds[groupIds.length - 1]}` : host.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
    owner.set(e.id, key);
  }
  const units: Unit[] = [...groups].map(([key, members]) => {
    const boxes = members.filter((m) => !(m.type === "text" && m.containerId)); // labels never extend a unit
    const use = boxes.length ? boxes : members;
    const x1 = Math.min(...use.map((m) => m.x));
    const y1 = Math.min(...use.map((m) => m.y));
    const x2 = Math.max(...use.map((m) => m.x + m.width));
    const y2 = Math.max(...use.map((m) => m.y + m.height));
    return { key, members, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  });
  return { units, owner };
}

export interface LayoutResult {
  /** Changed elements (nodes, bound labels, re-routed arrows), ready to merge by id. */
  elements: El[];
  nodeCount: number;
  edgeCount: number;
}

const bump = (e: El): El => ({
  ...e,
  version: (e.version ?? 0) + 1,
  versionNonce: Math.floor(Math.random() * 2 ** 31),
  updated: Date.now(),
});

/**
 * Tidy a set of elements with ELK. Nodes are shapes (groups move as one); edges are arrows bound at both
 * ends. The result keeps the original top-left corner, and arrows are re-routed to the new positions.
 */
export async function layoutElements(
  elements: readonly El[],
  kind: LayoutKind,
  /** Arrows elsewhere in the scene that touch these nodes (so their ends can follow). */
  outsideArrows: readonly El[] = [],
): Promise<LayoutResult> {
  const { units, owner } = buildUnits(elements);
  if (units.length === 0) return { elements: [], nodeCount: 0, edgeCount: 0 };
  const arrows = [...elements, ...outsideArrows].filter((e) => e.type === "arrow" && !e.isDeleted);
  const unitOf = (id?: string | null) => (id ? owner.get(id) : undefined);
  const edges: { id: string; sources: string[]; targets: string[] }[] = [];
  const seen = new Set<string>();
  for (const a of arrows) {
    const s = unitOf(a.startBinding?.elementId);
    const t = unitOf(a.endBinding?.elementId);
    if (!s || !t || s === t || seen.has(a.id)) continue;
    seen.add(a.id);
    edges.push({ id: a.id, sources: [s], targets: [t] });
  }

  const engine = await getElk();
  const graph = {
    id: "root",
    layoutOptions: { ...OPTIONS[kind], "elk.padding": "[top=0,left=0,bottom=0,right=0]" },
    children: units.map((u) => ({ id: u.key, width: Math.max(1, u.w), height: Math.max(1, u.h) })),
    edges,
  };
  const out = await engine.layout(graph);
  const pos = new Map((out.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));

  const left = Math.min(...units.map((u) => u.x));
  const top = Math.min(...units.map((u) => u.y));
  const minX = Math.min(...[...pos.values()].map((p) => p.x));
  const minY = Math.min(...[...pos.values()].map((p) => p.y));

  const moved = new Map<string, El>();
  for (const u of units) {
    const p = pos.get(u.key)!;
    const dx = left + (p.x - minX) - u.x;
    const dy = top + (p.y - minY) - u.y;
    for (const m of u.members) moved.set(m.id, bump({ ...m, x: m.x + dx, y: m.y + dy }));
  }

  // Re-route arrows against the new positions.
  const all = new Map<string, El>([...elements.map((e) => [e.id, e] as const), ...moved]);
  const arrowOut: El[] = [];
  for (const a of arrows) {
    const bothEnds =
      a.startBinding &&
      a.endBinding &&
      all.has(a.startBinding.elementId) &&
      all.has(a.endBinding.elementId);
    const touches =
      moved.has(a.startBinding?.elementId ?? "") || moved.has(a.endBinding?.elementId ?? "");
    if (!touches) continue;
    if (bothEnds) {
      const r = routeArrow(a, all);
      if (r) arrowOut.push(bump({ ...a, ...r }));
    } else {
      // One end is free: keep it where it is and bring the bound end to the moved shape's edge.
      const ptsAbs = (a.points ?? []).map(([px, py]) => [a.x + px, a.y + py] as [number, number]);
      const isStart = !!a.startBinding && moved.has(a.startBinding.elementId);
      const target = all.get((isStart ? a.startBinding : a.endBinding)!.elementId)!;
      const otherEnd = isStart ? ptsAbs[ptsAbs.length - 1]! : ptsAbs[0]!;
      const p = edgePoint(target, otherEnd, 8);
      if (isStart) ptsAbs[0] = p;
      else ptsAbs[ptsAbs.length - 1] = p;
      const [ox, oy] = ptsAbs[0]!;
      arrowOut.push(
        bump({
          ...a,
          x: ox,
          y: oy,
          points: ptsAbs.map(([x, y]) => [x - ox, y - oy] as [number, number]),
        }),
      );
    }
  }
  // Keep arrow labels centred on their arrows.
  const result = new Map<string, El>(moved);
  for (const a of arrowOut) {
    result.set(a.id, a);
    const label = [...all.values()].find((e) => e.type === "text" && e.containerId === a.id);
    if (label) {
      const end = a.points![a.points!.length - 1]!;
      result.set(
        label.id,
        bump({
          ...label,
          x: a.x + end[0] / 2 - label.width / 2,
          y: a.y + end[1] / 2 - label.height / 2,
        }),
      );
    }
  }
  return { elements: [...result.values()], nodeCount: units.length, edgeCount: edges.length };
}
