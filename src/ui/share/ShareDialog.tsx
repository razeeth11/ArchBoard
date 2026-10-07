"use client";

import { useEffect, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { encodeShare, type EncodedShare, type ShareMode } from "@/share/link";
import { buildPayload } from "@/share/payload";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { Modal, btn, btnPrimary } from "@/ui/common/Modal";

export function ShareDialog() {
  return (
    <Modal
      kind="share"
      title="Share via link"
      description="The diagram is compressed and encrypted into the link itself. Nothing is uploaded; whoever has the full link can open it."
    >
      <Body />
    </Modal>
  );
}

function Body() {
  const title = useWorkspace((s) => s.active?.scene.title ?? "Diagram");
  const [mode, setMode] = useState<ShareMode>("view");
  const [images, setImages] = useState(true);
  const [enc, setEnc] = useState<EncodedShare | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const api = getEditorApi();
    if (!api) return;
    const p = buildPayload(
      title,
      api.getSceneElements(),
      api.getFiles(),
      api.getAppState().viewBackgroundColor,
      images,
    );
    if (p.elements.length === 0) {
      queueMicrotask(() => alive && setErr("The canvas is empty: draw something first."));
      return;
    }
    encodeShare(p, mode)
      .then((e) => {
        if (!alive) return;
        setEnc(e);
        setErr(null);
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Could not create a link"));
    return () => {
      alive = false;
    };
  }, [mode, images, title]);

  const url = enc && !enc.tooLarge ? `${location.origin}/app${enc.fragment}` : "";

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <fieldset className="flex gap-4">
        <legend className="sr-only">Link type</legend>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "view"} onChange={() => setMode("view")} />
          View only
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "edit"} onChange={() => setMode("edit")} />
          Editable copy
        </label>
      </fieldset>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
        Include images (makes the link much longer)
      </label>
      {err && (
        <p role="alert" className="text-red-600">
          {err}
        </p>
      )}
      {enc?.tooLarge && (
        <div
          role="alert"
          data-testid="share-too-large"
          className="rounded-lg border border-amber-500 p-3"
        >
          This diagram is too large for a link ({enc.length.toLocaleString()} characters; the limit
          is 32,000). Turn off images, or export a file instead.
          <div className="mt-2">
            <button
              className={btn}
              onClick={() => {
                useUi.getState().setDialog(null);
                useUi.getState().setExportOpen(true);
              }}
            >
              Open export
            </button>
          </div>
        </div>
      )}
      {enc && !enc.tooLarge && (
        <>
          {enc.warn && (
            <p data-testid="share-warn" className="text-amber-600">
              Long link ({enc.length.toLocaleString()} characters). Some chat apps may truncate it.
            </p>
          )}
          <textarea
            readOnly
            aria-label="Share link"
            data-testid="share-url"
            value={url}
            className="border-border bg-surface h-24 rounded-lg border p-2 font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <button className={btn} onClick={() => useUi.getState().setDialog(null)}>
              Close
            </button>
            <button
              className={btnPrimary}
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => useToasts.getState().push({ message: "Link copied" }))
                  .catch(() =>
                    useToasts
                      .getState()
                      .push({ message: "Copy failed: select the link and copy it" }),
                  )
              }
            >
              Copy link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
