"use client";

import { Dialog } from "radix-ui";
import { useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { useSmart } from "@/store/smart";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { SMART_DEFS } from "@/smart/defs";
import { selectionToTemplate } from "@/smart/fromSelection";
import type { El } from "@/smart/reconcile";
import { parseTemplateDef } from "@/smart/template";

interface Part {
  id: string;
  type: string;
  text?: string;
}

const camel = (s: string) => {
  const w = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return w.length
    ? w
        .map((x, i) => (i ? x[0]!.toUpperCase() + x.slice(1) : x))
        .join("")
        .replace(/^[0-9]+/, "") || "label"
    : "label";
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function CreateSmartDialog() {
  const open = useUi((s) => s.smartDialog?.mode === "create");
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && useUi.getState().setSmartDialog(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(94vw,38rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-5 shadow-xl"
          aria-describedby="create-smart-desc"
        >
          {open && <Body />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function selectionParts(): { parts: Part[]; elements: El[] } {
  const api = getEditorApi();
  if (!api) return { parts: [], elements: [] };
  const ids = api.getAppState().selectedElementIds;
  const all = api.getSceneElements();
  const chosen = new Set(Object.keys(ids).filter((k) => ids[k]));
  // Selecting a group selects its members; bound text follows its container.
  for (const e of all)
    if (e.type === "text" && e.containerId && chosen.has(e.containerId)) chosen.add(e.id);
  const elements = all.filter((e) => chosen.has(e.id)) as unknown as El[];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const parts: Part[] = elements
    .filter((e) => !(e.type === "text" && e.containerId && byId.has(e.containerId)))
    .map((e) => {
      const bt = elements.find((t) => t.type === "text" && t.containerId === e.id);
      return {
        id: e.id,
        type: e.type,
        text: (bt?.text ?? (e.type === "text" ? e.text : undefined)) as string | undefined,
      };
    });
  return { parts, elements };
}

function Body() {
  const saveDef = useSmart((s) => s.saveDef);
  const [{ parts, elements }] = useState(selectionParts);
  const [name, setName] = useState("My component");
  const [id, setId] = useState("my-component");
  const [idTouched, setIdTouched] = useState(false);
  const [params, setParams] = useState<Record<string, { on: boolean; key: string; label: string }>>(
    () =>
      Object.fromEntries(
        parts
          .filter((p) => p.text !== undefined)
          .map((p) => [p.id, { on: false, key: camel(p.text!), label: p.text!.slice(0, 30) }]),
      ),
  );
  const [repeatId, setRepeatId] = useState<string>("");
  const [rep, setRep] = useState({
    key: "count",
    label: "Count",
    max: 10,
    direction: "right" as "right" | "down",
    gap: 24,
  });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      const api = getEditorApi()!;
      const files: Record<string, string> = {};
      for (const e of elements) {
        const fid = (e as unknown as { fileId?: string }).fileId;
        const f = fid ? api.getFiles()[fid] : undefined;
        if (f?.mimeType === "image/svg+xml") {
          const b64 = f.dataURL.split(",")[1] ?? "";
          files[fid!] = new TextDecoder().decode(
            Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
          );
        }
      }
      const textParams = Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v.on)
          .map(([k, v]) => [k, { key: v.key, label: v.label }]),
      );
      const keys = Object.values(textParams).map((t) => t.key);
      if (new Set(keys).size !== keys.length) throw new Error("Parameter keys must be unique.");
      if (repeatId && keys.includes(rep.key))
        throw new Error(`"${rep.key}" is already used by a label parameter.`);
      const { def, warnings } = selectionToTemplate(elements, {
        id,
        name,
        textParams,
        repeat: repeatId
          ? {
              elementId: repeatId,
              key: rep.key,
              label: rep.label,
              max: rep.max,
              direction: rep.direction,
              gap: rep.gap,
            }
          : undefined,
        files,
      });
      if (SMART_DEFS.some((d) => d.id === def.id))
        throw new Error(`"${def.id}" is a built-in component id. Choose another.`);
      const parsed = parseTemplateDef(def);
      if (!parsed.ok) throw new Error(parsed.errors[0]);
      await saveDef(parsed.def);
      useToasts.getState().push({
        message: `Saved “${name}”. Find it under Smart → Your components.${warnings.length ? ` ${warnings[0]}` : ""}`,
      });
      useUi.getState().setSmartDialog(null);
      useUi.getState().setComponentsOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the component");
    }
  }

  return (
    <>
      <Dialog.Title className="text-lg font-semibold">
        Create Smart Component from selection
      </Dialog.Title>
      <Dialog.Description id="create-smart-desc" className="text-muted mt-1 text-sm">
        Choose which labels become properties and, optionally, one part that can repeat. No code
        needed.
      </Dialog.Description>
      {parts.length === 0 ? (
        <p role="alert" className="mt-4 text-sm">
          Select the shapes you want to turn into a component, then reopen this dialog.
        </p>
      ) : (
        <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              Name
              <input
                className="border-border bg-bg mt-1 w-full rounded-md border px-2 py-1"
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!idTouched) setId(slug(e.target.value) || "component");
                }}
              />
            </label>
            <label className="text-sm">
              Id
              <input
                className="border-border bg-bg mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setIdTouched(true);
                }}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-muted mb-1 text-xs font-semibold uppercase">
              Parts ({parts.length})
            </legend>
            <ul className="space-y-2">
              {parts.map((p, i) => (
                <li
                  key={p.id}
                  className="border-border rounded-lg border p-2 text-sm"
                  data-testid="create-part"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-muted text-xs">{p.type}</span>{" "}
                      {p.text ? `“${p.text}”` : `#${i + 1}`}
                    </span>
                    {p.type !== "arrow" && p.type !== "line" && (
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="radio"
                          name="repeat"
                          checked={repeatId === p.id}
                          onChange={() => setRepeatId(p.id)}
                          aria-label={`Repeat ${p.text ?? p.type}`}
                        />
                        Repeat
                      </label>
                    )}
                  </div>
                  {p.text !== undefined && (
                    <div className="mt-1 flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={params[p.id]?.on ?? false}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              [p.id]: { ...params[p.id]!, on: e.target.checked },
                            })
                          }
                          aria-label={`Make “${p.text}” a property`}
                        />
                        Make label a property
                      </label>
                      {params[p.id]?.on && (
                        <>
                          <input
                            aria-label="Property key"
                            className="border-border bg-bg w-28 rounded border px-1 font-mono text-xs"
                            value={params[p.id]!.key}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [p.id]: { ...params[p.id]!, key: e.target.value },
                              })
                            }
                          />
                          <input
                            aria-label="Property label"
                            className="border-border bg-bg min-w-0 flex-1 rounded border px-1 text-xs"
                            value={params[p.id]!.label}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [p.id]: { ...params[p.id]!, label: e.target.value },
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {repeatId && (
              <div className="border-border mt-2 grid grid-cols-4 gap-2 rounded-lg border p-2 text-xs">
                <label>
                  Key
                  <input
                    className="border-border bg-bg mt-1 w-full rounded border px-1 font-mono"
                    value={rep.key}
                    onChange={(e) => setRep({ ...rep, key: e.target.value })}
                  />
                </label>
                <label>
                  Label
                  <input
                    className="border-border bg-bg mt-1 w-full rounded border px-1"
                    value={rep.label}
                    onChange={(e) => setRep({ ...rep, label: e.target.value })}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="border-border bg-bg mt-1 w-full rounded border px-1"
                    value={rep.max}
                    onChange={(e) => setRep({ ...rep, max: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Direction
                  <select
                    className="border-border bg-bg mt-1 w-full rounded border"
                    value={rep.direction}
                    onChange={(e) =>
                      setRep({ ...rep, direction: e.target.value as "right" | "down" })
                    }
                  >
                    <option value="right">Right</option>
                    <option value="down">Down</option>
                  </select>
                </label>
              </div>
            )}
          </fieldset>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="border-border rounded-md border px-3 py-1.5 text-sm"
          onClick={() => useUi.getState().setSmartDialog(null)}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={parts.length === 0}
          className="bg-accent text-accent-fg rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          onClick={() => void save()}
        >
          Save component
        </button>
      </div>
    </>
  );
}
