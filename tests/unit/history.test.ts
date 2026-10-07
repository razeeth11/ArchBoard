import { beforeEach, describe, expect, it } from "vitest";
import { gunzipJson, gzipJson, fromBase64Url, toBase64Url } from "@/lib/compress";
import { ArchBoardDB, setDb } from "@/persistence/db";
import {
  SnapshotScheduler,
  deleteSnapshot,
  diffElements,
  listSnapshots,
  loadSnapshot,
  renameSnapshot,
  restoreSnapshot,
  selectPrune,
  takeSnapshot,
} from "@/persistence/history";
import * as repo from "@/persistence/repo";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

let n = 0;
beforeEach(() => setDb(new ArchBoardDB(`hist-${++n}-${Date.now()}`)));
const el = (id: string, version = 1) =>
  ({ id, type: "rectangle", version, isDeleted: false }) as unknown as ExcalidrawElement;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("compression helpers", () => {
  it("round-trips JSON and base64url", async () => {
    const v = { a: [1, 2, 3], s: "héllo ✓".repeat(50) };
    const gz = await gzipJson(v);
    expect(gz.length).toBeLessThan(JSON.stringify(v).length);
    expect(await gunzipJson(gz)).toEqual(v);
    const bytes = new Uint8Array([0, 255, 250, 62, 63, 1]);
    const s = toBase64Url(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(fromBase64Url(s))).toEqual(Array.from(bytes));
  });
});

describe("selectPrune policy", () => {
  const now = 1_000 * DAY;
  const snap = (id: string, ageMs: number, kind: "auto" | "named" | "pre-restore" = "auto") => ({
    id,
    createdAt: now - ageMs,
    kind,
  });
  it("keeps one snapshot per 5-minute bucket in the last hour, newest wins", () => {
    const s = [snap("a", 1 * MIN), snap("b", 2 * MIN), snap("c", 4 * MIN), snap("d", 9 * MIN)];
    const drop = selectPrune(s, now);
    const kept = s.map((x) => x.id).filter((id) => !drop.includes(id));
    expect(kept.length).toBeLessThan(s.length);
    expect(kept).toContain("a");
    expect(drop).not.toContain("a");
  });
  it("thins to hourly then daily, and drops anything older than 30 days", () => {
    const s = [
      snap("h1", 2 * HOUR + 5 * MIN),
      snap("h2", 2 * HOUR + 20 * MIN),
      snap("d1", 3 * DAY + HOUR),
      snap("d2", 3 * DAY + 5 * HOUR),
      snap("old", 31 * DAY),
    ];
    const drop = selectPrune(s, now);
    expect(drop).toContain("old");
    expect(drop.filter((x) => ["h1", "h2"].includes(x))).toHaveLength(1);
    expect(drop.filter((x) => ["d1", "d2"].includes(x))).toHaveLength(1);
  });
  it("never prunes named checkpoints, however old, and keeps the newest five pre-restore copies", () => {
    const s = [
      snap("named", 90 * DAY, "named"),
      ...Array.from({ length: 8 }, (_, i) => snap(`p${i}`, i * HOUR, "pre-restore")),
    ];
    const drop = selectPrune(s, now);
    expect(drop).not.toContain("named");
    expect(drop.filter((d) => d.startsWith("p"))).toEqual(["p5", "p6", "p7"]);
  });
});

describe("SnapshotScheduler", () => {
  it("snapshots after 5 minutes, or after 25 saves once a minute has passed", () => {
    let t = 0;
    const sch = new SnapshotScheduler(() => t);
    expect(sch.onSave("s")).toBe(false); // starts the clock
    t += 4 * MIN;
    expect(sch.onSave("s")).toBe(false);
    t += 2 * MIN;
    expect(sch.onSave("s")).toBe(true);
    // change-based: many quick saves
    for (let i = 0; i < 30; i++) {
      t += 1000;
      if (sch.onSave("s")) throw new Error("too early");
    }
    t += 40_000;
    expect(sch.onSave("s")).toBe(true);
  });
  it("tracks scenes independently", () => {
    let t = 0;
    const sch = new SnapshotScheduler(() => t);
    sch.onSave("a");
    t += 6 * MIN;
    expect(sch.onSave("b")).toBe(false);
    expect(sch.onSave("a")).toBe(true);
  });
});

