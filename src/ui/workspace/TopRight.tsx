"use client";

import { Download, LayoutGrid, Monitor, Moon, PanelLeft, Sun, Wrench } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { getEditorApi } from "@/engine/apiRef";
import { applyLayout } from "@/layout/apply";
import { LAYOUTS } from "@/layout/elk";
import { t } from "@/i18n/messages";
import { usePresent } from "@/present/slides";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { usePrefs, resolveTheme, type ThemePref } from "@/store/prefs";
import { SaveStatus } from "./SaveStatus";

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

export function WorkspaceTopRight() {
  const open = useWorkspace((s) => s.panelOpen);
  const setOpen = useWorkspace((s) => s.setPanelOpen);
  const componentsOpen = useUi((s) => s.componentsOpen);
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const Icon = ICON[theme];
  return (
    <div className="flex items-center gap-2">
      <SaveStatus />
      <button
        type="button"
        aria-label={t("toolbar.components")}
        aria-expanded={componentsOpen}
        aria-controls="components-panel"
        onClick={() => useUi.getState().setComponentsOpen(!componentsOpen)}
        className="border-border bg-surface text-fg flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <LayoutGrid size={18} aria-hidden /> {t("toolbar.components")}
      </button>
      <ToolsMenu />
      <button
        type="button"
        aria-label={t("toolbar.export")}
        title="Export (Ctrl/Cmd+Shift+E)"
        onClick={() => useUi.getState().setExportOpen(true)}
        className="border-border bg-surface text-fg flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <Download size={18} aria-hidden /> {t("toolbar.export")}
      </button>
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
        aria-label={t("toolbar.scenes")}
        aria-expanded={open}
        aria-controls="workspace-panel"
        onClick={() => setOpen(!open)}
        className="border-border bg-surface text-fg flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <PanelLeft size={18} aria-hidden /> {t("toolbar.scenes")}
      </button>
    </div>
  );
}

const item =
  "hover:bg-surface flex cursor-pointer items-center justify-between gap-6 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface";

function ToolsMenu() {
  const ui = useUi.getState;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("toolbar.tools")}
        className="border-border bg-surface text-fg flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
      >
        <Wrench size={18} aria-hidden /> {t("toolbar.tools")}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="bg-bg text-fg border-border z-50 min-w-60 rounded-lg border p-1 shadow-xl"
        >
          <DropdownMenu.Item className={item} onSelect={() => ui().setPaletteOpen(true)}>
            Command palette <kbd className="text-muted text-xs">Ctrl/⌘ K</kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("history")}>
            Version history
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("slides")}>
            Slides and notes
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => usePresent.getState().start(0)}>
            Present
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={item}
            onSelect={() => ui().setCommentsOpen(!ui().commentsOpen)}
          >
            Comments
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={item}>Auto-layout ›</DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="bg-bg text-fg border-border z-50 min-w-56 rounded-lg border p-1 shadow-xl">
                {LAYOUTS.map((l) => (
                  <DropdownMenu.Item
                    key={l.kind}
                    className={item}
                    title={l.description}
                    onSelect={() => {
                      const api = getEditorApi();
                      if (api) void applyLayout(api, l.kind);
                    }}
                  >
                    {l.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("dsl")}>
            Diagram from text (DSL)
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("ai")}>
            Draw with AI (your key)
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("mermaid")}>
            Mermaid import / export
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("styles")}>
            Style presets
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={item} onSelect={() => ui().setDialog("share")}>
            Share via link
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
