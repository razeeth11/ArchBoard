import { dataURLToBytes, sha256Hex } from "./blobs";
import {
  CorruptSceneError,
  SCHEMA_VERSION,
  type BlobRecord,
  type FileRef,
  type Page,
  type PersistedAppState,
} from "./types";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Cheap structural validation. Anything that fails is treated as corrupt, never silently repaired. */
export function validatePageShape(sceneId: string, raw: unknown): asserts raw is Page {
  if (!isRec(raw)) throw new CorruptSceneError(sceneId, "page is not an object", raw);
  if (typeof raw.id !== "string") throw new CorruptSceneError(sceneId, "page.id missing", raw);
  if (!Array.isArray(raw.elements))
    throw new CorruptSceneError(sceneId, "elements is not an array", raw);
  for (const el of raw.elements) {
    if (!isRec(el) || typeof el.id !== "string" || typeof el.type !== "string") {
      throw new CorruptSceneError(sceneId, "element has no id/type", raw);
    }
  }
  if (!isRec(raw.appState)) throw new CorruptSceneError(sceneId, "appState is not an object", raw);
  if (!isRec(raw.fileRefs)) throw new CorruptSceneError(sceneId, "fileRefs is not an object", raw);
  if (typeof raw.rev !== "number") throw new CorruptSceneError(sceneId, "rev missing", raw);
}

export interface UpgradedPage {
  page: Page;
  /** Blobs extracted from legacy inline data that must be written alongside the page. */
  blobs: BlobRecord[];
}

/**
 * Bring any stored page row up to the current schema. Pure apart from hashing.
 * v0 (pre-release prototype): `{ id, sceneId, elements, appState, files: { [fileId]: { mimeType, dataURL, created } } }`
 * with images inlined as base64 and no `rev`/`fileRefs`.
 */
export async function upgradePage(sceneId: string, raw: unknown): Promise<UpgradedPage> {
  if (!isRec(raw)) throw new CorruptSceneError(sceneId, "page is not an object", raw);
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new CorruptSceneError(sceneId, `written by a newer app version (schema ${version})`, raw);
  }
  if (version === SCHEMA_VERSION) {
    validatePageShape(sceneId, raw);
    return { page: raw, blobs: [] };
  }

  // v0 → v1
  const blobs: BlobRecord[] = [];
  const fileRefs: Record<string, FileRef> = {};
  const files = isRec(raw.files) ? raw.files : {};
  for (const [fileId, f] of Object.entries(files)) {
    if (!isRec(f) || typeof f.dataURL !== "string") continue;
    const { bytes, mime } = dataURLToBytes(f.dataURL);
    const hash = await sha256Hex(bytes);
    const mimeType = typeof f.mimeType === "string" ? f.mimeType : mime;
    blobs.push({ hash, mime: mimeType, bytes, size: bytes.byteLength, createdAt: Date.now() });
    fileRefs[fileId] = {
      hash,
      mimeType,
      created: typeof f.created === "number" ? f.created : Date.now(),
    };
  }
  const appState: PersistedAppState = isRec(raw.appState)
    ? (raw.appState as PersistedAppState)
    : {};
  const upgraded = {
    id: raw.id,
    sceneId,
    order: typeof raw.order === "number" ? raw.order : 0,
    title: typeof raw.title === "string" ? raw.title : "Page 1",
    elements: raw.elements,
    appState,
    fileRefs,
    rev: typeof raw.rev === "number" ? raw.rev : 1,
    schemaVersion: SCHEMA_VERSION,
  };
  validatePageShape(sceneId, upgraded);
  return { page: upgraded, blobs };
}