describe("snapshots in IndexedDB", () => {
  async function scene() {
    const s = await repo.createScene({ title: "Arch", elements: [el("a"), el("b")] });
    return s;
  }
  const save = (s: { id: string; pageIds: string[] }, elements: ExcalidrawElement[], rev: number) =>
    repo.savePage({
      sceneId: s.id,
      pageId: s.pageIds[0]!,
      elements,
      appState: {},
      fileRefs: {},
      blobs: [],
      expectedRev: rev,
    });

  it("takes, lists, loads and skips duplicate automatic snapshots", async () => {
    const s = await scene();
    const a = await takeSnapshot(s.id, { kind: "auto" });
    expect(a?.elementCount).toBe(2);
    const early = await loadSnapshot(a!.id);
    expect(early.pages[0]!.elements.map((e) => e.id)).toEqual(["a", "b"]);
    expect(await takeSnapshot(s.id, { kind: "auto" })).toBeNull(); // unchanged → no new snapshot
    expect(await takeSnapshot(s.id, { kind: "named", label: "v1" })).not.toBeNull(); // explicit ones always save
    await save(s, [el("a", 2), el("b"), el("c")], 1);
    const b = await takeSnapshot(s.id, { kind: "auto" });
    expect(b?.elementCount).toBe(3);
    const list = await listSnapshots(s.id);
    // the newer automatic snapshot replaced the older one from the same 5-minute window; the named one stays
    expect(list.map((x) => x.kind).sort()).toEqual(["auto", "named"]);
    expect(list[0]!.createdAt).toBeGreaterThanOrEqual(list[1]!.createdAt);
    const content = await loadSnapshot(b!.id);
    expect(content.title).toBe("Arch");
    expect(content.pages[0]!.elements.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("restore creates a pre-restore snapshot first, so it is always reversible", async () => {
    const s = await scene();
    const v1 = await takeSnapshot(s.id, { kind: "named", label: "v1" });
    await save(s, [el("a", 2), el("z"), el("y")], 1);
    await restoreSnapshot(s.id, v1!.id);
    const page = await repo.loadPage(s.id);
    expect(page.elements.map((e) => e.id)).toEqual(["a", "b"]);
    expect(page.rev).toBeGreaterThan(2);
    const kinds = (await listSnapshots(s.id)).map((x) => x.kind);
    expect(kinds).toContain("pre-restore");
    // ...and restoring the safety copy brings the newer state back.
    const pre = (await listSnapshots(s.id)).find((x) => x.kind === "pre-restore")!;
    await restoreSnapshot(s.id, pre.id);
    expect((await repo.loadPage(s.id)).elements.map((e) => e.id)).toEqual(["a", "z", "y"]);
  });

  it("restores page structure (pages added after the snapshot disappear)", async () => {
    const s = await scene();
    const snap = await takeSnapshot(s.id, { kind: "named", label: "one page" });
    const { addPage } = await import("@/persistence/pages");
    await addPage(s.id, "Second");
    expect((await repo.getScene(s.id))!.pageIds).toHaveLength(2);
    await restoreSnapshot(s.id, snap!.id);
    expect((await repo.getScene(s.id))!.pageIds).toHaveLength(1);
  });

  it("naming promotes to a checkpoint; deleting removes; blobs referenced by snapshots survive gc", async () => {
    const s = await scene();
    const a = await takeSnapshot(s.id, { kind: "auto" });
    await renameSnapshot(a!.id, "Release 1");
    expect((await listSnapshots(s.id))[0]).toMatchObject({ kind: "named", label: "Release 1" });
    await deleteSnapshot(a!.id);
    expect(await listSnapshots(s.id)).toHaveLength(0);
  });
});

describe("diffElements", () => {
  it("counts added, removed, changed and unchanged, ignoring deleted", () => {
    const d = diffElements(
      [
        { id: "a", version: 1 },
        { id: "b", version: 1 },
        { id: "c", version: 1, isDeleted: true },
      ],
      [
        { id: "a", version: 2 },
        { id: "b", version: 1 },
        { id: "n", version: 1 },
      ],
    );
    expect(d).toEqual({ added: 1, removed: 0, changed: 1, unchanged: 1 });
    expect(diffElements([{ id: "x" }], [])).toEqual({
      added: 0,
      removed: 1,
      changed: 0,
      unchanged: 0,
    });
  });
});
