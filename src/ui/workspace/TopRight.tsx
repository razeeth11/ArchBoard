"use client";

import { Monitor, Moon, PanelLeft, Sun } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { usePrefs, resolveTheme, type ThemePref } from "@/store/prefs";
import { SaveStatus } from "./SaveStatus";

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

export function WorkspaceTopRight() {
  const open = useWorkspace((s) => s.panelOpen);
  const setOpen = useWorkspace((s) => s.setPanelOpen);
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const Icon = ICON[theme];
  return (
    <div className="flex items-center gap-2">
      <SaveStatus />
      <button
        type="button"
        aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
        title={`Theme: ${theme}`}
        onClick={() => {
          setTheme(NEXT[theme]);
          document.documentElement.dataset.theme = resolveTheme(NEXT[theme]);
        }}
        className="border-border bg-surface text-fg flex h-9 w-9 items-center justify-center rounded-lg border"
      >
        <Icon size={18} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Scenes"
        aria-expanded={open}
        aria-controls="workspace-panel"
        onClick={() => setOpen(!open)}
        className="border-border bg-surface text-fg flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <PanelLeft size={18} aria-hidden /> Scenes
      </button>
    </div>
  );
}
