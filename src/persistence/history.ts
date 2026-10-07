import { gunzipJson, gzipJson } from "@/lib/compress";
import { getDb } from "./db";
import { newId } from "./repo";
import type { FileRef, Page, Snapshot } from "./types";
import { SCHEMA_VERSION } from "./types";

export type SnapshotKind = Snapshot["kind"];

export interface SnapshotMeta {
  id: string;
  sceneId: string;
  createdAt: number;
  label?: string;
  kind: SnapshotKind;
  elementCount: number;
  pageCount: number;
  hash: string;
}

interface Stored {
  gz: Uint8Array;
  fileRefs: Record<string, FileRef>;
  elementCount: number;
  pageCount: number;
  hash: string;
}

export interface SnapshotContent {
  title: string;
  pages: Pick<Page, "id" | "title" | "order" | "elements" | "appState" | "fileRefs">[];
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Cheap content fingerprint: element ids + versions per page. */
export function contentHash(pages: Pick<Page, "id" | "elements">[]): string {
  let h = 5381;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) | 0;
  };
  for (const p of pages) {
    mix(p.id);
    for (const e of p.elements) mix(`${e.id}:${(e as { version?: number }).version ?? 0}`);
  }
  return (h >>> 0).toString(36);
}

/**
 * Which automatic snapshots to delete. Keeps the newest one per bucket — 5 minutes for the last hour,
 * hourly for the last day, daily for 30 days — and drops anything older. Named checkpoints are never
 * pruned; "pre-restore" safety copies keep the newest five.
 */
export function selectPrune(
  snaps: Pick<SnapshotMeta, "id" | "createdAt" | "kind">[],
  now: number,
): string[] {
  const drop: string[] = [];
  const keepBuckets = new Set<string>();
  const auto = snaps.filter((s) => s.kind === "auto").sort((a, b) => b.createdAt - a.createdAt);
  for (const s of auto) {
    const age = now - s.createdAt;
    if (age > 30 * DAY) {
      drop.push(s.id);
      continue;
    }
    const bucket =
      age < HOUR
        ? `m${Math.floor(s.createdAt / (5 * MIN))}`
        : age < DAY
          ? `h${Math.floor(s.createdAt / HOUR)}`
          : `d${Math.floor(s.createdAt / DAY)}`;
    if (keepBuckets.has(bucket)) drop.push(s.id);
    else keepBuckets.add(bucket);
  }
  const pre = snaps
    .filter((s) => s.kind === "pre-restore")
    .sort((a, b) => b.createdAt - a.createdAt);
  for (const s of pre.slice(5)) drop.push(s.id);
  return drop;
}

/** Decides when to snapshot: every 5 minutes of activity, or after many saves (with a floor of 60 s). */
export class SnapshotScheduler {
  private last = new Map<string, number>();
  private saves = new Map<string, number>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly everyMs = 5 * MIN,
    private readonly everySaves = 25,
    private readonly minGapMs = 60_000,
  ) {}

  /** Call after each successful save; true means "take an automatic snapshot now". */
  onSave(sceneId: string): boolean {
    const t = this.now();
    if (!this.last.has(sceneId)) {
      this.last.set(sceneId, t); // first save of a session: start the clock, don't snapshot yet
      this.saves.set(sceneId, 0);
      return false;
    }
    const n = (this.saves.get(sceneId) ?? 0) + 1;
    this.saves.set(sceneId, n);
    const since = t - this.last.get(sceneId)!;
    if (since >= this.everyMs || (n >= this.everySaves && since >= this.minGapMs)) {
      this.last.set(sceneId, t);
      this.saves.set(sceneId, 0);
      return true;
    }
    return false;
  }
}

const meta = (s: Snapshot): SnapshotMeta => {
  const p = s.payload as Stored;
  return {
    id: s.id,
    sceneId: s.sceneId,
    createdAt: s.createdAt,
    label: s.label,
    kind: s.kind,
    elementCount: p.elementCount,
    pageCount: p.pageCount,
    hash: p.hash,
  };
};

