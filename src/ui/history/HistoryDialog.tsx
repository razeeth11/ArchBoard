"use client";

import { History, RotateCcw, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import {
  deleteSnapshot,
  diffElements,
  listSnapshots,
  loadSnapshot,
  renameSnapshot,
  restoreSnapshot,
  takeSnapshot,
  type DiffSummary,
  type SnapshotMeta,
} from "@/persistence/history";
import * as repo from "@/persistence/repo";
import { timeAgo } from "@/lib/time";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

async function render(
  elements: unknown[],
  fileRefs: Record<string, never>,
  bg?: string,
): Promise<string | null> {
  const live = (elements as { isDeleted?: boolean }[]).filter((e) => !e.isDeleted);
  if (!live.length) return null;
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const files = Object.fromEntries((await repo.loadFiles(fileRefs)).map((f) => [f.id, f]));
  const blob = await exportToBlob({
    elements: live as never,
    files: files as never,
    appState: { exportBackground: true, viewBackgroundColor: bg ?? "#ffffff" },
    maxWidthOrHeight: 420,
    mimeType: "image/png",
  });
  return URL.createObjectURL(blob);
}

export function HistoryDialog() {
  const open = useUi((s) => s.dialog === "history");
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && useUi.getState().setDialog(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(96vw,60rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-5 shadow-xl"
          aria-describedby="history-desc"
        >
          {open && <Body />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body() {
  const active = useWorkspace((s) => s.active)!;
  const sceneId = active.scene.id;
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [rename, setRename] = useState("");
  const [images, setImages] = useState<{ then: string | null; now: string | null }>({
    then: null,
    now: null,
  });
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listSnapshots(sceneId);
    setSnaps(list);
    return list;
  }, [sceneId]);

  useEffect(() => {
    let alive = true;
    void listSnapshots(sceneId).then((list) => {
      if (!alive) return;
      setSnaps(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [sceneId]);

  // Side-by-side preview: the snapshot's version of this page next to the current one.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const made: string[] = [];
    void (async () => {
      const content = await loadSnapshot(selected);
      const page = content.pages.find((p) => p.id === active.page.id) ?? content.pages[0];
      const api = getEditorApi();
      const nowEls = api ? api.getSceneElements() : [];
      const [then, now] = await Promise.all([
        page
          ? render(page.elements, page.fileRefs as never, page.appState.viewBackgroundColor)
          : null,
        render(
          nowEls as never,
          active.page.fileRefs as never,
          api?.getAppState().viewBackgroundColor,
        ),
      ]);
      for (const u of [then, now]) if (u) made.push(u);
      if (!alive) return;
      setImages({ then, now });
      setDiff(page ? diffElements(page.elements, nowEls) : null);
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selected, active.page.id, active.page.fileRefs]);

  const sel = snaps.find((s) => s.id === selected);

  async function checkpoint() {
    setBusy(true);
    await useWorkspace.getState().flushSaves();
    await takeSnapshot(sceneId, { kind: "named", label: label || "Checkpoint" });
    setLabel("");
    const l = await refresh();
    setSelected(l[0]?.id ?? null);
    setBusy(false);
  }

  async function restore() {
    if (!sel) return;
    setBusy(true);
    try {
      await useWorkspace.getState().flushSaves();
      await restoreSnapshot(sceneId, sel.id);
      await useWorkspace.getState().reloadActive();
      useToasts
        .getState()
        .push({ message: "Restored. A “Before restore” copy was saved, so you can undo this." });
      useUi.getState().setDialog(null);
    } catch (e) {
      useToasts.getState().push({ message: e instanceof Error ? e.message : "Could not restore" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
        <History size={18} aria-hidden /> Version history
      </Dialog.Title>
      <Dialog.Description id="history-desc" className="text-muted mt-1 text-sm">
        Snapshots are taken automatically as you work. Restoring first saves a “Before restore”
        copy, so it is always reversible.
      </Dialog.Description>
      <div className="mt-3 grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[18rem_1fr]">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex gap-1">
            <input
              aria-label="Checkpoint name"
              placeholder="Checkpoint name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="border-border bg-bg min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void checkpoint()}
              className="bg-accent text-accent-fg rounded-md px-2 text-sm"
            >
              Save
            </button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Snapshots">
            {snaps.length === 0 && (
              <li className="text-muted text-sm">
                No snapshots yet. Keep drawing, or save a checkpoint.
              </li>
            )}
            {snaps.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  data-testid="snapshot-row"
                  aria-current={s.id === selected}
                  onClick={() => {
                    setSelected(s.id);
                    setRename(s.label ?? "");
                  }}
                  className={`w-full rounded-lg border p-2 text-left text-sm ${s.id === selected ? "border-accent" : "border-border"}`}
                >
                  <span className="block truncate font-medium">
                    {s.label ?? (s.kind === "auto" ? "Automatic snapshot" : s.kind)}
                  </span>
                  <span className="text-muted block text-xs">
                    {timeAgo(s.createdAt)} · {s.elementCount} elements · {s.kind}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {sel ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Snapshot", images.then],
                    ["Current", images.now],
                  ] as const
                ).map(([t, url]) => (
                  <figure key={t} className="border-border bg-surface rounded-lg border p-2">
                    <figcaption className="text-muted mb-1 text-xs font-semibold uppercase">
                      {t}
                    </figcaption>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`${t} version of this page`}
                        className="mx-auto max-h-64 object-contain"
                      />
                    ) : (
                      <p className="text-muted py-10 text-center text-sm">Empty</p>
                    )}
                  </figure>
                ))}
              </div>
              {diff && (
                <p data-testid="snapshot-diff" className="text-sm">
                  Compared with now: <strong>{diff.added}</strong> added,{" "}
                  <strong>{diff.removed}</strong> removed, <strong>{diff.changed}</strong> changed
                  since this snapshot (the snapshot is the older side).
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Rename snapshot"
                  placeholder="Name this snapshot"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  className="border-border bg-bg rounded-md border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  className="border-border rounded-md border px-2 py-1 text-sm"
                  onClick={async () => {
                    await renameSnapshot(sel.id, rename);
                    await refresh();
                  }}
                >
                  Save name
                </button>
                <button
                  type="button"
                  aria-label="Delete snapshot"
                  className="border-border rounded-md border p-1.5"
                  onClick={async () => {
                    await deleteSnapshot(sel.id);
                    const l = await refresh();
                    setSelected(l[0]?.id ?? null);
                  }}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restore()}
                  className="bg-accent text-accent-fg ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium"
                >
                  <RotateCcw size={14} aria-hidden /> Restore this version
                </button>
              </div>
            </>
          ) : (
            <p className="text-muted text-sm">Select a snapshot to preview it.</p>
          )}
        </div>
      </div>
    </>
  );
}
