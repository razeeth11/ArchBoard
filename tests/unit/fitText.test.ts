import { describe, expect, it } from "vitest";
import { fitBoundText, wrapToWidth } from "@/library/fitText";

const box = (o: Record<string, unknown> = {}) => ({
  id: "b",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 150,
  height: 88,
  ...o,
});
const label = (text: string, w: number, h: number, o: Record<string, unknown> = {}) => ({
  id: "t",
  type: "text",
  containerId: "b",
  x: 100,
  y: 130,
  width: w,
  height: h,
  text,
  originalText: text,
  fontSize: 16,
  lineHeight: 1.25,
  textAlign: "center",
  verticalAlign: "middle",
  autoResize: true,
  version: 1,
  ...o,
});

describe("fitBoundText", () => {
  it("leaves labels that already fit exactly as they were", () => {
    const els = [box(), label("API", 30, 20)];
    const before = JSON.stringify(els);
    fitBoundText(els as never);
    expect(JSON.stringify(els)).toBe(before);
  });
  it("wraps a long label to the shape's width and grows the height to hold it", () => {
    const text =
      "Orders service with a very long descriptive label that cannot possibly fit on one line";
    const els = [box(), label(text, text.length * 8, 20)] as never[];
    fitBoundText(els);
    const [b, t] = els as unknown as {
      width: number;
      height: number;
      x: number;
      y: number;
      text: string;
    }[];
    expect(b!.width).toBe(150); // width is kept
    expect(b!.height).toBeGreaterThan(88); // height grows
    expect(t!.text.split("\n").length).toBeGreaterThan(2);
    expect(t!.text.replace(/\n/g, " ")).toBe(text);
    expect(t!.width).toBeLessThanOrEqual(150);
    expect(t!.y).toBeGreaterThanOrEqual(b!.y);
    expect(t!.y + (t as unknown as { height: number }).height).toBeLessThanOrEqual(
      b!.y + b!.height,
    );
  });
  it("breaks a single word that is wider than the shape", () => {
    expect(
      wrapToWidth("Supercalifragilisticexpialidocious", 8, 80).every((l) => l.length <= 10),
    ).toBe(true);
  });
  it("reserves room for an icon at the top of the shape", () => {
    const els = [
      box(),
      { id: "i", type: "image", x: 155, y: 110, width: 40, height: 40 },
      label("Two lines of label text here", 220, 20, { verticalAlign: "bottom" }),
    ] as never[];
    fitBoundText(els);
    const [b, , t] = els as unknown as { y: number; height: number; text: string }[];
    expect(t!.y).toBeGreaterThanOrEqual(110 + 40); // below the icon
    expect(t!.y + 20).toBeLessThanOrEqual(b!.y + b!.height + 40);
  });
});
