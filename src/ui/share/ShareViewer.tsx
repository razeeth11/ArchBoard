"use client";

import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import { useState } from "react";
import { importExcalidrawFile } from "@/persistence/backup";
import { payloadToExcalidrawJson } from "@/share/payload";
import type { SharePayload } from "@/share/link";
import { resolveTheme, usePrefs } from "@/store/prefs";
import { btnPrimary } from "@/ui/common/Modal";

/** Read-only canvas for a shared link. Nothing is saved unless the viewer asks for a copy. */
export function ShareViewer({
  payload,
  onCopy,
}: {
  payload: SharePayload;
  onCopy: (sceneId: string) => void;
}) {
  const theme = usePrefs((s) => s.theme);
  const [busy, setBusy] = useState(false);
  const files = Object.fromEntries(
    Object.entries(payload.files).map(([id, f]) => [id, { id, ...f }]),
  ) as unknown as Record<string, BinaryFileData>;
  return (
    <div className="h-dvh w-full" data-testid="share-viewer">
      <div className="border-border bg-surface text-fg fixed top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow">
        <span>
          Viewing <strong>{payload.title}</strong> (read-only)
        </span>
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const s = await importExcalidrawFile(payloadToExcalidrawJson(payload), payload.title);
            onCopy(s.id);
          }}
        >
          Save a copy
        </button>
      </div>
      <Excalidraw
        viewModeEnabled
        theme={resolveTheme(theme)}
        initialData={{
          elements: payload.elements as never,
          files,
          appState: { viewBackgroundColor: payload.viewBackgroundColor ?? "#ffffff" },
          scrollToContent: true,
        }}
      />
    </div>
  );
}
