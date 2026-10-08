"use client";

import { Download, FilePlus2, Pencil, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { DRAG_MIME } from "@/library/insert";
import { downloadText } from "@/store/workspace";
import { useSmart } from "@/store/smart";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { SMART_DEFS } from "@/smart/defs";
import { insertSmart } from "@/smart/instance";
import { parseTemplateDef, templateToSmartDef } from "@/smart/template";
import type { SmartDef } from "@/smart/types";

export async function insertSmartById(id: string, at?: { x: number; y: number }) {
  const api = getEditorApi();
  if (!api) return;
  const def: SmartDef | undefined =
    SMART_DEFS.find((d) => d.id === id) ??
    (useSmart.getState().customDefs[id]
      ? templateToSmartDef(useSmart.getState().customDefs[id]!)
      : undefined);
  if (!def) return;
  try {
    await insertSmart(api, def, {}, at);
  } catch (e) {
    useToasts
      .getState()
      .push({ message: e instanceof Error ? e.message : "Could not insert that component" });
  }
}

function Row({ def, custom }: { def: SmartDef; custom?: boolean }) {
  const setDialog = useUi((s) => s.setSmartDialog);
  const remove = useSmart((s) => s.removeDef);
  return (
    <div className="border-border flex min-w-0 items-center gap-1 rounded-lg border">
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: "smart", id: def.id }));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => void insertSmartById(def.id)}
        data-testid="smart-item"
        data-smart-id={def.id}
        title={def.description}
        className="hover:bg-surface flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 text-left"
      >
        <span className="bg-accent/10 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
          <Wand2 size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{def.name}</span>
          <span className="text-muted line-clamp-2 block text-xs">{def.description}</span>
        </span>
      </button>
      {custom && (
        <>
          <button
            type="button"
            aria-label={`Edit ${def.name} as JSON`}
            className="rounded p-1.5"
            onClick={() => setDialog({ mode: "json", id: def.id })}
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Export ${def.name}`}
            className="rounded p-1.5"
            onClick={() =>
              downloadText(JSON.stringify(def.custom, null, 2), `${def.id}.archboard-smart.json`)
            }
          >
            <Download size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${def.name}`}
            className="rounded p-1.5"
            onClick={() => void remove(def.id)}
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

export function SmartTab({ q }: { q: string }) {
  const load = useSmart((s) => s.load);
  const loaded = useSmart((s) => s.loaded);
  const custom = useSmart((s) => s.customDefs);
  const saveDef = useSmart((s) => s.saveDef);
  const setDialog = useUi((s) => s.setSmartDialog);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (d: SmartDef) =>
    words.every((w) =>
      `${d.name} ${d.category} ${d.description} ${d.keywords.join(" ")}`.toLowerCase().includes(w),
    );
  const builtins = useMemo(() => SMART_DEFS.filter(match), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = Array.from(new Set(builtins.map((d) => d.category)));
  const customList = Object.values(custom).map(templateToSmartDef).filter(match);

  return (
    <div className="space-y-4">
      <p className="text-muted text-xs">
        Parametric components: select one on the canvas to change its properties and the diagram
        redraws in place. Your colour and label edits are kept.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <button
          type="button"
          className="border-border flex items-center gap-2 rounded-lg border border-dashed p-2 text-sm"
          onClick={() => setDialog({ mode: "create" })}
        >
          <Plus size={16} aria-hidden /> Create from selection…
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="border-border flex flex-1 items-center justify-center gap-1 rounded-lg border p-1.5 text-xs"
            onClick={() => setDialog({ mode: "json" })}
          >
            <FilePlus2 size={14} aria-hidden /> New from JSON
          </button>
          <button
            type="button"
            className="border-border flex flex-1 items-center justify-center gap-1 rounded-lg border p-1.5 text-xs"
            onClick={() => file.current?.click()}
          >
            <Upload size={14} aria-hidden /> Import
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="smart-import-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const parsed = parseTemplateDef(JSON.parse(await f.text()));
                if (!parsed.ok) throw new Error(parsed.errors[0]);
                await saveDef(parsed.def);
                useToasts.getState().push({ message: `Imported “${parsed.def.name}”` });
              } catch (err) {
                useToasts.getState().push({
                  message: `Could not import: ${err instanceof Error ? err.message : "invalid file"}`,
                });
              }
            }}
          />
        </div>
      </div>

      {customList.length > 0 && (
        <section>
          <h3 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Your components
          </h3>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {customList.map((d) => (
              <Row key={d.id} def={d} custom />
            ))}
          </div>
        </section>
      )}
      {cats.map((c) => (
        <section key={c}>
          <h3 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">{c}</h3>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {builtins
              .filter((d) => d.category === c)
              .map((d) => (
                <Row key={d.id} def={d} />
              ))}
          </div>
        </section>
      ))}
      {builtins.length === 0 && customList.length === 0 && (
        <p className="text-muted text-sm">No components match “{q}”.</p>
      )}
    </div>
  );
}
