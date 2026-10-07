import { beforeEach, describe, expect, it, vi } from "vitest";
import legacy from "../fixtures/legacy-v0-page.json";
import { ArchBoardDB, setDb, getDb } from "@/persistence/db";
import * as repo from "@/persistence/repo";
import { upgradePage } from "@/persistence/migrations";
import { Autosaver } from "@/persistence/autosave";
import { PageSession } from "@/persistence/session";
import {
  buildBackup,
  importBackup,
  buildExcalidrawFile,
  importExcalidrawFile,
} from "@/persistence/backup";
import { dataURLToBytes, sha256Hex } from "@/persistence/blobs";
import { ConflictError, CorruptSceneError, TRASH_TTL_MS } from "@/persistence/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

let n = 0;
beforeEach(() => setDb(new ArchBoardDB(`test-${++n}-${Date.now()}`)));

const rect = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    isDeleted: false,
    version: 1,
    ...extra,
  }) as unknown as ExcalidrawElement;
const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("scenes workspace", () => {
  it("creates, lists (new first), renames, pins, and reorders", async () => {
    const a = await repo.createScene({ title: "A" });
    const b = await repo.createScene({ title: "B" });
    expect((await repo.listScenes()).map((s) => s.title)).toEqual(["B", "A"]);
    await repo.renameScene(a.id, "  Alpha ");
    await repo.setPinned(a.id, true);
    expect((await repo.listScenes()).map((s) => s.title)).toEqual(["Alpha", "B"]);
    await repo.setPinned(a.id, false);
    await repo.reorderScenes([a.id, b.id]);
    expect((await repo.listScenes()).map((s) => s.title)).toEqual(["Alpha", "B"]);
  });

  it("trash is reversible and purges after 30 days", async () => {
    const s = await repo.createScene({ title: "T" });
    await repo.trashScene(s.id);
    expect(await repo.listScenes()).toHaveLength(0);
    expect(await repo.listTrash()).toHaveLength(1);
    await repo.restoreScene(s.id);
    expect(await repo.listScenes()).toHaveLength(1);
    await repo.trashScene(s.id);
    expect(await repo.purgeExpiredTrash(Date.now() + TRASH_TTL_MS - 60_000)).toBe(0);
    expect(await repo.purgeExpiredTrash(Date.now() + TRASH_TTL_MS + 60_000)).toBe(1);
    expect(await repo.getScene(s.id)).toBeUndefined();
    expect(await getDb().pages.count()).toBe(0);
  });

  it("duplicates with fresh ids and independent pages", async () => {
    const s = await repo.createScene({ title: "Orig", elements: [rect("r1")] });
    const d = await repo.duplicateScene(s.id);
    expect(d.id).not.toBe(s.id);
    expect(d.pageIds[0]).not.toBe(s.pageIds[0]);
    expect((await repo.loadPage(d.id)).elements).toHaveLength(1);
  });

  it("deleting a folder moves its scenes to the root", async () => {
    const f = await repo.createFolder("F");
    const s = await repo.createScene({ folderId: f.id });
    await repo.deleteFolder(f.id);
    expect((await repo.getScene(s.id))?.folderId).toBeNull();
  });
});

