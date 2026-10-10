"use client";

import "@excalidraw/excalidraw/index.css";
import { useEffect, useState } from "react";
import { resolveTheme, usePrefs } from "@/store/prefs";
import { useWorkspace } from "@/store/workspace";
import { SceneCanvas } from "./SceneCanvas";
import { ConflictDialog, RecoveryDialog } from "@/ui/workspace/dialogs";
import { EditorErrorBoundary } from "@/ui/workspace/ErrorBoundary";
import { ExportDialog } from "@/ui/export/ExportDialog";
import { useUi } from "@/store/ui";
import { useToasts } from "@/store/toasts";
import { getEditorApi } from "./apiRef";
import { importSvgIntoScene, isSvgFile, looksLikeSvg, readSvgFile } from "@/library/svgImport";
import { SmartInspector } from "@/ui/smart/SmartInspector";
import { CreateSmartDialog } from "@/ui/smart/CreateSmartDialog";
import { JsonDefDialog } from "@/ui/smart/JsonDefDialog";
import { useSmart } from "@/store/smart";
import { ComponentsPanel } from "@/ui/library/ComponentsPanel";
import { installTextLists } from "./textList";
import { registerServiceWorker } from "@/pwa/register";
import { ShareViewer } from "@/ui/share/ShareViewer";
import { decodeShare, parseFragment, type SharePayload } from "@/share/link";
import { payloadToExcalidrawJson } from "@/share/payload";
import { importExcalidrawFile } from "@/persistence/backup";
import { DesignPanel } from "@/ui/design/DesignPanel";
import { PageTabs } from "@/ui/pages/PageTabs";
import { HistoryDialog } from "@/ui/history/HistoryDialog";
import { DslDialog } from "@/ui/dsl/DslDialog";
import { AiDialog } from "@/ui/ai/AiDialog";
import { MermaidDialog } from "@/ui/mermaid/MermaidDialog";
import { ShareDialog } from "@/ui/share/ShareDialog";
import { SlidesDialog } from "@/ui/slides/SlidesDialog";
import { PresentOverlay } from "@/ui/slides/PresentOverlay";
import { CommentsPanel, CommentPins } from "@/ui/comments/CommentsPanel";
import { StylesDialog } from "@/ui/styles/StylesDialog";
import { CommandPalette } from "@/ui/palette/CommandPalette";
import { AutoTooltips } from "@/ui/workspace/AutoTooltips";
import { ToastHost } from "@/ui/workspace/ToastHost";
import { WorkspacePanel } from "@/ui/workspace/WorkspacePanel";

// Fonts and locales are served from our own origin so the editor works offline and under a strict CSP.
if (typeof window !== "undefined") {
  // Build-time tooling hook (scripts/build-previews.mjs): renders the catalog thumbnails.
  (window as unknown as { __archboardTools: unknown }).__archboardTools = {
    templateSvgs: async () => (await import("@/content/preview")).allTemplateSvgs(),
  };
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
    "/excalidraw-assets/";
}

function Workspace() {
  const pref = usePrefs((s) => s.theme);
  const init = useWorkspace((s) => s.init);
  const active = useWorkspace((s) => s.active);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(pref);
  }, [pref]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        useUi.getState().setExportOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    registerServiceWorker();
  }, []);
  useEffect(() => installTextLists(), []);
  useEffect(() => {
    void useUi.getState().hydrate();
    void useSmart.getState().load();
  }, []);
  useEffect(() => {
    // Pasted SVG markup or SVG files are sanitized by us instead of reaching the engine raw.
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input,textarea,[contenteditable=true]") || t.isContentEditable)) return;
      const api = getEditorApi();
      const cd = e.clipboardData;
      if (!api || !cd) return;
      const file = Array.from(cd.files).find(isSvgFile);
      const text = cd.getData("text/plain");
      if (!file && !looksLikeSvg(text)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void (file ? readSvgFile(file) : Promise.resolve(text))
        .then((src) =>
          importSvgIntoScene(
            api,
            src,
            file?.name.replace(/\.svg$/i, "") ?? "pasted",
            useUi.getState().svgMode,
          ),
        )
        .catch((err) =>
          useToasts
            .getState()
            .push({ message: err instanceof Error ? err.message : "Could not import that SVG" }),
        );
    };
    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, []);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <>
      {active ? <SceneCanvas active={active} /> : <div className="bg-surface h-dvh" aria-hidden />}
      <WorkspacePanel />
      <ComponentsPanel />
      <SmartInspector />
      <CreateSmartDialog />
      <JsonDefDialog />
      <PageTabs />
      <DesignPanel />
      <HistoryDialog />
      <DslDialog />
      <MermaidDialog />
      <AiDialog />
      <ShareDialog />
      <SlidesDialog />
      <PresentOverlay />
      <CommentsPanel />
      <CommentPins />
      <StylesDialog />
      <CommandPalette />
      <ExportDialog />
      <ConflictDialog />
      <RecoveryDialog />
      <ToastHost />
      <AutoTooltips />
    </>
  );
}

type Gate =
  | { state: "checking" }
  | { state: "app" }
  | { state: "view"; payload: SharePayload }
  | { state: "error"; message: string };

/** A `#share=…` fragment decides what to show: the viewer, a fresh editable copy, or the normal app. */
function ShareGate() {
  const [gate, setGate] = useState<Gate>({ state: "checking" });
  useEffect(() => {
    // `?template=slug` opens a new scene built from that template (a link from the catalog).
    const tpl = new URLSearchParams(location.search).get("template");
    if (tpl) {
      let alive = true;
      void import("@/content/openTemplate")
        .then((m) => m.createSceneFromTemplate(tpl))
        .then((s) => {
          if (!alive) return;
          const url = new URL(location.href);
          url.searchParams.delete("template");
          url.searchParams.set("scene", s.id);
          history.replaceState(null, "", url);
          setGate({ state: "app" });
        })
        .catch(
          (e) =>
            alive &&
            setGate({
              state: "error",
              message: e instanceof Error ? e.message : "Template failed",
            }),
        );
      return () => {
        alive = false;
      };
    }
    const frag = parseFragment(location.hash);
    if (!frag) {
      queueMicrotask(() => setGate({ state: "app" }));
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const { payload } = await decodeShare(location.hash);
        if (!alive) return;
        // The fragment is consumed so a reload or a copied URL bar does not re-import.
        history.replaceState(null, "", location.pathname + location.search);
        if (frag.mode === "view") {
          setGate({ state: "view", payload });
          return;
        }
        const s = await importExcalidrawFile(payloadToExcalidrawJson(payload), payload.title);
        const url = new URL(location.href);
        url.searchParams.set("scene", s.id);
        history.replaceState(null, "", url);
        setGate({ state: "app" });
      } catch (e) {
        if (alive)
          setGate({ state: "error", message: e instanceof Error ? e.message : "Invalid link" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (gate.state === "checking") return <div className="bg-surface h-dvh" aria-hidden />;
  if (gate.state === "view")
    return (
      <ShareViewer
        payload={gate.payload}
        onCopy={(id) => {
          const url = new URL(window.location.href);
          url.searchParams.set("scene", id);
          window.history.replaceState(null, "", url);
          setGate({ state: "app" });
        }}
      />
    );
  if (gate.state === "error")
    return (
      <div
        role="alert"
        data-testid="share-error"
        className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p>This share link could not be opened: {gate.message}</p>
        <a className="underline" href="/app">
          Open ArchBoard
        </a>
      </div>
    );
  return <Workspace />;
}

export default function Editor() {
  return (
    <EditorErrorBoundary>
      <ShareGate />
    </EditorErrorBoundary>
  );
}