export async function takeSnapshot(
  sceneId: string,
  opts: { kind: SnapshotKind; label?: string },
  now = Date.now(),
): Promise<SnapshotMeta | null> {
  const db = getDb();
  const scene = await db.scenes.get(sceneId);
  if (!scene) return null;
  const pages = (await db.pages.where("sceneId").equals(sceneId).sortBy("order")).map(
    ({ id, title, order, elements, appState, fileRefs }) => ({
      id,
      title,
      order,
      elements,
      appState,
      fileRefs,
    }),
  );
  const hash = contentHash(pages);
  if (opts.kind === "auto") {
    const latest = await db.snapshots
      .where("[sceneId+createdAt]")
      .between([sceneId, 0], [sceneId, Infinity])
      .last();
    if (latest && (latest.payload as Stored).hash === hash) return null; // nothing changed since the last snapshot
  }
  const fileRefs: Record<string, FileRef> = {};
  for (const p of pages) Object.assign(fileRefs, p.fileRefs);
  const content: SnapshotContent = { title: scene.title, pages };
  const stored: Stored = {
    gz: await gzipJson(content),
    fileRefs,
    elementCount: pages.reduce((n, p) => n + p.elements.length, 0),
    pageCount: pages.length,
    hash,
  };
  const snap: Snapshot = {
    id: newId(),
    sceneId,
    createdAt: now,
    label: opts.label?.trim() || undefined,
    kind: opts.kind,
    payload: stored,
  };
  await db.snapshots.add(snap);
  if (opts.kind === "auto") await pruneSnapshots(sceneId, now);
  return meta(snap);
}

export async function listSnapshots(sceneId: string): Promise<SnapshotMeta[]> {
  const rows = await getDb().snapshots.where("sceneId").equals(sceneId).toArray();
  return rows.map(meta).sort((a, b) => b.createdAt - a.createdAt);
}

export async function pruneSnapshots(sceneId: string, now = Date.now()): Promise<number> {
  const all = await listSnapshots(sceneId);
  const drop = selectPrune(all, now);
  if (drop.length) await getDb().snapshots.bulkDelete(drop);
  return drop.length;
}

export async function loadSnapshot(id: string): Promise<SnapshotContent> {
  const row = await getDb().snapshots.get(id);
  if (!row) throw new Error("Snapshot not found");
  return gunzipJson<SnapshotContent>((row.payload as Stored).gz);
}

export async function renameSnapshot(id: string, label: string) {
  const db = getDb();
  const row = await db.snapshots.get(id);
  if (!row) return;
  // Naming a snapshot promotes it to a checkpoint that is never pruned.
  await db.snapshots.update(id, {
    label: label.trim() || undefined,
    kind: label.trim() ? "named" : row.kind,
  });
}

export async function deleteSnapshot(id: string) {
  await getDb().snapshots.delete(id);
}

/**
 * Restore a snapshot. A "pre-restore" copy of the current state is taken first, so a restore can
 * always be undone by restoring that copy.
 */
export async function restoreSnapshot(sceneId: string, snapshotId: string): Promise<void> {
  const content = await loadSnapshot(snapshotId);
  await takeSnapshot(sceneId, { kind: "pre-restore", label: "Before restore" });
  const db = getDb();
  await db.transaction("rw", db.scenes, db.pages, async () => {
    const existing = new Map(
      (await db.pages.where("sceneId").equals(sceneId).toArray()).map((p) => [p.id, p]),
    );
    const keep = new Set(content.pages.map((p) => p.id));
    for (const [id] of existing) if (!keep.has(id)) await db.pages.delete(id);
    for (const p of content.pages) {
      const cur = existing.get(p.id);
      await db.pages.put({
        id: p.id,
        sceneId,
        order: p.order,
        title: p.title,
        elements: p.elements,
        appState: p.appState,
        fileRefs: p.fileRefs,
        rev: (cur?.rev ?? 0) + 1,
        schemaVersion: SCHEMA_VERSION,
      });
    }
    await db.scenes.update(sceneId, {
      pageIds: content.pages.sort((a, b) => a.order - b.order).map((p) => p.id),
      updatedAt: Date.now(),
    });
  });
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

/** Element-level difference between two states (ignores deleted elements). */
export function diffElements(
  from: readonly { id: string; version?: number; isDeleted?: boolean }[],
  to: readonly { id: string; version?: number; isDeleted?: boolean }[],
): DiffSummary {
  const a = new Map(from.filter((e) => !e.isDeleted).map((e) => [e.id, e.version ?? 0]));
  const b = new Map(to.filter((e) => !e.isDeleted).map((e) => [e.id, e.version ?? 0]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;
  for (const [id, v] of b) {
    if (!a.has(id)) added++;
    else if (a.get(id) !== v) changed++;
    else unchanged++;
  }
  for (const id of a.keys()) if (!b.has(id)) removed++;
  return { added, removed, changed, unchanged };
}
