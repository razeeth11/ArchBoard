import { describe, expect, it } from "vitest";
import { applyBox, boundsOf, setOpacity, setRotation, targets, type TEl } from "@/engine/transform";

const el = (id: string, o: Partial<TEl> = {}): TEl => ({
  id,
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  angle: 0,
  opacity: 100,
  version: 1,
  versionNonce: 1,
  ...o,
});
const sel = (...ids: string[]) => Object.fromEntries(ids.map((i) => [i, true]));

describe("design panel geometry", () => {
  it("moves a single element", () => {
    const out = applyBox([el("a", { x: 10, y: 20 })], sel("a"), { x: 50, y: 60 }, false);
    expect(out[0]).toMatchObject({ x: 50, y: 60, width: 100, height: 50, version: 2 });
  });
  it("resizes, and keeps the aspect ratio when asked", () => {
    const free = applyBox([el("a")], sel("a"), { w: 200 }, false)[0]!;
    expect([free.width, free.height]).toEqual([200, 50]);
    const locked = applyBox([el("a")], sel("a"), { w: 200 }, true)[0]!;
    expect([locked.width, locked.height]).toEqual([200, 100]);
    const byH = applyBox([el("a")], sel("a"), { h: 100 }, true)[0]!;
    expect([byH.width, byH.height]).toEqual([200, 100]);
  });
  it("scales a multi-selection as one box, preserving relative positions", () => {
    const all = [el("a", { x: 0, y: 0 }), el("b", { x: 100, y: 50 })];
    const out = applyBox(all, sel("a", "b"), { w: 400 }, false);
    expect(boundsOf(out)).toMatchObject({ x: 0, w: 400 });
    expect(out[1]!.x).toBeCloseTo(200);
    expect(out[0]!.width).toBeCloseTo(200);
  });
  it("never collapses below a minimum size", () => {
    expect(applyBox([el("a")], sel("a"), { w: 0, h: -5 }, false)[0]).toMatchObject({
      width: 4,
      height: 4,
    });
  });
  it("labels follow their shape and stay centred; unselected elements are untouched", () => {
    const label = el("t", {
      type: "text",
      containerId: "a",
      x: 30,
      y: 15,
      width: 40,
      height: 20,
      fontSize: 16,
      text: "Hi",
      originalText: "Hi",
    });
    const other = el("z", { x: 500 });
    const out = applyBox([el("a"), label, other], sel("a"), { x: 100, y: 100, w: 200 }, false);
    expect(out[1]!.x).toBeCloseTo(100 + (200 - 40) / 2);
    expect(out[2]).toBe(other);
    expect(targets([el("a"), label], sel("a", "t")).map((e) => e.id)).toEqual(["a"]);
  });
  it("scales the points of arrows and lines", () => {
    const arrow = el("l", {
      type: "arrow",
      width: 100,
      height: 0,
      points: [
        [0, 0],
        [100, 0],
      ],
    });
    const out = applyBox([arrow], sel("l"), { w: 300 }, false)[0]!;
    expect(out.points).toEqual([
      [0, 0],
      [300, 0],
    ]);
  });
  it("sets opacity (clamped) and rotation (degrees → radians)", () => {
    expect(setOpacity([el("a")], sel("a"), 140)[0]!.opacity).toBe(100);
    expect(setOpacity([el("a")], sel("a"), 35.4)[0]!.opacity).toBe(35);
    expect(setRotation([el("a")], sel("a"), 90)[0]!.angle).toBeCloseTo(Math.PI / 2);
    expect(setRotation([el("a")], sel("a"), -90)[0]!.angle).toBeCloseTo((3 * Math.PI) / 2);
  });
});
