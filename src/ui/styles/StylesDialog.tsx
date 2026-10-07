"use client";

import { useEffect, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { getSetting, setSetting } from "@/persistence/repo";
import {
  BUILTIN_PRESETS,
  DEFAULT_BRAND,
  applyPresetTo,
  isHex,
  presetFromElement,
  sanitizePresets,
  type StylePreset,
} from "@/styles/presets";
import { useToasts } from "@/store/toasts";
import { Modal, btn } from "@/ui/common/Modal";

export function StylesDialog() {
  return (
    <Modal
      kind="styles"
      title="Style presets"
      description="Re-style the selection (or everything) with one click. New shapes pick up the look too."
    >
      <Body />
    </Modal>
  );
}

async function applyToScene(p: StylePreset, scope: "selection" | "all") {
  const api = getEditorApi();
  if (!api) return;
  const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  const sel = api.getAppState().selectedElementIds;
  const useSel = scope === "selection" && Object.keys(sel).length > 0;
  const target = (id: string, containerId?: string | null) =>
    useSel ? sel[id] || (containerId && sel[containerId]) : true;
  api.updateScene({
    elements: api
      .getSceneElementsIncludingDeleted()
      .map((e) =>
        target(e.id, (e as { containerId?: string | null }).containerId) ? applyPresetTo(e, p) : e,
      ),
    appState: {
      currentItemRoughness: p.roughness,
      currentItemStrokeColor: p.strokeColor,
      currentItemBackgroundColor: p.backgroundColor,
      currentItemFillStyle: p.fillStyle,
      currentItemStrokeWidth: p.strokeWidth,
      currentItemFontFamily: p.fontFamily,
      viewBackgroundColor: p.canvas ?? api.getAppState().viewBackgroundColor,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  useToasts.getState().push({ message: `Applied “${p.name}”. Undo with Ctrl/Cmd+Z.` });
}

function Body() {
  const [saved, setSaved] = useState<StylePreset[]>([]);
  const [brand, setBrand] = useState<string[]>(DEFAULT_BRAND);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1971c2");
  const [scope, setScope] = useState<"selection" | "all">("selection");

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getSetting<unknown>("stylePresets", []),
      getSetting<unknown>("brandPalette", DEFAULT_BRAND),
    ]).then(([p, b]) => {
      if (!alive) return;
      setSaved(sanitizePresets(p));
      if (Array.isArray(b))
        setBrand(b.filter((c): c is string => typeof c === "string" && isHex(c)).slice(0, 12));
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = (next: StylePreset[]) => {
    setSaved(next);
    void setSetting("stylePresets", next);
  };
  const persistBrand = (next: string[]) => {
    setBrand(next);
    void setSetting("brandPalette", next);
  };

  function saveFromSelection() {
    const api = getEditorApi();
    if (!api) return;
    const sel = api.getAppState().selectedElementIds;
    const shape = api.getSceneElements().find((e) => sel[e.id] && e.type !== "text");
    if (!shape) return useToasts.getState().push({ message: "Select a shape to copy its style." });
    persist([...saved, presetFromElement(shape, name, api.getAppState().currentItemFontFamily)]);
    setName("");
  }

  async function colorize(c: string, key: "strokeColor" | "backgroundColor") {
    const api = getEditorApi();
    if (!api) return;
    const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
    const sel = api.getAppState().selectedElementIds;
    if (!Object.keys(sel).length)
      return useToasts.getState().push({ message: "Select something first." });
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted().map((e) =>
        sel[e.id] && !(key === "backgroundColor" && e.type === "text")
          ? ({
              ...e,
              [key]: c,
              version: e.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
            } as typeof e)
          : e,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  const Card = ({ p }: { p: StylePreset }) => (
    <li className="border-border flex items-center justify-between rounded-lg border p-2">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-5 w-5 rounded border"
          style={{
            background:
              p.backgroundColor === "transparent" ? (p.canvas ?? "transparent") : p.backgroundColor,
            borderColor: p.strokeColor,
          }}
        />
        {p.name}
      </span>
      <span className="flex gap-1">
        <button className={btn} onClick={() => void applyToScene(p, scope)}>
          Apply
        </button>
        {!p.builtin && (
          <button
            className={btn}
            aria-label={`Delete preset ${p.name}`}
            onClick={() => persist(saved.filter((x) => x.id !== p.id))}
          >
            Delete
          </button>
        )}
      </span>
    </li>
  );

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <fieldset className="flex gap-4">
        <legend className="sr-only">Apply to</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === "selection"}
            onChange={() => setScope("selection")}
          />{" "}
          Selection (or all if none)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />{" "}
          Everything
        </label>
      </fieldset>
      <ul data-testid="preset-list" className="flex flex-col gap-2">
        {[...BUILTIN_PRESETS, ...saved].map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          aria-label="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for the selected shape's style"
          className="border-border bg-surface h-9 flex-1 rounded-lg border px-2"
        />
        <button className={btn} onClick={saveFromSelection}>
          Save preset
        </button>
      </div>
      <section aria-label="Brand palette">
        <h3 className="font-medium">Brand palette</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {brand.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <button
                aria-label={`Use ${c} as stroke`}
                title="Click: stroke · Shift+click: fill · Alt+click: remove"
                className="h-7 w-7 rounded border"
                style={{ background: c }}
                onClick={(e) =>
                  e.altKey
                    ? persistBrand(brand.filter((x) => x !== c))
                    : void colorize(c, e.shiftKey ? "backgroundColor" : "strokeColor")
                }
              />
            </span>
          ))}
          <input
            type="color"
            aria-label="New brand colour"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <button
            className={btn}
            onClick={() =>
              isHex(color) && !brand.includes(color) && persistBrand([...brand, color].slice(0, 12))
            }
          >
            Add colour
          </button>
        </div>
      </section>
    </div>
  );
}
