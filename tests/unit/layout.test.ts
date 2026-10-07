import { describe, expect, it } from "vitest";
import { buildUnits, layoutElements } from "@/layout/elk";
import type { El } from "@/smart/reconcile";

const box = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): El => ({
  id,
  type: "rectangle",
  x,
  y,
  width: 100,
  height: 50,
  version: 1,
  groupIds: [],
  boundElements: null,
  ...extra,
});
const arrow = (id: string, from: string, to: string, extra: Record<string, unknown> = {}): El => ({
  id,
  type: "arrow",
  x: 0,
  y: 0,
  width: 10,
  height: 0,
  points: [
    [0, 0],
    [10, 0],
  ],
  version: 1,
  startBinding: { elementId: from, gap: 8 },
  endBinding: { elementId: to, gap: 8 },
  ...extra,
});
const by = (r: { elements: El[] }) => new Map(r.elements.map((e) => [e.id, e]));

// A scrambled chain A → B → C plus a fork D.
const scene = (): El[] => [
  box("A", 400, 300),
  box("B", 20, 20),
  box("C", 700, 500),
  box("D", 100, 600),
  arrow("ab", "A", "B"),
  arrow("bc", "B", "C"),
  arrow("bd", "B", "D"),
];

describe("layoutElements", () => {
  it("top-down: each edge goes strictly downwards, nodes do not overlap", async () => {
    const m = by(await layoutElements(scene(), "down"));
    expect(m.get("B")!.y).toBeGreaterThan(m.get("A")!.y);
    expect(m.get("C")!.y).toBeGreaterThan(m.get("B")!.y);
    expect(m.get("D")!.y).toBeGreaterThan(m.get("B")!.y);
    const nodes = ["A", "B", "C", "D"].map((id) => m.get(id)!);
    for (const a of nodes)
      for (const b of nodes)
        if (a !== b)
          expect(
            a.x < b.x + b.width &&
              a.x + a.width > b.x &&
              a.y < b.y + b.height &&
              a.y + a.height > b.y,
          ).toBe(false);
  });

  it("left-to-right: edges go strictly rightwards", async () => {
    const m = by(await layoutElements(scene(), "right"));
    expect(m.get("B")!.x).toBeGreaterThan(m.get("A")!.x);
    expect(m.get("C")!.x).toBeGreaterThan(m.get("B")!.x);
  });

  it("tree, radial and layered all run and keep every node", async () => {
    for (const kind of ["tree", "radial", "layered"] as const) {
      const r = await layoutElements(scene(), kind);
      expect(r.nodeCount).toBe(4);
      expect(r.edgeCount).toBe(3);
      expect(["A", "B", "C", "D"].every((id) => by(r).has(id))).toBe(true);
    }
    const t = by(await layoutElements(scene(), "tree"));
    expect(t.get("C")!.y).toBeGreaterThan(t.get("B")!.y);
  });

  it("keeps the selection's top-left corner in place", async () => {
    const els = scene();
    const m = by(await layoutElements(els, "down"));
    const nodes = ["A", "B", "C", "D"].map((id) => m.get(id)!);
    expect(Math.min(...nodes.map((n) => n.x))).toBe(20);
    expect(Math.min(...nodes.map((n) => n.y))).toBe(20);
  });

  it("re-routes arrows so both ends meet the moved shapes", async () => {
    const m = by(await layoutElements(scene(), "down"));
    const ab = m.get("ab")!;
    const A = m.get("A")!;
    const B = m.get("B")!;
    const end = [ab.x + ab.points![1]![0]!, ab.y + ab.points![1]![1]!];
    expect(ab.x).toBeGreaterThanOrEqual(A.x - 12);
    expect(end[1]!).toBeLessThanOrEqual(B.y + 1); // ends at B's top edge (minus the gap)
    expect(end[1]!).toBeGreaterThan(A.y + A.height - 1);
  });

  it("moves a bound label with its container and keeps it inside", async () => {
    const els = [
      box("A", 300, 300, { boundElements: [{ id: "At", type: "text" }] }),
      {
        id: "At",
        type: "text",
        x: 320,
        y: 315,
        width: 60,
        height: 20,
        containerId: "A",
        version: 1,
      } as El,
      box("B", 10, 10),
      arrow("ab", "A", "B"),
    ];
    const m = by(await layoutElements(els, "down"));
    const A = m.get("A")!;
    const t = m.get("At")!;
    expect(t.x - A.x).toBe(20);
    expect(t.y - A.y).toBe(15);
  });

  it("treats a group as one node and moves its members together", async () => {
    const grp = (id: string, x: number, y: number): El => box(id, x, y, { groupIds: ["G"] });
    const els = [grp("g1", 500, 500), grp("g2", 620, 500), box("X", 0, 0), arrow("e", "X", "g1")];
    const { units } = buildUnits(els);
    expect(units).toHaveLength(2);
    const m = by(await layoutElements(els, "down"));
    expect(m.get("g2")!.x - m.get("g1")!.x).toBe(120);
    expect(m.get("g2")!.y).toBe(m.get("g1")!.y);
  });

  it("lays out disconnected nodes without overlap and handles empty input", async () => {
    const els = [box("a", 0, 0), box("b", 0, 0), box("c", 0, 0)];
    const m = by(await layoutElements(els, "right"));
    const xs = ["a", "b", "c"].map((id) => `${m.get(id)!.x},${m.get(id)!.y}`);
    expect(new Set(xs).size).toBe(3);
    expect((await layoutElements([], "down")).nodeCount).toBe(0);
  });

  it("updates arrows outside the selection that attach to a moved node", async () => {
    const inside = [box("A", 300, 300), box("B", 0, 0), arrow("ab", "A", "B")];
    const outside = box("O", 900, 900);
    const out = arrow("oa", "O", "A", {
      x: 900,
      y: 900,
      points: [
        [0, 0],
        [-100, -100],
      ],
    });
    const r = await layoutElements(inside, "down", [out]);
    const oa = by(r).get("oa")!;
    expect(oa).toBeDefined();
    expect(oa.x).toBe(900); // the free (start) end did not move
    void outside;
  });
});
