"use client";

import { useEffect, useMemo, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { elementsToMermaid } from "@/dsl/mermaid-export";
import { previewUrl } from "@/lib/preview";
import { insertElements } from "@/library/insert";
import type { El } from "@/smart/reconcile";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { Modal, btn, btnPrimary } from "@/ui/common/Modal";

const SAMPLE = `flowchart TD
  A[Client] --> B{Cache hit?}
  B -- yes --> C[Return]
  B -- no --> D[(Database)]
  D --> C`;

interface Parsed {
  elements: never[];
  files: Record<string, never>;
}

export function MermaidDialog() {
  return (
    <Modal
      kind="mermaid"
      wide
      title="Mermaid"
      description="Import Mermaid text as editable shapes, or export the selected flowchart as Mermaid."
    >
      <Body />
    </Modal>
  );
}

function Body() {
  const [tab, setTab] = useState<"import" | "export">("import");
  const [src, setSrc] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);

  useEffect(() => {
    if (tab !== "import") return;
    let alive = true;
    let url: string | null = null;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] = await Promise.all([
          import("@excalidraw/mermaid-to-excalidraw"),
          import("@excalidraw/excalidraw"),
        ]);
        const r = await parseMermaidToExcalidraw(src, { themeVariables: { fontSize: "16px" } });
        const els = convertToExcalidrawElements(r.elements, { regenerateIds: true });
        if (!alive) return;
        url = await previewUrl(els, r.files as never);
        if (!alive) return;
        setParsed({ elements: els as never, files: (r.files ?? {}) as never });
        setPreview(url);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setParsed(null);
        setPreview(null);
        setError(e instanceof Error ? e.message : "Could not parse this Mermaid text");
      } finally {
        if (alive) setBusy(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, tab]);

  // Computed when the tab opens: it reads the live canvas, which is not React state.
  const out = useMemo(() => {
    const api = tab === "export" ? getEditorApi() : null;
    if (!api) return { text: "", nodes: 0, edges: 0 };
    const sel = api.getAppState().selectedElementIds;
    const all = api.getSceneElements();
    const picked = all.filter((e) => (Object.keys(sel).length ? sel[e.id] : true));
    const ids = new Set(picked.map((e) => e.id));
    const withLabels = all.filter(
      (e) => ids.has(e.id) || (e.type === "text" && e.containerId && ids.has(e.containerId)),
    );
    return elementsToMermaid(withLabels as unknown as El[]);
  }, [tab]);

  async function insert() {
    const api = getEditorApi();
    if (!api || !parsed) return;
    try {
      await insertElements(
        api,
        parsed.elements,
        [],
        { kind: "kit", id: "mermaid" },
        {},
        Object.values(parsed.files),
      );
      useUi.getState().setDialog(null);
    } catch (e) {
      useToasts.getState().push({ message: e instanceof Error ? e.message : "Could not insert" });
    }
  }

  return (
    <>
      <div role="tablist" className="mt-3 flex gap-2">
        {(["import", "export"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`${btn} ${tab === t ? "ring-accent ring-2" : ""}`}
          >
            {t === "import" ? "Import Mermaid" : "Export as Mermaid"}
          </button>
        ))}
      </div>
      {tab === "import" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Mermaid text
            <textarea
              data-testid="mermaid-source"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              spellCheck={false}
              className="border-border bg-surface min-h-64 rounded-lg border p-2 font-mono text-sm"
            />
          </label>
          <div className="border-border bg-surface flex min-h-64 items-center justify-center rounded-lg border p-2">
            {error ? (
              <p role="alert" data-testid="mermaid-error" className="text-sm text-red-600">
                {error}
              </p>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-testid="mermaid-preview"
                src={preview}
                alt="Mermaid preview"
                className="max-h-72"
              />
            ) : (
              <span className="text-muted text-sm">
                {busy ? "Rendering…" : "Nothing to preview"}
              </span>
            )}
          </div>
          <p className="text-muted text-xs md:col-span-2">
            Flowcharts, sequence and class diagrams become editable shapes; other diagram types
            arrive as an image. Mermaid runs locally in a strict security mode.
          </p>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button className={btn} onClick={() => useUi.getState().setDialog(null)}>
              Cancel
            </button>
            <button
              className={btnPrimary}
              disabled={!parsed || !!error}
              onClick={() => void insert()}
            >
              Insert diagram
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-muted text-xs">
            Exports the selection (or the whole page): rectangles, ellipses and diamonds joined by
            bound arrows. {out.nodes} nodes, {out.edges} edges.
          </p>
          <textarea
            readOnly
            data-testid="mermaid-out"
            value={out.text}
            aria-label="Mermaid output"
            className="border-border bg-surface min-h-56 rounded-lg border p-2 font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              className={btnPrimary}
              disabled={!out.nodes}
              onClick={() =>
                void navigator.clipboard
                  .writeText(out.text)
                  .then(() => useToasts.getState().push({ message: "Mermaid copied" }))
              }
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
