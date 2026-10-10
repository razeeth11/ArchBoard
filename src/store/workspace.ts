import { create } from "zustand";
import { onTabMessage, postTab } from "@/persistence/channel";
import * as repo from "@/persistence/repo";
import * as pageOps from "@/persistence/pages";
import { listPages } from "@/persistence/pages";
import { buildBackup, importAny, importEmbeddedImage } from "@/persistence/backup";
import { getEditorApi } from "@/engine/apiRef";
import type { SaveStatus } from "@/persistence/autosave";
import { CorruptSceneError, type Folder, type Page, type Scene } from "@/persistence/types";
import { useToasts } from "./toasts";

export interface ActiveScene {
  scene: Scene;
  page: Page;
  /** Every page of the scene, in order (titles only are needed by the tabs). */
  pages: { id: string; title: string }[];
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
  flushSaves: () => Promise<void>;
  newScene: () => Promise<void>;
  openPage: (pageId: string) => Promise<void>;
  addPage: () => Promise<void>;
  renamePage: (pageId: string, title: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  movePage: (pageId: string, delta: -1 | 1) => Promise<void>;
  duplicatePage: (pageId: string) => Promise<void>;
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
  async function load(id: string, nonce: number, pageId?: string): Promise<ActiveScene | null> {
    const scene = await repo.getScene(id);
    if (!scene || scene.deletedAt !== null) return null;
    try {
      const remembered = pageId ?? (await repo.getSetting<string | null>(`lastPage:${id}`, null));
      const wanted = remembered && scene.pageIds.includes(remembered) ? remembered : undefined;
      const page = await repo.loadPage(id, wanted);
      const files = await repo.loadFiles(page.fileRefs);
      const pages = (await listPages(id)).map((p) => ({ id: p.id, title: p.title }));
      return { scene, page, pages, files, nonce };
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
      let target: ActiveScene | null = wanted ? await load(wanted, 1) : null;
      if (!target && !get().corrupt) {
        // Opening the editor without a scene (Start drawing, /app) always gives a fresh whiteboard. An
        // untouched empty one from a moment ago is reused so empty scenes do not pile up. Existing work
        // is reached from the home page's recent list or the Scenes panel.
        const newest = get().scenes[0];
        let reuse: string | null = null;
        if (newest && newest.title === "Untitled" && newest.pageIds.length === 1) {
          const first = await repo.loadPage(newest.id).catch(() => null);
          if (first && first.elements.length === 0) reuse = newest.id;
        }
        const id = reuse ?? (await repo.createScene({ title: "Untitled" })).id;
        if (!reuse) await get().refresh();
        target = await load(id, 1);
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

    async openPage(pageId) {
      const a = get().active;
      if (!a || a.page.id === pageId) return;
      await controller?.flush();
      const next = await load(a.scene.id, a.nonce + 1, pageId);
      if (!next) return;
      set({ active: next, conflict: null, saveStatus: "idle" });
      await repo.setSetting(`lastPage:${a.scene.id}`, pageId);
    },

    async addPage() {
      const a = get().active;
      if (!a) return;
      await controller?.flush();
      const p = await pageOps.addPage(a.scene.id, undefined, a.page.id);
      postTab({ kind: "workspace-changed" });
      const next = await load(a.scene.id, a.nonce + 1, p.id);
      if (next) set({ active: next, conflict: null, saveStatus: "idle" });
      await repo.setSetting(`lastPage:${a.scene.id}`, p.id);
    },

    async renamePage(pageId, title) {
      const a = get().active;
      if (!a) return;
      await pageOps.renamePage(pageId, title);
      set({
        active: {
          ...a,
          pages: a.pages.map((p) =>
            p.id === pageId ? { ...p, title: title.trim() || "Untitled page" } : p,
          ),
        },
      });
    },

    async deletePage(pageId) {
      const a = get().active;
      if (!a) return;
      await controller?.flush();
      try {
        await pageOps.deletePage(a.scene.id, pageId);
      } catch (e) {
        useToasts.getState().push({ message: (e as Error).message });
        return;
      }
      const left = a.pages.filter((p) => p.id !== pageId);
      const target =
        a.page.id === pageId
          ? (left[
              Math.min(
                a.pages.findIndex((p) => p.id === pageId),
                left.length - 1,
              )
            ]?.id ?? left[0]!.id)
          : a.page.id;
      const next = await load(a.scene.id, a.nonce + 1, target);
      if (next) set({ active: next, conflict: null });
    },

    async movePage(pageId, delta) {
      const a = get().active;
      if (!a) return;
      await pageOps.movePage(a.scene.id, pageId, delta);
      const pages = (await listPages(a.scene.id)).map((p) => ({ id: p.id, title: p.title }));
      set({ active: { ...a, pages } });
    },

    async duplicatePage(pageId) {
      const a = get().active;
      if (!a) return;
      await controller?.flush();
      const p = await pageOps.duplicatePage(a.scene.id, pageId);
      const next = await load(a.scene.id, a.nonce + 1, p.id);
      if (next) set({ active: next, conflict: null });
    },

    async flushSaves() {
      await controller?.flush();
    },

    async reloadActive() {
      const a = get().active;
      if (!a) return;
      controller?.discard();
      const next = await load(a.scene.id, a.nonce + 1, a.page.id);
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
