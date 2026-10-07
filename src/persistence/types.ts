import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

/** Bump when the stored shape changes; add a step to `migrations.ts` and a fixture under tests/fixtures. */
export const SCHEMA_VERSION = 1; // row-level schema; Dexie store version is 2 (see db.ts)

export interface Scene {
  id: string;
  title: string;
  folderId: string | null;
  pageIds: string[];
  createdAt: number;
  updatedAt: number;
  /** Hash of a blob in the `blobs` table. */
  thumbnailBlobId: string | null;
  tags: string[];
  pinned: boolean;
  /** Manual sort order (ascending). */
  order: number;
  /** Set when in trash; purged after TRASH_TTL_MS. */
  deletedAt: number | null;
  schemaVersion: number;
}

/** Subset of Excalidraw's AppState that is worth restoring. */
export interface PersistedAppState {
  viewBackgroundColor?: string;
  scrollX?: number;
  scrollY?: number;
  zoom?: { value: number };
  gridSize?: number;
  gridModeEnabled?: boolean;
  objectsSnapModeEnabled?: boolean;
  selectedTool?: string;
  currentItemStrokeColor?: string;
  currentItemBackgroundColor?: string;
  currentItemFillStyle?: string;
  currentItemStrokeWidth?: number;
  currentItemStrokeStyle?: string;
  currentItemRoughness?: number;
  currentItemOpacity?: number;
  currentItemFontFamily?: number;
  currentItemFontSize?: number;
  currentItemTextAlign?: string;
  currentItemRoundness?: string;
  currentItemArrowType?: string;
}

export interface FileRef {
  hash: string;
  mimeType: string;
  created: number;
}

export interface Page {
  id: string;
  sceneId: string;
  order: number;
  title: string;
  elements: ExcalidrawElement[];
  appState: PersistedAppState;
  /** Excalidraw fileId → blob. Image bytes live in `blobs`, never inline in element JSON. */
  fileRefs: Record<string, FileRef>;
  /** Optimistic-concurrency counter, incremented on every save. */
  rev: number;
  schemaVersion: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Snapshot {
  id: string;
  sceneId: string;
  createdAt: number;
  label?: string;
  kind: "auto" | "named" | "pre-restore";
  payload: unknown;
}

export interface Library {
  id: string;
  name: string;
  items: unknown[];
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface BlobRecord {
  hash: string;
  mime: string;
  bytes: ArrayBuffer;
  size: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  sceneId: string;
  pageId: string;
  text: string;
  resolved: boolean;
  createdAt: number;
  anchor: { elementId: string } | { x: number; y: number };
}

export interface RecoveryRecord {
  id: string;
  sceneId: string;
  createdAt: number;
  reason: string;
  raw: unknown;
}

export interface SmartDefRecord {
  id: string;
  name: string;
  /** The definition document (validated by `parseSmartDef` before use). */
  def: unknown;
  updatedAt: number;
}

export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class ConflictError extends Error {
  constructor(
    public readonly sceneId: string,
    public readonly pageId: string,
    public readonly currentRev: number,
  ) {
    super(`Page ${pageId} was modified elsewhere (rev ${currentRev})`);
    this.name = "ConflictError";
  }
}

export class CorruptSceneError extends Error {
  constructor(
    public readonly sceneId: string,
    public readonly reason: string,
    public readonly raw: unknown,
  ) {
    super(`Scene ${sceneId} is corrupt: ${reason}`);
    this.name = "CorruptSceneError";
  }
}
