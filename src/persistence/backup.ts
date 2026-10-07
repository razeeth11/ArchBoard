import { base64ToBytes, bytesToBase64, bytesToDataURL, dataURLToBytes, sha256Hex } from "./blobs";
import { getDb } from "./db";
import { newId, setSetting } from "./repo";
import {
  SCHEMA_VERSION,
  type BlobRecord,
  type FileRef,
  type Folder,
  type Page,
  type Scene,
} from "./types";
import { upgradePage } from "./migrations";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export const BACKUP_TYPE = "archboard-backup";

interface BackupFile {
  type: typeof BACKUP_TYPE;
  version: 1;
  exportedAt: string;
  scenes: { scene: Scene; pages: Page[] }[];
  folders: Folder[];
  library: unknown[];
  blobs: Record<string, { mime: string; base64: string }>;
}

/** Full backup of every local scene (including trash) as one JSON document. Images are embedded once, by hash. */
export async function buildBackup(): Promise<string> {
  const db = getDb();
  const [scenes, pages, folders, lib, blobs] = await Promise.all([
    db.scenes.toArray(),
    db.pages.toArray(),
    db.folders.toArray(),
    db.libraries.get("default"),
    db.blobs.toArray(),
  ]);
  const pagesByScene = Map.groupBy(pages, (p) => p.sceneId);
  const used = new Set<string>();
  for (const p of pages) for (const r of Object.values(p.fileRefs)) used.add(r.hash);
  const blobMap: BackupFile["blobs"] = {};
  for (const b of blobs) {
    if (used.has(b.hash)) blobMap[b.hash] = { mime: b.mime, base64: bytesToBase64(b.bytes) };
  }
  const file: BackupFile = {
    type: BACKUP_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    scenes: scenes.map((scene) => ({ scene, pages: pagesByScene.get(scene.id) ?? [] })),
    folders,
    library: lib?.items ?? [],
    blobs: blobMap,
  };
  await setSetting("lastBackupAt", Date.now());
  return JSON.stringify(file);
}