describe("atomic save, blobs and concurrency", () => {
  it("rejects a stale rev with ConflictError and leaves data intact", async () => {
    const s = await repo.createScene({ elements: [rect("a")] });
    const pageId = s.pageIds[0]!;
    const base = { sceneId: s.id, pageId, appState: {}, fileRefs: {}, blobs: [] };
    const rev2 = await repo.savePage({ ...base, elements: [rect("a"), rect("b")], expectedRev: 1 });
    expect(rev2).toBe(2);
    await expect(repo.savePage({ ...base, elements: [], expectedRev: 1 })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await repo.loadPage(s.id)).elements).toHaveLength(2);
  });

  it("a failed transaction writes nothing (blob + page commit together)", async () => {
    const s = await repo.createScene();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const hash = await sha256Hex(bytes);
    await expect(
      repo.savePage({
        sceneId: s.id,
        pageId: s.pageIds[0]!,
        elements: [rect("x")],
        appState: {},
        fileRefs: {},
        blobs: [{ hash, mime: "image/png", bytes, size: 3, createdAt: 0 }],
        expectedRev: 99,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await getDb().blobs.count()).toBe(0);
  });

  it("PageSession dedupes identical images by content hash and drops deleted elements", async () => {
    const s = await repo.createScene();
    const sess = new PageSession(s.id, s.pageIds[0]!, 1, {});
    const img = (id: string, fileId: string) =>
      ({ ...rect(id), type: "image", fileId }) as unknown as ExcalidrawElement;
    const file = { mimeType: "image/png", dataURL: PNG, created: 1 };
    await sess.persist(
      [img("i1", "f1"), img("i2", "f2"), rect("gone", { isDeleted: true })],
      {},
      { f1: file, f2: file },
    );
    expect(await getDb().blobs.count()).toBe(1);
    const page = await repo.loadPage(s.id);
    expect(page.elements.map((e) => e.id)).toEqual(["i1", "i2"]);
    expect(Object.keys(page.fileRefs)).toEqual(["f1", "f2"]);
    const files = await repo.loadFiles(page.fileRefs);
    expect(files).toHaveLength(2);
    expect(dataURLToBytes(files[0]!.dataURL).bytes.byteLength).toBe(
      dataURLToBytes(PNG).bytes.byteLength,
    );
  });

  it("first change signature is a baseline and does not trigger a save", () => {
    const sess = new PageSession("s", "p", 1, {});
    expect(sess.markChanged("a")).toBe(false);
    expect(sess.markChanged("a")).toBe(false);
    expect(sess.markChanged("b")).toBe(true);
  });

  it("gc removes only unreferenced blobs", async () => {
    const s = await repo.createScene();
    const sess = new PageSession(s.id, s.pageIds[0]!, 1, {});
    const el = { ...rect("i"), type: "image", fileId: "f" } as unknown as ExcalidrawElement;
    await sess.persist([el], {}, { f: { mimeType: "image/png", dataURL: PNG, created: 1 } });
    await getDb().blobs.add({
      hash: "orphan",
      mime: "x",
      bytes: new ArrayBuffer(1),
      size: 1,
      createdAt: 0,
    });
    expect(await repo.gcBlobs()).toBe(1);
    expect(await getDb().blobs.count()).toBe(1);
  });
});

describe("migrations and corruption", () => {
  it("upgrades a legacy v0 page, moving inline images into blobs", async () => {
    const { page, blobs } = await upgradePage("s1", legacy);
    expect(page.schemaVersion).toBe(1);
    expect(page.rev).toBe(1);
    expect(page.fileRefs["file-a"]?.hash).toBe(blobs[0]?.hash);
    expect(page.elements).toHaveLength(2);
    expect(page.appState.viewBackgroundColor).toBe("#ffeedd");
  });

  it("loadPage migrates a legacy row in place without losing data", async () => {
    const s = await repo.createScene();
    await getDb().pages.put({ ...legacy, id: s.pageIds[0]!, sceneId: s.id } as never);
    const page = await repo.loadPage(s.id);
    expect(page.elements).toHaveLength(2);
    expect((await getDb().pages.get(page.id))?.schemaVersion).toBe(1);
    expect(await getDb().blobs.count()).toBe(1);
  });

  it("refuses data written by a newer schema instead of downgrading it", async () => {
    await expect(upgradePage("s", { id: "p", schemaVersion: 99 })).rejects.toBeInstanceOf(
      CorruptSceneError,
    );
  });

  it("corrupt rows raise CorruptSceneError, keep the raw payload in recovery, and are not modified", async () => {
    const s = await repo.createScene();
    const bad = {
      id: s.pageIds[0]!,
      sceneId: s.id,
      schemaVersion: 1,
      elements: "nope",
      appState: {},
      fileRefs: {},
      rev: 1,
    };
    await getDb().pages.put(bad as never);
    await expect(repo.loadPage(s.id)).rejects.toBeInstanceOf(CorruptSceneError);
    expect(await getDb().recovery.count()).toBe(1);
    expect((await getDb().pages.get(bad.id))?.elements).toBe("nope");
  });
});

describe("autosave", () => {
  it("debounces to the last job and flushes on demand", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const saver = new Autosaver(500);
    for (let i = 1; i <= 5; i++) saver.schedule(async () => void calls.push(i));
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(calls).toEqual([5]);
    saver.schedule(async () => void calls.push(6));
    await saver.flush();
    expect(calls).toEqual([5, 6]);
    vi.useRealTimers();
  });

  it("reports errors and keeps going; pause holds work until resume", async () => {
    const statuses: string[] = [];
    const saver = new Autosaver(10, (s) => statuses.push(s));
    saver.schedule(async () => {
      throw new Error("boom");
    });
    await saver.flush();
    expect(statuses).toEqual(["saving", "error"]);
    saver.pause();
    const ran = vi.fn(async () => {});
    saver.schedule(ran);
    await saver.flush();
    expect(ran).not.toHaveBeenCalled();
    saver.resume();
    await saver.flush();
    expect(ran).toHaveBeenCalledOnce();
  });
});

