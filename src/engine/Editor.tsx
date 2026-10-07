"use client";

import "@excalidraw/excalidraw/index.css";
import { useEffect } from "react";
import { resolveTheme, usePrefs } from "@/store/prefs";
import { useWorkspace } from "@/store/workspace";
import { SceneCanvas } from "./SceneCanvas";
import { BackupReminder } from "@/ui/workspace/BackupReminder";
import { ConflictDialog, RecoveryDialog } from "@/ui/workspace/dialogs";
import { EditorErrorBoundary } from "@/ui/workspace/ErrorBoundary";
import { ExportDialog } from "@/ui/export/ExportDialog";
import { useUi } from "@/store/ui";
import { ToastHost } from "@/ui/workspace/ToastHost";
import { WorkspacePanel } from "@/ui/workspace/WorkspacePanel";

// Fonts and locales are served from our own origin so the editor works offline and under a strict CSP.
if (typeof window !== "undefined") {
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
    void init();
  }, [init]);

  return (
    <>
      {active ? <SceneCanvas active={active} /> : <div className="bg-surface h-dvh" aria-hidden />}
      <WorkspacePanel />
      <ExportDialog />
      <ConflictDialog />
      <RecoveryDialog />
      <BackupReminder />
      <ToastHost />
    </>
  );
}

export default function Editor() {
  return (
    <EditorErrorBoundary>
      <Workspace />
    </EditorErrorBoundary>
  );
}
