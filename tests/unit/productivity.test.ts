import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { fuzzyScore, rank } from "@/palette/fuzzy";
import { BUILTIN_PRESETS, applyPresetTo, sanitizePresets } from "@/styles/presets";
import { NOTES_KEY, orderedFrames, slidesOf, withNotes } from "@/present/slides";
import * as comments from "@/persistence/comments";
import { getDb } from "@/persistence/db";

const el = (o: Record<string, unknown>) =>
  ({
    id: "x",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    version: 1,
    isDeleted: false,
    ...o,
  }) as never;

describe("fuzzy", () => {
  it("prefers exact, then prefix, then substring, then subsequence", () => {
    const order = ["Version history", "History of versions", "Share via link"];
    expect(rank(order, "history", (s) => s)[0]).toBe("History of versions");
    expect(fuzzyScore("vhist", "Version history")).toBeGreaterThan(0);
    expect(fuzzyScore("zzz", "Version history")).toBe(-1);
    expect(rank(order, "", (s) => s)).toHaveLength(3);
  });
});

describe("style presets", () => {
  it("restyles shapes fully, arrows by stroke only, text by font", () => {
    const bp = BUILTIN_PRESETS.find((p) => p.id === "blueprint")!;
    const rect = applyPresetTo(el({}), bp) as unknown as Record<string, unknown>;
    expect(rect).toMatchObject({ strokeColor: bp.strokeColor, roughness: 0, version: 2 });
    const arrow = applyPresetTo(el({ type: "arrow" }), bp) as unknown as Record<string, unknown>;
    expect(arrow.backgroundColor).toBeUndefined();
    const text = applyPresetTo(el({ type: "text" }), bp) as unknown as Record<string, unknown>;
    expect(text).toMatchObject({ fontFamily: bp.fontFamily });
    expect(applyPresetTo(el({ isDeleted: true }), bp)).toMatchObject({ version: 1 });
  });
  it("sanitizes stored presets", () => {
    expect(sanitizePresets("nope")).toEqual([]);
    const out = sanitizePresets([{ id: "a", name: "n".repeat(100), roughness: 9 }, { id: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ roughness: 1, builtin: false });
    expect(out[0]!.name).toHaveLength(40);
  });
});

describe("slides", () => {
  it("orders frames in rows then columns and stores notes in customData", () => {
    const frames = [
      el({ id: "c", type: "frame", x: 0, y: 600, name: "C" }),
      el({ id: "b", type: "frame", x: 900, y: 10, name: "B" }),
      el({ id: "a", type: "frame", x: 0, y: 0, name: "A" }),
      el({ id: "gone", type: "frame", isDeleted: true }),
    ];
    expect(orderedFrames(frames).map((f) => f.id)).toEqual(["a", "b", "c"]);
    const noted = withNotes(frames[2]!, "hello") as unknown as {
      customData: Record<string, string>;
    };
    expect(noted.customData[NOTES_KEY]).toBe("hello");
    expect(slidesOf([noted as never])[0]!.notes).toBe("hello");
    expect(
      (withNotes(noted as never, " ") as unknown as { customData?: unknown }).customData,
    ).toBeUndefined();
  });
});

describe("comments repo", () => {
  beforeEach(async () => {
    await getDb().comments.clear();
  });
  it("adds, resolves, scopes by page and deletes", async () => {
    const c = await comments.addComment("s", "p1", "  hi  ", { x: 1, y: 2 });
    await comments.addComment("s", "p2", "other page", { elementId: "e" });
    expect((await comments.listComments("s", "p1")).map((x) => x.text)).toEqual(["hi"]);
    await comments.setResolved(c.id, true);
    expect((await comments.listComments("s", "p1"))[0]!.resolved).toBe(true);
    await comments.deleteComment(c.id);
    expect(await comments.listComments("s", "p1")).toEqual([]);
    await expect(comments.addComment("s", "p1", "   ", { x: 0, y: 0 })).rejects.toThrow();
  });
  it("anchors follow elements and report deleted targets", () => {
    const els = [
      { id: "e", x: 10, y: 20, width: 100 },
      { id: "d", x: 0, y: 0, width: 1, isDeleted: true },
    ];
    expect(comments.anchorPoint({ elementId: "e" }, els)).toEqual({ x: 110, y: 20 });
    expect(comments.anchorPoint({ elementId: "d" }, els)).toBeNull();
    expect(comments.anchorPoint({ x: 3, y: 4 }, els)).toEqual({ x: 3, y: 4 });
  });
});