describe("backup and import", () => {
  it("round-trips scenes, folders, images and library; import never overwrites", async () => {
    const f = await repo.createFolder("Work");
    const s = await repo.createScene({ title: "Arch", folderId: f.id });
    const sess = new PageSession(s.id, s.pageIds[0]!, 1, {});
    const el = { ...rect("i"), type: "image", fileId: "f" } as unknown as ExcalidrawElement;
    await sess.persist(
      [el, rect("r")],
      {},
      { f: { mimeType: "image/png", dataURL: PNG, created: 1 } },
    );
    await repo.saveLibraryItems([{ id: "lib1" }]);
    const json = await buildBackup();

    const res = await importBackup(json);
    expect(res).toEqual({ scenes: 1, folders: 1 });
    const scenes = await repo.listScenes();
    expect(scenes).toHaveLength(2);
    const copy = scenes.find((x) => x.id !== s.id)!;
    expect(copy.folderId).not.toBe(f.id);
    const page = await repo.loadPage(copy.id);
    expect(page.elements).toHaveLength(2);
    expect((await repo.loadFiles(page.fileRefs))[0]?.dataURL).toBe(PNG);
    expect(await getDb().blobs.count()).toBe(1);
  });

  it("rejects non-backup JSON", async () => {
    await expect(importBackup('{"type":"nope"}')).rejects.toThrow();
  });

  it(".excalidraw export/import round-trips elements and images", async () => {
    const s = await repo.createScene({ elements: [rect("a")] });
    const sess = new PageSession(s.id, s.pageIds[0]!, 1, {});
    const el = { ...rect("i"), type: "image", fileId: "f" } as unknown as ExcalidrawElement;
    await sess.persist(
      [rect("a"), el],
      {},
      { f: { mimeType: "image/png", dataURL: PNG, created: 1 } },
    );
    const text = await buildExcalidrawFile(s.id);
    expect(JSON.parse(text).type).toBe("excalidraw");
    const imported = await importExcalidrawFile(text, "Imported");
    const page = await repo.loadPage(imported.id);
    expect(page.elements).toHaveLength(2);
    expect(Object.keys(page.fileRefs)).toEqual(["f"]);
  });
});

describe("settings and library", () => {
  it("persists settings and library items", async () => {
    expect(await repo.getSetting("x", 7)).toBe(7);
    await repo.setSetting("x", 9);
    expect(await repo.getSetting("x", 7)).toBe(9);
    await repo.saveLibraryItems([{ a: 1 }]);
    expect(await repo.loadLibraryItems()).toEqual([{ a: 1 }]);
  });
});
