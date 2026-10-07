"use client";

import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { isAbort, type Progress } from "@/export/abort";
import {
  DEFAULT_EXPORT_OPTIONS,
  listFrames,
  rasterLimitError,
  sanitizeOptions,
  type ExportOptions,
} from "@/export/options";
import type { SceneSnapshot } from "@/export/render";
import { getSetting, setSetting } from "@/persistence/repo";
import { downloadBlob } from "@/lib/download";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const SETTING_KEY = "exportOptions";

function snapshot(title: string): SceneSnapshot | null {
  const api = getEditorApi();
  if (!api) return null;
  const s = api.getAppState();
  return {
    elements: api.getSceneElementsIncludingDeleted(),
    appState: {
      selectedElementIds: s.selectedElementIds,
      viewBackgroundColor: s.viewBackgroundColor,
    },
    files: api.getFiles(),
    sceneTitle: title,
  };
}

const field = "border-border bg-bg rounded-md border px-2 py-1 text-sm";
const legend = "text-muted mb-1 text-xs font-semibold uppercase tracking-wide";
const ghostBtn = "border-border flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm";

function Radio<T extends string | number>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <label
          key={String(o.value)}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${
            value === o.value ? "bg-accent text-accent-fg border-accent" : "border-border"
          } has-[:focus-visible]:outline-2`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

type PdfPatch = Partial<ExportOptions["pdf"]>;

export function ExportDialog() {
  const open = useUi((s) => s.exportOpen);
  const setOpen = useUi((s) => s.setExportOpen);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[min(96vw,60rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border shadow-xl"
          aria-describedby="export-desc"
        >
          {/* Mounted fresh on every open, so state never leaks between sessions. */}
          <ExportBody />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExportBody() {
  const sceneTitle = useWorkspace((s) => s.active?.scene.title ?? "ArchBoard");
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [loaded, setLoaded] = useState(false);
  const [snap] = useState<SceneSnapshot | null>(() => snapshot(sceneTitle));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sizeInfo, setSizeInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore last-used settings; abort any running export on close.
  useEffect(() => {
    let alive = true;
    void getSetting<unknown>(SETTING_KEY, null).then((raw) => {
      if (!alive) return;
      setOpts(sanitizeOptions(raw));
      setLoaded(true);
    });
    const ctrl = abortRef;
    return () => {
      alive = false;
      ctrl.current?.abort();
    };
  }, []);

  const update = useCallback((patch: Partial<Omit<ExportOptions, "pdf">> & { pdf?: PdfPatch }) => {
    setOpts((o) => {
      const next = sanitizeOptions({ ...o, ...patch, pdf: { ...o.pdf, ...(patch.pdf ?? {}) } });
      void setSetting(SETTING_KEY, next);
      return next;
    });
  }, []);

  // Live preview (debounced, cancellable).
  useEffect(() => {
    if (!loaded || !snap) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const { renderPreview, estimateRasterSize } = await import("@/export/render");
        const size = await estimateRasterSize(snap, opts);
        setSizeInfo(
          size && opts.format === "png"
            ? (rasterLimitError(size.width, size.height) ?? `${size.width} × ${size.height} px`)
            : null,
        );
        const p = await renderPreview(snap, opts, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return URL.revokeObjectURL(p.url);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return p.url;
        });
        setPreviewError(null);
      } catch (e) {
        if (isAbort(e) || ctrl.signal.aborted) return;
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return null;
        });
        setPreviewError(e instanceof Error ? e.message : "Preview failed");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [loaded, snap, opts]);

  // Revoke the preview URL on unmount (memory hygiene).
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function run<T>(
    work: (signal: AbortSignal, onProgress: (p: Progress) => void) => Promise<T>,
  ) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setNotice(null);
    setBusy({ stage: "Starting", value: 0 });
    try {
      return await work(ctrl.signal, setBusy);
    } catch (e) {
      if (isAbort(e)) setNotice("Export cancelled.");
      else setError(e instanceof Error ? e.message : "Export failed");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    const fresh = snapshot(sceneTitle) ?? snap;
    if (!fresh) return;
    const { renderExport } = await import("@/export/render");
    const res = await run((signal, onProgress) =>
      renderExport(fresh, opts, { signal, onProgress }),
    );
    if (res) {
      downloadBlob(res.blob, res.filename);
      setNotice(
        `Saved ${res.filename}${res.pages ? ` (${res.pages} page${res.pages === 1 ? "" : "s"})` : ""}.`,
      );
    }
  }

  async function copy(as: "png" | "svg") {
    const fresh = snapshot(sceneTitle) ?? snap;
    if (!fresh) return;
    const { copyExport } = await import("@/export/render");
    const ok = await run(async (signal, onProgress) => {
      await copyExport(fresh, opts, as, { signal, onProgress });
      return true;
    });
    if (ok) setNotice(`Copied ${as.toUpperCase()} to the clipboard.`);
  }

  const frames = snap ? listFrames(snap.elements) : [];
  const isRaster = opts.format === "png";
  const canEmbed = opts.format === "png" || opts.format === "svg";

  return (
    <>
      <div className="border-border flex items-center justify-between border-b px-5 py-3">
        <div>
          <Dialog.Title className="text-lg font-semibold">Export</Dialog.Title>
          <Dialog.Description id="export-desc" className="text-muted text-xs">
            Everything is generated on your device. Nothing is uploaded.
          </Dialog.Description>
        </div>
        <Dialog.Close aria-label="Close export dialog" className="rounded p-1">
          <X size={18} aria-hidden />
        </Dialog.Close>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[22rem_1fr]">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend className={legend}>Format</legend>
            <Radio
              name="Format"
              value={opts.format}
              onChange={(format) => update({ format })}
              options={[
                { value: "png", label: "PNG" },
                { value: "svg", label: "SVG" },
                { value: "pdf", label: "PDF" },
                { value: "json", label: "JSON" },
              ]}
            />
          </fieldset>

          <fieldset>
            <legend className={legend}>What to export</legend>
            <Radio
              name="Scope"
              value={opts.scope}
              onChange={(scope) =>
                update({
                  scope,
                  frameId:
                    scope === "frame" ? (opts.frameId ?? frames[0]?.id ?? null) : opts.frameId,
                })
              }
              options={[
                { value: "scene", label: "Whole canvas" },
                { value: "selection", label: "Selection" },
                ...(frames.length ? [{ value: "frame" as const, label: "Frame" }] : []),
              ]}
            />
            {opts.scope === "frame" && frames.length > 0 && (
              <label className="mt-2 block text-sm">
                <span className="sr-only">Frame</span>
                <select
                  className={`${field} w-full`}
                  value={opts.frameId ?? ""}
                  onChange={(e) => update({ frameId: e.target.value })}
                >
                  {frames.map((f, i) => (
                    <option key={f.id} value={f.id}>
                      {("name" in f && f.name) || `Frame ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          {isRaster && (
            <fieldset>
              <legend className={legend}>Scale</legend>
              <Radio
                name="Scale"
                value={opts.scale}
                onChange={(scale) => update({ scale })}
                options={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: `${n}×` }))}
              />
              {sizeInfo && (
                <p className="text-muted mt-1 text-xs" role="status" data-testid="size-info">
                  {sizeInfo}
                </p>
              )}
            </fieldset>
          )}

          {opts.format !== "json" && (
            <>
              <fieldset>
                <legend className={legend}>Background</legend>
                <Radio
                  name="Background"
                  value={opts.background}
                  onChange={(background) => update({ background })}
                  options={[
                    { value: "solid", label: "Solid" },
                    { value: "transparent", label: "Transparent" },
                  ]}
                />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={opts.dark}
                    onChange={(e) => update({ dark: e.target.checked })}
                  />
                  Dark mode
                </label>
              </fieldset>

              <label className="block text-sm">
                <span className={legend}>Padding: {opts.padding}px</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={4}
                  value={opts.padding}
                  onChange={(e) => update({ padding: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            </>
          )}

          {canEmbed && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={opts.embedScene}
                onChange={(e) => update({ embedScene: e.target.checked })}
              />
              <span>
                Embed scene data
                <span className="text-muted block text-xs">
                  So this file can be re-imported and edited.
                </span>
              </span>
            </label>
          )}

          {opts.format === "svg" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={opts.svgTextAsPaths}
                onChange={(e) => update({ svgTextAsPaths: e.target.checked })}
              />
              <span>
                Convert text to outlines
                <span className="text-muted block text-xs">
                  Fonts can never break, but text is no longer selectable.
                </span>
              </span>
            </label>
          )}

          {opts.format === "pdf" && (
            <fieldset className="space-y-2">
              <legend className={legend}>PDF page</legend>
              <label className="block text-sm">
                Page size
                <select
                  className={`${field} mt-1 w-full`}
                  value={opts.pdf.pageSize}
                  onChange={(e) =>
                    update({
                      pdf: { pageSize: e.target.value as ExportOptions["pdf"]["pageSize"] },
                    })
                  }
                >
                  <option value="fit">Fit to content</option>
                  <option value="a4">A4</option>
                  <option value="a3">A3</option>
                  <option value="letter">Letter</option>
                  <option value="custom">Custom…</option>
                </select>
              </label>
              {opts.pdf.pageSize === "custom" && (
                <div className="flex gap-2">
                  <label className="text-sm">
                    Width (mm)
                    <input
                      type="number"
                      className={`${field} w-full`}
                      value={opts.pdf.customWidthMm}
                      min={20}
                      max={5000}
                      onChange={(e) => update({ pdf: { customWidthMm: Number(e.target.value) } })}
                    />
                  </label>
                  <label className="text-sm">
                    Height (mm)
                    <input
                      type="number"
                      className={`${field} w-full`}
                      value={opts.pdf.customHeightMm}
                      min={20}
                      max={5000}
                      onChange={(e) => update({ pdf: { customHeightMm: Number(e.target.value) } })}
                    />
                  </label>
                </div>
              )}
              {opts.pdf.pageSize !== "fit" && (
                <label className="block text-sm">
                  Orientation
                  <select
                    className={`${field} mt-1 w-full`}
                    value={opts.pdf.orientation}
                    onChange={(e) =>
                      update({
                        pdf: {
                          orientation: e.target.value as ExportOptions["pdf"]["orientation"],
                        },
                      })
                    }
                  >
                    <option value="auto">Automatic</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
              )}
              <label className="block text-sm">
                Margin (mm)
                <input
                  type="number"
                  className={`${field} mt-1 w-full`}
                  min={0}
                  max={50}
                  value={opts.pdf.marginMm}
                  onChange={(e) => update({ pdf: { marginMm: Number(e.target.value) } })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={frames.length === 0}
                  checked={opts.pdf.framesAsPages}
                  onChange={(e) => update({ pdf: { framesAsPages: e.target.checked } })}
                />
                One page per frame{frames.length === 0 ? " (no frames in this scene)" : ""}
              </label>
            </fieldset>
          )}

          {opts.format !== "json" && (
            <fieldset className="space-y-2">
              <legend className={legend}>Accessibility</legend>
              <label className="block text-sm">
                Title
                <input
                  className={`${field} mt-1 w-full`}
                  value={opts.title}
                  placeholder={sceneTitle}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Description (alt text)
                <textarea
                  className={`${field} mt-1 w-full`}
                  rows={2}
                  value={opts.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="text-xs underline"
                disabled={!opts.description}
                onClick={() => void navigator.clipboard.writeText(opts.description)}
              >
                Copy alt text
              </button>
            </fieldset>
          )}
        </form>

        <div className="flex min-h-48 flex-col gap-2">
          <div className="text-muted text-xs font-semibold tracking-wide uppercase">Preview</div>
          <div
            className="border-border bg-surface flex min-h-48 flex-1 items-center justify-center overflow-auto rounded-lg border p-2"
            style={{
              backgroundImage:
                opts.background === "transparent"
                  ? "repeating-conic-gradient(#8883 0% 25%, transparent 0% 50%)"
                  : undefined,
              backgroundSize: "16px 16px",
            }}
          >
            {previewError ? (
              <p role="alert" className="text-muted p-4 text-sm">
                {previewError}
              </p>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={opts.description || `Preview of ${opts.title || sceneTitle}`}
                data-testid="export-preview"
                className="max-h-[50dvh] max-w-full object-contain"
              />
            ) : (
              <Loader2 className="animate-spin" aria-label="Rendering preview" />
            )}
          </div>
          {opts.format === "pdf" && (
            <p className="text-muted text-xs">
              The preview shows the first page. The PDF is vector, with selectable text.
            </p>
          )}
        </div>
      </div>

      <div className="border-border space-y-2 border-t px-5 py-3">
        {busy && (
          <div>
            <div className="text-muted mb-1 flex justify-between text-xs">
              <span>{busy.stage}</span>
              <span>{Math.round(busy.value * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(busy.value * 100)}
              className="bg-surface h-1.5 overflow-hidden rounded"
            >
              <div
                className="bg-accent h-full transition-[width]"
                style={{ width: `${busy.value * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-muted flex items-center gap-1 text-sm">
            <Check size={14} aria-hidden /> {notice}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {busy ? (
            <button type="button" className={ghostBtn} onClick={() => abortRef.current?.abort()}>
              Cancel export
            </button>
          ) : (
            <>
              {opts.format === "png" && (
                <button type="button" className={ghostBtn} onClick={() => void copy("png")}>
                  <Copy size={14} aria-hidden /> Copy PNG
                </button>
              )}
              {opts.format === "svg" && (
                <button type="button" className={ghostBtn} onClick={() => void copy("svg")}>
                  <Copy size={14} aria-hidden /> Copy SVG
                </button>
              )}
              <button
                type="button"
                className="bg-accent text-accent-fg flex items-center gap-1 rounded-md px-4 py-1.5 text-sm font-medium"
                onClick={() => void download()}
              >
                <Download size={14} aria-hidden /> Download {opts.format.toUpperCase()}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
