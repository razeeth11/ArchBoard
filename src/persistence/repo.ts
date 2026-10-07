import { bytesToDataURL } from "./blobs";
import { getDb } from "./db";
import { upgradePage } from "./migrations";
import {
  ConflictError,
  CorruptSceneError,
  SCHEMA_VERSION,
  TRASH_TTL_MS,
  type BlobRecord,
  type FileRef,
  type Folder,
  type Page,
  type PersistedAppState,
  type Scene,
} from "./types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export const newId = (): string => crypto.randomUUID();

// ───────────────────────── scenes ─────────────────────────

export interface CreateSceneInput {
  title?: string;
  folderId?: string | null;
  elements?: ExcalidrawElement[];
  appState?: PersistedAppState;
  fileRefs?: Record<string, FileRef>;
  blobs?: BlobRecord[];
}

export async function createScene(input: CreateSceneInput = {}): Promise<Scene> {
  const db = getDb();
  const now = Date.now();
  const pageId = newId();
  return db.transaction("rw", db.scenes, db.pages, db.blobs, async () => {
    const first = await db.scenes.orderBy("order").first();
    const scene: Scene = {
      id: newId(),
      title: input.title?.trim() || "Untitled",
      folderId: input.folderId ?? null,
      pageIds: [pageId],
      createdAt: now,
      updatedAt: now,
      thumbnailBlobId: null,
      tags: [],
      pinned: false,
      order: (first?.order ?? 0) - 1,
      deletedAt: null,
      schemaVersion: SCHEMA_VERSION,
    };
    const page: Page = {
      id: pageId,
      sceneId: scene.id,
      order: 0,
      title: "Page 1",
      elements: input.elements ?? [],
      appState: input.appState ?? {},
      fileRefs: input.fileRefs ?? {},
      rev: 1,
      schemaVersion: SCHEMA_VERSION,
    };
    if (input.blobs?.length) await db.blobs.bulkPut(input.blobs);
    await db.scenes.add(scene);
    await db.pages.add(page);
    return scene;
  });
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return getDb().scenes.get(id);
}

/** Live (non-trashed) scenes: pinned first, then manual order. */
export async function listScenes(): Promise<Scene[]> {
  const all = await getDb().scenes.orderBy("order").toArray();
  return all
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
}

export async function listTrash(): Promise<Scene[]> {
  const all = await getDb().scenes.toArray();
  return all.filter((s) => s.deletedAt !== null).sort((a, b) => b.deletedAt! - a.deletedAt!);
}

export async function renameScene(id: string, title: string) {
  await getDb().scenes.update(id, { title: title.trim() || "Untitled", updatedAt: Date.now() });
}

export async function setPinned(id: string, pinned: boolean) {
  await getDb().scenes.update(id, { pinned });
}

export async function setTags(id: string, tags: string[]) {
  await getDb().scenes.update(id, { tags });
}

export async function moveSceneToFolder(id: string, folderId: string | null) {
  await getDb().scenes.update(id, { folderId });
}

/** Persist a new manual order. `orderedIds` is the full desired sequence of visible scenes. */
export async function reorderScenes(orderedIds: string[]) {
  const db = getDb();
  await db.transaction("rw", db.scenes, async () => {
    await Promise.all(orderedIds.map((id, i) => db.scenes.update(id, { order: i })));
  });
}

export async function trashScene(id: string) {
  await getDb().scenes.update(id, { deletedAt: Date.now() });
}

export async function restoreScene(id: string) {
  await getDb().scenes.update(id, { deletedAt: null });
}

export async function deleteSceneForever(id: string) {
  const db = getDb();
  await db.transaction(
    "rw",
    [db.scenes, db.pages, db.snapshots, db.comments, db.recovery],
    async () => {
      await db.pages.where("sceneId").equals(id).delete();
      await db.snapshots.where("sceneId").equals(id).delete();
      await db.comments.where("sceneId").equals(id).delete();
      await db.recovery.where("sceneId").equals(id).delete();
      await db.scenes.delete(id);
    },
  );
  await gcBlobs();
}

export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const expired = (await listTrash()).filter((s) => now - s.deletedAt! >= TRASH_TTL_MS);
  for (const s of expired) await deleteSceneForever(s.id);
  return expired.length;
}

export async function duplicateScene(id: string): Promise<Scene> {
  const db = getDb();
  return db.transaction("rw", db.scenes, db.pages, async () => {
    const src = await db.scenes.get(id);
    if (!src) throw new Error(`Scene ${id} not found`);
    const pages = await db.pages.where("sceneId").equals(id).sortBy("order");
    const first = await db.scenes.orderBy("order").first();
    const sceneId = newId();
    const idMap = new Map(pages.map((p) => [p.id, newId()]));
    const now = Date.now();
    const copy: Scene = {
      ...src,
      id: sceneId,
      title: `${src.title} (copy)`,
      pageIds: src.pageIds.map((p) => idMap.get(p) ?? p),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      order: (first?.order ?? 0) - 1,
      deletedAt: null,
    };
    await db.scenes.add(copy);
    // Blobs are content-addressed, so copies share bytes: duplication costs only element JSON.
    await db.pages.bulkAdd(pages.map((p) => ({ ...p, id: idMap.get(p.id)!, sceneId, rev: 1 })));
    return copy;
  });
}

// ───────────────────────── folders ─────────────────────────

export async function listFolders(): Promise<Folder[]> {
  return getDb().folders.orderBy("order").toArray();
}

export async function createFolder(name: string): Promise<Folder> {
  const db = getDb();
  const last = await db.folders.orderBy("order").last();
  const folder: Folder = {
    id: newId(),
    name: name.trim() || "New folder",
    order: (last?.order ?? -1) + 1,
    createdAt: Date.now(),
  };
  await db.folders.add(folder);
  return folder;
}

