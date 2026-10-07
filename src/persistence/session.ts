import { dataURLToBytes, sha256Hex } from "./blobs";
import { savePage } from "./repo";
import type { BlobRecord, FileRef, PersistedAppState } from "./types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface LiveFile {
  mimeType: string;
  dataURL: string;
  created: number;
}

/** Loose view of Excalidraw's AppState: only the fields we persist. */
export interface AppStateLike {
  viewBackgroundColor?: string;
  scrollX?: number;
  scrollY?: number;
  zoom?: { value: number };
  gridSize?: number;
  gridModeEnabled?: boolean;
  objectsSnapModeEnabled?: boolean;
  activeTool?: { type: string };
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

export function pickAppState(s: AppStateLike): PersistedAppState {
  // The image tool opens a file picker on activation, so never restore into it.
  const tool = s.activeTool?.type;
  return {
    viewBackgroundColor: s.viewBackgroundColor,
    scrollX: s.scrollX,
    scrollY: s.scrollY,
    zoom: s.zoom ? { value: s.zoom.value } : undefined,
    gridSize: s.gridSize,
    gridModeEnabled: s.gridModeEnabled,
    objectsSnapModeEnabled: s.objectsSnapModeEnabled,
    selectedTool: tool && tool !== "image" ? tool : undefined,
    currentItemStrokeColor: s.currentItemStrokeColor,
    currentItemBackgroundColor: s.currentItemBackgroundColor,
    currentItemFillStyle: s.currentItemFillStyle,
    currentItemStrokeWidth: s.currentItemStrokeWidth,
    currentItemStrokeStyle: s.currentItemStrokeStyle,
    currentItemRoughness: s.currentItemRoughness,
    currentItemOpacity: s.currentItemOpacity,
    currentItemFontFamily: s.currentItemFontFamily,
    currentItemFontSize: s.currentItemFontSize,
    currentItemTextAlign: s.currentItemTextAlign,
    currentItemRoundness: s.currentItemRoundness,
    currentItemArrowType: s.currentItemArrowType,
  };
}

/** Everything needed to translate a live Excalidraw scene into a transactional page write. */
export class PageSession {
  /** fileId → hash, so each image is hashed once per session rather than on every save. */
  private readonly hashes = new Map<string, string>();
  private lastSig: string | null = null;

  constructor(
    readonly sceneId: string,
    readonly pageId: string,
    public rev: number,
    private fileRefs: Record<string, FileRef>,
  ) {
    for (const [id, r] of Object.entries(fileRefs)) this.hashes.set(id, r.hash);
  }

  /**
   * Returns true when the caller should schedule a save. The first call only records a baseline,
   * so merely opening a scene never rewrites it (and never wakes other tabs).
   */
  markChanged(sig: string): boolean {
    if (this.lastSig === null) {
      this.lastSig = sig;
      return false;
    }
    if (sig === this.lastSig) return false;
    this.lastSig = sig;
    return true;
  }

  async persist(
    elements: readonly ExcalidrawElement[],
    appState: AppStateLike,
    files: Readonly<Record<string, LiveFile | undefined>>,
  ): Promise<number> {
    // Deleted elements only matter for collaboration reconciliation; undo history is in memory.
    const live = elements.filter((e) => !e.isDeleted);
    const blobs: BlobRecord[] = [];
    const nextRefs: Record<string, FileRef> = {};
    for (const el of live) {
      if (el.type !== "image" || !el.fileId) continue;
      const id = el.fileId as string;
      const file = files[id];
      if (file) {
        let hash = this.hashes.get(id);
        if (!hash) {
          const { bytes, mime } = dataURLToBytes(file.dataURL);
          hash = await sha256Hex(bytes);
          this.hashes.set(id, hash);
          blobs.push({ hash, mime, bytes, size: bytes.byteLength, createdAt: Date.now() });
        }
        nextRefs[id] = { hash, mimeType: file.mimeType, created: file.created };
      } else if (this.fileRefs[id]) {
        nextRefs[id] = this.fileRefs[id]; // bytes not loaded into the editor yet: keep the stored ref
      }
    }
    const rev = await savePage({
      sceneId: this.sceneId,
      pageId: this.pageId,
      elements: live as ExcalidrawElement[],
      appState: pickAppState(appState),
      fileRefs: nextRefs,
      blobs,
      expectedRev: this.rev,
    });
    this.rev = rev;
    this.fileRefs = nextRefs;
    return rev;
  }
}