export interface ImportResult {
  scenes: number;
  folders: number;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Import never overwrites: every scene/folder/page gets a fresh id, so importing the same
 * backup twice yields copies instead of data loss.
 */
export async function importBackup(text: string): Promise<ImportResult> {
  const data: unknown = JSON.parse(text);
  if (!isRec(data) || data.type !== BACKUP_TYPE || !Array.isArray(data.scenes)) {
    throw new Error("Not an ArchBoard backup file");
  }
  const db = getDb();
  const blobsIn = isRec(data.blobs) ? data.blobs : {};
  const blobRecords: BlobRecord[] = [];
  for (const [hash, b] of Object.entries(blobsIn)) {
    if (!isRec(b) || typeof b.base64 !== "string" || typeof b.mime !== "string") continue;
    const bytes = base64ToBytes(b.base64);
    // Re-hash: never trust a hash from an imported file.
    const actual = await sha256Hex(bytes);
    if (actual !== hash) continue;
    blobRecords.push({ hash, mime: b.mime, bytes, size: bytes.byteLength, createdAt: Date.now() });
  }

  const folderMap = new Map<string, string>();
  const folders: Folder[] = [];
  for (const f of Array.isArray(data.folders) ? data.folders : []) {
    if (!isRec(f) || typeof f.id !== "string") continue;
    const id = newId();
    folderMap.set(f.id, id);
    folders.push({
      id,
      name: String(f.name ?? "Folder"),
      order: Number(f.order ?? 0),
      createdAt: Date.now(),
    });
  }

  const scenes: Scene[] = [];
  const pages: Page[] = [];
  const extraBlobs: BlobRecord[] = [];
  for (const entry of data.scenes) {
    if (!isRec(entry) || !isRec(entry.scene)) continue;
    const src = entry.scene as unknown as Scene;
    const sceneId = newId();
    const pageIdMap = new Map<string, string>();
    const srcPages = Array.isArray(entry.pages) ? entry.pages : [];
    for (const rawPage of srcPages) {
      const { page, blobs } = await upgradePage(sceneId, rawPage);
      extraBlobs.push(...blobs);
      const id = newId();
      pageIdMap.set(page.id, id);
      pages.push({ ...page, id, sceneId, rev: 1 });
    }
    scenes.push({
      ...src,
      id: sceneId,
      folderId: src.folderId ? (folderMap.get(src.folderId) ?? null) : null,
      pageIds: (src.pageIds ?? []).map((p) => pageIdMap.get(p)).filter((p): p is string => !!p),
      thumbnailBlobId: null,
      schemaVersion: SCHEMA_VERSION,
    });
  }

  await db.transaction(
    "rw",
    [db.scenes, db.pages, db.folders, db.blobs, db.libraries],
    async () => {
      await db.blobs.bulkPut([...blobRecords, ...extraBlobs]);
      await db.folders.bulkAdd(folders);
      await db.scenes.bulkAdd(scenes);
      await db.pages.bulkAdd(pages);
      if (Array.isArray(data.library) && data.library.length) {
        const cur = await db.libraries.get("default");
        await db.libraries.put({
          id: "default",
          name: "My library",
          items: [...(cur?.items ?? []), ...data.library],
          updatedAt: Date.now(),
        });
      }
    },
  );
  return { scenes: scenes.length, folders: folders.length };
}

// ───────────── `.excalidraw`-compatible single-scene import/export ─────────────

export async function buildExcalidrawFile(sceneId: string, pageId?: string): Promise<string> {
  const db = getDb();
  const scene = await db.scenes.get(sceneId);
  if (!scene) throw new Error("Scene not found");
  const page = await db.pages.get(pageId ?? scene.pageIds[0] ?? "");
  if (!page) throw new Error("Page not found");
  const files: Record<string, unknown> = {};
  for (const [id, ref] of Object.entries(page.fileRefs)) {
    const b = await db.blobs.get(ref.hash);
    if (b)
      files[id] = {
        id,
        mimeType: ref.mimeType,
        dataURL: bytesToDataURL(b.bytes, b.mime),
        created: ref.created,
      };
  }
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "archboard",
    elements: page.elements,
    appState: { viewBackgroundColor: page.appState.viewBackgroundColor ?? "#ffffff" },
    files,
  });
}

/** Parse a `.excalidraw` JSON document into a new scene. Image data URLs are converted to blobs. */
export async function importExcalidrawFile(text: string, title: string): Promise<Scene> {
  const data: unknown = JSON.parse(text);
  if (!isRec(data) || data.type !== "excalidraw" || !Array.isArray(data.elements)) {
    throw new Error("Not an Excalidraw scene file");
  }
  const blobs: BlobRecord[] = [];
  const fileRefs: Record<string, FileRef> = {};
  for (const [id, f] of Object.entries(isRec(data.files) ? data.files : {})) {
    if (!isRec(f) || typeof f.dataURL !== "string") continue;
    const { bytes, mime } = dataURLToBytes(f.dataURL);
    const hash = await sha256Hex(bytes);
    blobs.push({ hash, mime, bytes, size: bytes.byteLength, createdAt: Date.now() });
    fileRefs[id] = {
      hash,
      mimeType: typeof f.mimeType === "string" ? f.mimeType : mime,
      created: Number(f.created ?? Date.now()),
    };
  }
  const { createScene } = await import("./repo");
  const bg =
    isRec(data.appState) && typeof data.appState.viewBackgroundColor === "string"
      ? data.appState.viewBackgroundColor
      : undefined;
  return createScene({
    title,
    elements: data.elements as ExcalidrawElement[],
    appState: bg ? { viewBackgroundColor: bg } : {},
    fileRefs,
    blobs,
  });
}

/** Import either an ArchBoard backup or a single `.excalidraw` file. */
export async function importAny(text: string, filename: string): Promise<ImportResult> {
  const parsed: unknown = JSON.parse(text);
  if (isRec(parsed) && parsed.type === BACKUP_TYPE) return importBackup(text);
  const title = filename.replace(/\.(excalidraw|json)$/i, "") || "Imported";
  await importExcalidrawFile(text, title);
  return { scenes: 1, folders: 0 };
}