export async function renameFolder(id: string, name: string) {
  await getDb().folders.update(id, { name: name.trim() || "Folder" });
}

export async function deleteFolder(id: string) {
  const db = getDb();
  await db.transaction("rw", db.folders, db.scenes, async () => {
    await db.scenes.where("folderId").equals(id).modify({ folderId: null });
    await db.folders.delete(id);
  });
}

// ───────────────────────── pages ─────────────────────────

/**
 * Load a page, upgrading legacy rows. A row that fails validation is copied to `recovery`
 * (original left untouched) and surfaces as CorruptSceneError.
 */
export async function loadPage(sceneId: string, pageId?: string): Promise<Page> {
  const db = getDb();
  const scene = await db.scenes.get(sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const id = pageId ?? scene.pageIds[0];
  const raw = id ? await db.pages.get(id) : undefined;
  try {
    if (!raw) throw new CorruptSceneError(sceneId, "page row missing", { scene });
    const { page, blobs } = await upgradePage(sceneId, raw);
    if (blobs.length) {
      // Persist the upgrade so legacy inline data is migrated exactly once.
      await db.transaction("rw", db.pages, db.blobs, async () => {
        await db.blobs.bulkPut(blobs);
        await db.pages.put(page);
      });
    }
    return page;
  } catch (e) {
    if (e instanceof CorruptSceneError) {
      await db.recovery.put({
        id: newId(),
        sceneId,
        createdAt: Date.now(),
        reason: e.reason,
        raw: { scene, page: e.raw },
      });
    }
    throw e;
  }
}

export interface SavePageInput {
  sceneId: string;
  pageId: string;
  elements: ExcalidrawElement[];
  appState: PersistedAppState;
  fileRefs: Record<string, FileRef>;
  /** New blobs only; existing hashes are skipped. */
  blobs: BlobRecord[];
  /** The rev this session last saw; a mismatch means another tab wrote in between. */
  expectedRev: number;
}

/** Atomic save: page + blobs + scene timestamp commit together or not at all. */
export async function savePage(input: SavePageInput): Promise<number> {
  const db = getDb();
  return db.transaction("rw", db.scenes, db.pages, db.blobs, async () => {
    const [scene, existing] = await Promise.all([
      db.scenes.get(input.sceneId),
      db.pages.get(input.pageId),
    ]);
    if (!scene || !existing) throw new Error("Scene or page was deleted");
    if (existing.rev !== input.expectedRev) {
      throw new ConflictError(input.sceneId, input.pageId, existing.rev);
    }
    for (const b of input.blobs) {
      if (!(await db.blobs.get(b.hash))) await db.blobs.add(b);
    }
    const rev = existing.rev + 1;
    await db.pages.put({
      ...existing,
      elements: input.elements,
      appState: input.appState,
      fileRefs: input.fileRefs,
      rev,
      schemaVersion: SCHEMA_VERSION,
    });
    await db.scenes.update(input.sceneId, { updatedAt: Date.now() });
    return rev;
  });
}

export async function getPageRev(pageId: string): Promise<number | undefined> {
  return (await getDb().pages.get(pageId))?.rev;
}

// ───────────────────────── blobs ─────────────────────────

export interface LoadedFile {
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
}

export async function loadFiles(refs: Record<string, FileRef>): Promise<LoadedFile[]> {
  const db = getDb();
  const out: LoadedFile[] = [];
  for (const [id, ref] of Object.entries(refs)) {
    const blob = await db.blobs.get(ref.hash);
    if (!blob) continue; // missing bytes: element renders as a broken image rather than failing the scene
    out.push({
      id,
      mimeType: ref.mimeType,
      dataURL: bytesToDataURL(blob.bytes, blob.mime),
      created: ref.created,
    });
  }
  return out;
}

export async function setThumbnail(sceneId: string, blob: BlobRecord | null) {
  const db = getDb();
  await db.transaction("rw", db.scenes, db.blobs, async () => {
    if (blob && !(await db.blobs.get(blob.hash))) await db.blobs.add(blob);
    await db.scenes.update(sceneId, { thumbnailBlobId: blob?.hash ?? null });
  });
}

export async function getBlob(hash: string): Promise<BlobRecord | undefined> {
  return getDb().blobs.get(hash);
}

/** Delete blobs no page, snapshot, or scene thumbnail references. */
export async function gcBlobs(): Promise<number> {
  const db = getDb();
  return db.transaction("rw", [db.blobs, db.pages, db.snapshots, db.scenes], async () => {
    const live = new Set<string>();
    await db.pages.each((p) => {
      for (const r of Object.values(p.fileRefs)) live.add(r.hash);
    });
    await db.scenes.each((s) => {
      if (s.thumbnailBlobId) live.add(s.thumbnailBlobId);
    });
    await db.snapshots.each((snap) => {
      const refs = (snap.payload as { fileRefs?: Record<string, FileRef> } | null)?.fileRefs;
      if (refs) for (const r of Object.values(refs)) live.add(r.hash);
    });
    const dead: string[] = [];
    await db.blobs.each((b) => {
      if (!live.has(b.hash)) dead.push(b.hash);
    });
    await db.blobs.bulkDelete(dead);
    return dead.length;
  });
}

// ───────────────────────── settings & library ─────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await getDb().settings.put({ key, value });
}

export async function loadLibraryItems(): Promise<unknown[]> {
  return (await getDb().libraries.get("default"))?.items ?? [];
}

export async function saveLibraryItems(items: unknown[]) {
  await getDb().libraries.put({ id: "default", name: "My library", items, updatedAt: Date.now() });
}
