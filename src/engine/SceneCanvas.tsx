"use client";

import { Excalidraw, getSceneVersion, reconcileElements } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useEffect, useMemo, useState } from "react";
import { Autosaver } from "@/persistence/autosave";
import { postTab } from "@/persistence/channel";
import * as repo from "@/persistence/repo";
import { PageSession, type AppStateLike, type LiveFile } from "@/persistence/session";
import { ConflictError } from "@/persistence/types";
import { registerController, useWorkspace, type ActiveScene } from "@/store/workspace";
import { resolveTheme, usePrefs } from "@/store/prefs";
import { WorkspaceTopRight } from "@/ui/workspace/TopRight";
import { sha256Hex } from "@/persistence/blobs";
import { setEditorApi } from "./apiRef";

declare global {
  interface Window {
    /** Read-only-ish handle used by e2e tests and debugging. */
    __archboard?: { api: ExcalidrawImperativeAPI };
  }
}

const THUMB_MIN_INTERVAL_MS = 8000;
const THUMB_MAX_ELEMENTS = 3000;

function signature(elements: readonly OrderedExcalidrawElement[], s: AppState): string {
  return `${getSceneVersion(elements)}|${s.scrollX}|${s.scrollY}|${s.zoom.value}|${s.viewBackgroundColor}|${s.activeTool.type}`;
}

function toInitialData(a: ActiveScene): ExcalidrawInitialDataState {
  const st = a.page.appState;
  const files: Record<string, BinaryFileData> = {};
  for (const f of a.files) {
    files[f.id] = {
      id: f.id as BinaryFileData["id"],
      mimeType: f.mimeType as BinaryFileData["mimeType"],
      dataURL: f.dataURL as BinaryFileData["dataURL"],
      created: f.created,
    };
  }
  const { selectedTool, ...rest } = st;
  return {
    elements: a.page.elements as ExcalidrawInitialDataState["elements"],
    appState: {
      ...(rest as Partial<AppState>),
      ...(selectedTool
        ? {
            activeTool: {
              type: selectedTool,
              customType: null,
              locked: false,
              lastActiveTool: null,
              fromSelection: false,
            },
          }
        : {}),
    } as ExcalidrawInitialDataState["appState"],
    files,
    scrollToContent: st.scrollX === undefined,
  };
}

export function SceneCanvas({ active }: { active: ActiveScene }) {
  const pref = usePrefs((s) => s.theme);
  const setSaveStatus = useWorkspace((s) => s.setSaveStatus);
  const setConflict = useWorkspace((s) => s.setConflict);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const initialData = useMemo(() => toInitialData(active), [active]);

  const ctl = useMemo(() => {
    const session = new PageSession(
      active.scene.id,
      active.page.id,
      active.page.rev,
      active.page.fileRefs,
    );
    const saver = new Autosaver(500, (s, err) => {
      if (s === "error" && err instanceof ConflictError) {
        saver.pause();
        setSaveStatus("conflict");
        setConflict({ kind: "save", sceneId: session.sceneId, pageId: session.pageId });
      } else {
        setSaveStatus(s);
      }
    });
    return {
      session,
      saver,
      lastThumb: 0,
      latest: null as null | {
        e: readonly OrderedExcalidrawElement[];
        s: AppState;
        f: Record<string, LiveFile | undefined>;
      },
    };
  }, [active, setSaveStatus, setConflict]);

  // Lifecycle: register as the active controller; flush on tab hide/close.
  useEffect(() => {
    const flush = () => ctl.saver.flush();
    registerController({
      flush,
      discard: () => {
        ctl.saver.discard();
      },
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      void flush();
      registerController(null);
    };
  }, [ctl]);

  // Conflict resolution requested from the dialog.
  useEffect(() => {
    const onResolve = async (e: Event) => {
      const choice = (e as CustomEvent<"merge" | "mine">).detail;
      const remote = await repo.loadPage(ctl.session.sceneId, ctl.session.pageId);
      if (choice === "merge" && api) {
        const local = api.getSceneElementsIncludingDeleted();
        const merged = reconcileElements(
          local as never,
          remote.elements as never,
          api.getAppState() as never,
        );
        const have = new Set(Object.keys(api.getFiles()));
        const missing = Object.fromEntries(
          Object.entries(remote.fileRefs).filter(([id]) => !have.has(id)),
        );
        const files = await repo.loadFiles(missing);
        if (files.length) api.addFiles(files as unknown as BinaryFileData[]);
        api.updateScene({ elements: merged });
      }
      ctl.session.rev = remote.rev;
      setConflict(null);
      ctl.saver.resume();
      if (api)
        scheduleSave(
          api.getSceneElementsIncludingDeleted() as never,
          api.getAppState(),
          api.getFiles() as never,
        );
    };
    window.addEventListener("archboard:resolve-conflict", onResolve);
    return () => window.removeEventListener("archboard:resolve-conflict", onResolve);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ctl]);

  function scheduleSave(
    elements: readonly OrderedExcalidrawElement[],
    appState: AppStateLike,
    files: Record<string, LiveFile | undefined>,
  ) {
    ctl.saver.schedule(async () => {
      const rev = await ctl.session.persist(elements, appState, files);
      postTab({
        kind: "page-saved",
        sceneId: ctl.session.sceneId,
        pageId: ctl.session.pageId,
        rev,
      });
      void maybeThumbnail(elements, appState);
    });
  }

  async function maybeThumbnail(
    elements: readonly OrderedExcalidrawElement[],
    appState: AppStateLike,
  ) {
    const now = Date.now();
    if (now - ctl.lastThumb < THUMB_MIN_INTERVAL_MS) return;
    ctl.lastThumb = now;
    const live = elements.filter((e) => !e.isDeleted);
    try {
      if (live.length === 0 || live.length > THUMB_MAX_ELEMENTS) {
        if (live.length === 0) await repo.setThumbnail(ctl.session.sceneId, null);
        return;
      }
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: live,
        appState: {
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
        },
        files: (ctl.latest?.f ?? {}) as never,
        maxWidthOrHeight: 320,
        mimeType: "image/png",
      });
      const bytes = await blob.arrayBuffer();
      const hash = await sha256Hex(bytes);
      await repo.setThumbnail(ctl.session.sceneId, {
        hash,
        mime: "image/png",
        bytes,
        size: bytes.byteLength,
        createdAt: now,
      });
      void useWorkspace.getState().refresh();
    } catch {
      /* thumbnails are best-effort */
    }
  }

  return (
    <div className="h-dvh w-full" data-testid="editor-root">
      <Excalidraw
        key={`${active.scene.id}:${active.nonce}`}
        name={active.scene.title}
        theme={resolveTheme(pref)}
        handleKeyboardGlobally
        autoFocus
        initialData={initialData}
        excalidrawAPI={(a) => {
          setApi(a);
          setEditorApi(a);
          window.__archboard = { api: a };
          void repo.loadLibraryItems().then((items) => {
            if (items.length) void a.updateLibrary({ libraryItems: items as never, merge: false });
          });
        }}
        onLibraryChange={(items) => void repo.saveLibraryItems(items as unknown[])}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
            export: false,
            saveAsImage: false,
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
        renderTopRightUI={() => <WorkspaceTopRight />}
        onChange={(elements, appState, files) => {
          ctl.latest = { e: elements, s: appState, f: files as never };
          if (!ctl.session.markChanged(signature(elements, appState))) return;
          scheduleSave(elements, appState as unknown as AppStateLike, files as never);
        }}
      />
    </div>
  );
}
