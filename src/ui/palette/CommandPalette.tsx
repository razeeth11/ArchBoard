"use client";

import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { LAYOUTS } from "@/layout/elk";
import { applyLayout } from "@/layout/apply";
import { BLOCKS } from "@/library/blocks";
import { KIT_ITEMS } from "@/library/kits";
import { rank } from "@/palette/fuzzy";
import { usePresent } from "@/present/slides";
import { SMART_DEFS } from "@/smart/defs";
import { usePrefs } from "@/store/prefs";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { insertPayload } from "@/ui/library/ComponentsPanel";

interface Cmd {
  id: string;
  group: "Command" | "Scene" | "Block" | "Kit" | "Smart component";
  label: string;
  run: () => void;
}

function useCommands(): Cmd[] {
  const scenes = useWorkspace((s) => s.scenes);
  return useMemo(() => {
    const ui = () => useUi.getState();
    const dlg = (d: Parameters<ReturnType<typeof useUi.getState>["setDialog"]>[0]) => () =>
      ui().setDialog(d);
    const cmds: Cmd[] = [
      { id: "export", group: "Command", label: "Export…", run: () => ui().setExportOpen(true) },
      { id: "history", group: "Command", label: "Version history", run: dlg("history") },
      { id: "slides", group: "Command", label: "Slides and notes", run: dlg("slides") },
      {
        id: "present",
        group: "Command",
        label: "Start presentation",
        run: () => usePresent.getState().start(0),
      },
      {
        id: "comments",
        group: "Command",
        label: "Toggle comments panel",
        run: () => ui().setCommentsOpen(!ui().commentsOpen),
      },
      { id: "dsl", group: "Command", label: "Diagram from text (DSL)", run: dlg("dsl") },
      {
        id: "design",
        group: "Command",
        label: "Toggle design panel (position and size)",
        run: () => ui().setDesignOpen(!ui().designOpen),
      },
      { id: "ai", group: "Command", label: "Draw with AI (your own API key)", run: dlg("ai") },
      { id: "mermaid", group: "Command", label: "Mermaid import / export", run: dlg("mermaid") },
      { id: "share", group: "Command", label: "Share via link", run: dlg("share") },
      { id: "styles", group: "Command", label: "Style presets", run: dlg("styles") },
      {
        id: "components",
        group: "Command",
        label: "Toggle components panel",
        run: () => ui().setComponentsOpen(!ui().componentsOpen),
      },
      {
        id: "scenes",
        group: "Command",
        label: "Toggle scenes panel",
        run: () => useWorkspace.getState().setPanelOpen(!useWorkspace.getState().panelOpen),
      },
      {
        id: "newscene",
        group: "Command",
        label: "New scene",
        run: () => void useWorkspace.getState().newScene(),
      },
      {
        id: "addpage",
        group: "Command",
        label: "Add page",
        run: () => void useWorkspace.getState().addPage(),
      },
      {
        id: "theme",
        group: "Command",
        label: "Cycle theme",
        run: () => {
          const p = usePrefs.getState();
          p.setTheme(p.theme === "system" ? "light" : p.theme === "light" ? "dark" : "system");
          location.reload();
        },
      },
      ...LAYOUTS.map((l) => ({
        id: `layout-${l.kind}`,
        group: "Command" as const,
        label: `Auto-layout: ${l.label}`,
        run: () => {
          const api = getEditorApi();
          if (api) void applyLayout(api, l.kind);
        },
      })),
      ...scenes.map((s) => ({
        id: `scene-${s.id}`,
        group: "Scene" as const,
        label: s.title,
        run: () => void useWorkspace.getState().openScene(s.id),
      })),
      ...BLOCKS.map((b) => ({
        id: `block-${b.id}`,
        group: "Block" as const,
        label: `${b.name} (${b.category})`,
        run: () => void insertPayload({ type: "block", id: b.id }),
      })),
      ...KIT_ITEMS.map((k) => ({
        id: `kit-${k.id}`,
        group: "Kit" as const,
        label: k.name,
        run: () => void insertPayload({ type: "kit", id: k.id }),
      })),
      ...SMART_DEFS.map((d) => ({
        id: `smart-${d.id}`,
        group: "Smart component" as const,
        label: d.name,
        run: () => void insertPayload({ type: "smart", id: d.id }),
      })),
    ];
    return cmds;
  }, [scenes]);
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const cmds = useCommands();

  // Capture phase: Excalidraw binds Ctrl/Cmd+K to "edit link", the palette wins while it is not typing text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => useUi.getState().setPaletteOpen(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby="palette-desc"
          className="bg-bg text-fg border-border fixed top-[15vh] left-1/2 z-50 w-[min(94vw,36rem)] -translate-x-1/2 rounded-xl border p-3 shadow-xl"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description id="palette-desc" className="sr-only">
            Type to search commands, scenes, building blocks, kits and smart components.
          </Dialog.Description>
          {open && <Body cmds={cmds} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ cmds }: { cmds: Cmd[] }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const list = useMemo(() => rank(cmds, q, (c) => c.label), [cmds, q]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const run = (c?: Cmd) => {
    if (!c) return;
    useUi.getState().setPaletteOpen(false);
    // Let the palette close (and focus return) before the command opens its own UI.
    setTimeout(c.run, 0);
  };
  return (
    <>
      <input
        ref={ref}
        role="combobox"
        aria-expanded
        aria-controls="palette-list"
        aria-activedescendant={list[i] ? `pal-${list[i]!.id}` : undefined}
        data-testid="palette-input"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setI(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setI((n) => Math.min(list.length - 1, n + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setI((n) => Math.max(0, n - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(list[i]);
          }
        }}
        placeholder="Type a command, scene, block…"
        className="border-border bg-surface h-10 w-full rounded-lg border px-3"
      />
      <ul
        id="palette-list"
        role="listbox"
        aria-label="Results"
        className="mt-2 max-h-80 overflow-auto"
      >
        {list.length === 0 && <li className="text-muted p-2 text-sm">No matches</li>}
        {list.map((c, n) => (
          <li
            key={c.id}
            id={`pal-${c.id}`}
            role="option"
            aria-selected={n === i}
            data-testid="palette-item"
            onMouseEnter={() => setI(n)}
            onClick={() => run(c)}
            className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm ${n === i ? "bg-surface ring-accent ring-1" : ""}`}
          >
            <span>{c.label}</span>
            <span className="text-muted text-xs">{c.group}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
