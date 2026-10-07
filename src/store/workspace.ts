import { create } from "zustand";
import { onTabMessage, postTab } from "@/persistence/channel";
import * as repo from "@/persistence/repo";
import { buildBackup, importAny, importEmbeddedImage } from "@/persistence/backup";
import { getEditorApi } from "@/engine/apiRef";
import type { SaveStatus } from "@/persistence/autosave";
import { CorruptSceneError, type Folder, type Page, type Scene } from "@/persistence/types";
import { useToasts } from "./toasts";

export interface ActiveScene {
  scene: Scene;
  page: Page;
  files: repo.LoadedFile[];
  /** Changes whenever the canvas must be remounted from storage. */
  nonce: number;
}

export interface CorruptState {
  sceneId: string;
  reason: string;
  raw: unknown;
}

export interface ConflictState {
  kind: "save" | "external";
  sceneId: string;
  pageId: string;
}

interface SceneController {
  flush(): Promise<void>;
  discard(): void;
}

interface WorkspaceState {
  ready: boolean;
  scenes: Scene[];
  trash: Scene[];
  folders: Folder[];
  folderFilter: string | "all" | "trash";
  search: string;
  panelOpen: boolean;
  active: ActiveScene | null;
  corrupt: CorruptState | null;
  conflict: ConflictState | null;
  saveStatus: SaveStatus;
  persisted: boolean | null;
  storageLow: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  openScene: (id: string) => Promise<void>;
  reloadActive: () => Promise<void>;
  newScene: () => Promise<void>;
  setPanelOpen: (v: boolean) => void;
  setFolderFilter: (f: string) => void;
  setSearch: (s: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setConflict: (c: ConflictState | null) => void;
  trashScene: (id: string) => Promise<void>;
  restoreScene: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  duplicateScene: (id: string) => Promise<void>;
  downloadBackup: () => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
}

let controller: SceneController | null = null;
export function registerController(c: SceneController | null) {
  controller = c;
}

const LAST_SCENE_KEY = "lastSceneId";

function setUrlScene(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("scene", id);
  window.history.replaceState(null, "", url);
}

export const useWorkspace = create<WorkspaceState>((set, get) => {
  async function load(id: string, nonce: number): Promise<ActiveScene | null> {
    const scene = await repo.getScene(id);
    if (!scene || scene.deletedAt !== null) return null;
    try {
      const page = await repo.loadPage(id);
      const files = await repo.loadFiles(page.fileRefs);
      return { scene, page, files, nonce };
    } catch (e) {
      if (e instanceof CorruptSceneError) {
        set({ corrupt: { sceneId: id, reason: e.reason, raw: e.raw }, active: null });
        return null;
      }
      throw e;
    }
  }

  return {
    ready: false,
    scenes: [],
    trash: [],
    folders: [],
    folderFilter: "all",
    search: "",
    panelOpen: false,
    active: null,
    corrupt: null,
    conflict: null,
    saveStatus: "idle",
    persisted: null,
    storageLow: false,

    async init() {
      if (get().ready) return;
      try {
        if (navigator.storage?.persist) {
          const already = await navigator.storage.persisted?.();
          set({ persisted: already || (await navigator.storage.persist()) });
        }
        const est = await navigator.storage?.estimate?.();
        if (est?.quota && est.usage !== undefined) set({ storageLow: est.usage / est.quota > 0.8 });
      } catch {
        /* storage API unavailable: status stays unknown */
      }
      await repo.purgeExpiredTrash();
      await repo.gcBlobs();
      await get().refresh();

      const wanted = new URLSearchParams(window.location.search).get("scene");
      const last = await repo.getSetting<string | null>(LAST_SCENE_KEY, null);
      const candidates = [wanted, last, get().scenes[0]?.id].filter((x): x is string => !!x);
      let target: ActiveScene | null = null;
      for (const id of candidates) {
        target = await load(id, 1);
        if (target || get().corrupt) break;
      }
      if (!target && !get().corrupt) {
        const s = await repo.createScene({ title: "Untitled" });
        await get().refresh();
        target = await load(s.id, 1);
      }
      if (target) {
        set({ active: target });
        setUrlScene(target.scene.id);
        await repo.setSetting(LAST_SCENE_KEY, target.scene.id);
      }
      set({ ready: true });

      onTabMessage((m) => {
        if (m.kind === "workspace-changed" || m.kind === "page-saved") void get().refresh();
        if (m.kind === "page-saved") {
          const a = get().active;
          if (a && a.page.id === m.pageId) {
            set({ conflict: { kind: "external", sceneId: m.sceneId, pageId: m.pageId } });
          }
        }
      });
    },

    async refresh() {
      const [scenes, trash, folders] = await Promise.all([
        repo.listScenes(),
        repo.listTrash(),
        repo.listFolders(),
      ]);
      set({ scenes, trash, folders });
    },

    async openScene(id) {
      await controller?.flush();
      const next = await load(id, (get().active?.nonce ?? 0) + 1);
      if (!next) return;
      set({ active: next, corrupt: null, conflict: null, saveStatus: "idle" });
      setUrlScene(id);
      await repo.setSetting(LAST_SCENE_KEY, id);
    },

    async reloadActive() {
      const a = get().active;
      if (!a) return;
      controller?.discard();
      const next = await load(a.scene.id, a.nonce + 1);
      if (next) set({ active: next, conflict: null, saveStatus: "idle" });
    },

    async newScene() {
      await controller?.flush();
      const s = await repo.createScene({
        folderId: /^[0-9a-f-]{36}$/.test(get().folderFilter) ? get().folderFilter : null,
      });
      await get().refresh();
      postTab({ kind: "workspace-changed" });
      await get().openScene(s.id);
    },

    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setFolderFilter: (folderFilter) => set({ folderFilter }),
    setSearch: (search) => set({ search }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    setConflict: (conflict) => set({ conflict }),

    async trashScene(id) {
      const isActive = get().active?.scene.id === id;
      if (isActive) await controller?.flush();
      await repo.trashScene(id);
      await get().refresh();
      postTab({ kind: "workspace-changed" });
      const title = get().trash.find((s) => s.id === id)?.title ?? "Scene";
      useToasts.getState().push({
        message: `Moved “${title}” to trash`,
        action: {
          label: "Undo",
          run: () => void get().restoreScene(id),
        },
      });
      if (isActive) {
        const next = get().scenes[0];
        if (next) await get().openScene(next.id);
        else await get().newScene();
      }
    },

    async restoreScene(id) {
      await repo.restoreScene(id);
      await get().refresh();
      postTab({ kind: "workspace-changed" });
    },

    async deleteForever(id) {
      await repo.deleteSceneForever(id);
      await get().refresh();
      postTab({ kind: "workspace-changed" });
    },

    async duplicateScene(id) {
      await controller?.flush();
      const copy = await repo.duplicateScene(id);
      await get().refresh();
      postTab({ kind: "workspace-changed" });
      await get().openScene(copy.id);
    },

    async downloadBackup() {
      const json = await buildBackup();
      downloadText(json, `archboard-backup-${new Date().toISOString().slice(0, 10)}.json`);
    },

    async importFiles(files) {
      let scenes = 0;
      let libs = 0;
      for (const f of Array.from(files)) {
        try {
          if (/\.(png|svg)$/i.test(f.name)) {
            await importEmbeddedImage(f);
            scenes += 1;
          } else if (/\.excalidrawlib$/i.test(f.name)) {
            const { loadLibraryFromBlob } = await import("@excalidraw/excalidraw");
            const items = await loadLibraryFromBlob(f);
            const api = getEditorApi();
            if (!api) throw new Error("Open a scene first");
            await api.updateLibrary({ libraryItems: items, merge: true });
            libs += items.length;
          } else {
            scenes += (await importAny(await f.text(), f.name)).scenes;
          }
        } catch (e) {
          useToasts
            .getState()
            .push({ message: `Could not import ${f.name}: ${(e as Error).message}` });
        }
      }
      await get().refresh();
      postTab({ kind: "workspace-changed" });
      if (scenes)
        useToasts
          .getState()
          .push({ message: `Imported ${scenes} scene${scenes === 1 ? "" : "s"}` });
      if (libs)
        useToasts
          .getState()
          .push({ message: `Added ${libs} library item${libs === 1 ? "" : "s"}` });
    },
  };
});

export function downloadText(text: string, filename: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
