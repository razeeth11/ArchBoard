import Dexie, { type EntityTable } from "dexie";
import type {
  BlobRecord,
  Comment,
  Folder,
  Library,
  Page,
  RecoveryRecord,
  Scene,
  Setting,
  Snapshot,
  SmartDefRecord,
} from "./types";

export class ArchBoardDB extends Dexie {
  scenes!: EntityTable<Scene, "id">;
  pages!: EntityTable<Page, "id">;
  snapshots!: EntityTable<Snapshot, "id">;
  folders!: EntityTable<Folder, "id">;
  libraries!: EntityTable<Library, "id">;
  settings!: EntityTable<Setting, "key">;
  blobs!: EntityTable<BlobRecord, "hash">;
  comments!: EntityTable<Comment, "id">;
  recovery!: EntityTable<RecoveryRecord, "id">;
  /** User-authored Smart Component definitions (JSON). Added in schema v2. */
  smartDefs!: EntityTable<SmartDefRecord, "id">;

  constructor(name = "archboard") {
    super(name);
    // v1. Future versions add `.version(n).stores(...).upgrade(...)`; never edit an existing version.
    this.version(1).stores({
      scenes: "id, updatedAt, folderId, deletedAt, order",
      pages: "id, sceneId, [sceneId+order]",
      snapshots: "id, sceneId, [sceneId+createdAt]",
      folders: "id, order",
      libraries: "id",
      settings: "key",
      blobs: "hash",
      comments: "id, sceneId",
      recovery: "id, sceneId",
    });
    // v2: adds `smartDefs`. Existing tables are untouched, so no data migration is needed.
    this.version(2).stores({ smartDefs: "id, updatedAt" });
  }
}

let current: ArchBoardDB | null = null;

export function getDb(): ArchBoardDB {
  return (current ??= new ArchBoardDB());
}

/** Test seam: swap in an isolated database. */
export function setDb(db: ArchBoardDB | null) {
  current = db;
}
