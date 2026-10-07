import { describe, expect, it } from "vitest";
import { reconcile, rebindExternal, type El } from "@/smart/reconcile";

let n = 0;
const el = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): El => ({
  id,
  type: "rectangle",
  x,
  y,
  width: 100,
  height: 50,
  strokeColor: "#000",
  backgroundColor: "#fff",
  version: 1,
  boundElements: null,
  groupIds: ["g1"],
  index: `a${n++}`,
  customData: { smartComponent: { id: "t", version: 1, instance: "i", role: id } },
  ...extra,
});
const byId = (xs: El[]) => new Map(xs.map((e) => [e.id, e]));

describe("reconcile", () => {
  const baseline = [el("root", 0, 0), el("a", 10, 10), el("b", 10, 80)];

  it("keeps the component where the user moved it", () => {
    const current = baseline.map((e) => ({ ...e, x: e.x + 500, y: e.y + 300 }));
    const next = [
      el("root", 0, 0, { height: 200 }),
      el("a", 10, 10),
      el("b", 10, 80),
      el("c", 10, 150),
    ];
    const r = reconcile({ current, baseline, next, rootId: "root" });
    expect([r.dx, r.dy]).toEqual([500, 300]);
    const out = byId(r.elements);
    expect(out.get("root")).toMatchObject({ x: 500, y: 300, height: 200 });
    expect(out.get("c")).toMatchObject({ x: 510, y: 450 });
    expect(r.addedIds).toEqual(["c"]);
  });

  it("keeps hand-made style and text edits but updates untouched fields", () => {
    const current = [
      el("root", 0, 0),
      el("a", 10, 10, { backgroundColor: "#ff0000", text: "My label", originalText: "My label" }),
      el("b", 10, 80),
    ];
    const base = [
      el("root", 0, 0),
      el("a", 10, 10, { text: "Replica 1", originalText: "Replica 1" }),
      el("b", 10, 80),
    ];
    const next = [
      el("root", 0, 0),
      el("a", 10, 10, {
        backgroundColor: "#00ff00",
        strokeColor: "#123",
        text: "Replica 1",
        originalText: "Replica 1",
      }),
      el("b", 10, 80, { backgroundColor: "#0f0" }),
    ];
    const out = byId(reconcile({ current, baseline: base, next, rootId: "root" }).elements);
    expect(out.get("a")).toMatchObject({
      backgroundColor: "#ff0000",
      text: "My label",
      strokeColor: "#123",
    });
    expect(out.get("b")!.backgroundColor).toBe("#0f0"); // not overridden → follows the generator
  });

  it("an unchanged label follows the generator when the props change", () => {
    const base = [el("root", 0, 0), el("a", 0, 0, { text: "Replica 1" })];
    const current = base;
    const next = [el("root", 0, 0), el("a", 0, 0, { text: "Replica ONE" })];
    expect(
      byId(reconcile({ current, baseline: base, next, rootId: "root" }).elements).get("a")!.text,
    ).toBe("Replica ONE");
  });

  it("marks parts that disappeared as deleted and bumps versions", () => {
    const r = reconcile({
      current: baseline,
      baseline,
      next: [el("root", 0, 0), el("a", 10, 10)],
      rootId: "root",
    });
    expect(r.removedIds).toEqual(["b"]);
    const out = byId(r.elements);
    expect(out.get("b")!.isDeleted).toBe(true);
    expect(out.get("b")!.version).toBeGreaterThan(1);
    expect(out.get("a")!.version).toBeGreaterThan(1);
  });

  it("preserves arrows from outside that are attached to a surviving element", () => {
    const current = [
      el("root", 0, 0),
      el("a", 10, 10, {
        boundElements: [
          { id: "internal", type: "arrow" },
          { id: "outside-arrow", type: "arrow" },
        ],
      }),
      el("internal", 0, 0, { type: "arrow" }),
    ];
    const base = [
      el("root", 0, 0),
      el("a", 10, 10, { boundElements: [{ id: "internal", type: "arrow" }] }),
      el("internal", 0, 0, { type: "arrow" }),
    ];
    const next = [
      el("root", 0, 0),
      el("a", 10, 10, { boundElements: [{ id: "internal", type: "arrow" }] }),
      el("internal", 0, 0, { type: "arrow" }),
    ];
    const a = byId(reconcile({ current, baseline: base, next, rootId: "root" }).elements).get("a")!;
    expect(a.boundElements?.map((b) => b.id).sort()).toEqual(["internal", "outside-arrow"]);
  });

  it("never lets the generator override canvas-owned structure (group, frame, z-index, lock)", () => {
    const current = [
      el("root", 0, 0, { groupIds: ["g1", "outer"], frameId: "f", locked: true, index: "a9" }),
      el("a", 0, 0),
    ];
    const next = [
      el("root", 0, 0, { groupIds: [], frameId: null, locked: false, index: "a0" }),
      el("a", 0, 0),
    ];
    expect(
      byId(reconcile({ current, baseline: current, next, rootId: "root" }).elements).get("root"),
    ).toMatchObject({ groupIds: ["g1", "outer"], frameId: "f", locked: true, index: "a9" });
  });

  it("falls back to the bounding box when the root was deleted", () => {
    const current = [el("a", 300, 300), el("b", 300, 370)];
    const r = reconcile({
      current,
      baseline,
      next: [el("root", 0, 0), el("a", 10, 10), el("b", 10, 80)],
      rootId: "root",
    });
    expect([r.dx, r.dy]).toEqual([290, 290]);
    expect(r.addedIds).toContain("root"); // restored
  });
});

describe("rebindExternal", () => {
  const target = (x: number, y: number) => el("t", x, y, { width: 100, height: 100 });
  const arrow = (extra: Partial<El> = {}): El => ({
    id: "arrow",
    type: "arrow",
    x: 0,
    y: 50,
    width: 100,
    height: 0,
    points: [
      [0, 0],
      [100, 0],
    ],
    endBinding: { elementId: "t", gap: 8 },
    startBinding: null,
    version: 1,
    ...extra,
  });

  it("moves the bound end to the target's new edge", () => {
    const moved = rebindExternal([arrow()], new Map([["t", target(400, 0)]]), new Set());
    expect(moved).toHaveLength(1);
    const a = moved[0]!;
    const end = [a.x + a.points![1]![0], a.y + a.points![1]![1]];
    expect(end[0]).toBeCloseTo(392, 0); // left edge (400) minus the 8px gap
    expect(a.x).toBe(0); // the free end stays put
  });

  it("unbinds ends attached to removed parts", () => {
    const out = rebindExternal([arrow()], new Map(), new Set(["t"]));
    expect(out[0]!.endBinding).toBeNull();
    expect(out[0]!.points).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("handles a bound start end and ignores unrelated arrows", () => {
    const out = rebindExternal(
      [
        arrow({
          id: "s",
          startBinding: { elementId: "t", gap: 8 },
          endBinding: null,
          x: 500,
          points: [
            [0, 50],
            [150, 50],
          ],
        }),
        arrow({ id: "other", endBinding: { elementId: "zzz" } }),
      ],
      new Map([["t", target(200, 0)]]),
      new Set(),
    );
    expect(out.map((a) => a.id)).toEqual(["s"]);
  });
});
