"use client";

import { Dialog } from "radix-ui";
import { downloadText, useWorkspace } from "@/store/workspace";
import { getDb } from "@/persistence/db";

function Modal({
  open,
  title,
  description,
  children,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-muted mt-1 text-sm">{description}</Dialog.Description>
          <div className="mt-4 flex flex-wrap gap-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const btn = "border-border rounded-md border px-3 py-1.5 text-sm";
const primary = "bg-accent text-accent-fg rounded-md px-3 py-1.5 text-sm font-medium";

export function ConflictDialog() {
  const conflict = useWorkspace((s) => s.conflict);
  const setConflict = useWorkspace((s) => s.setConflict);
  const reload = useWorkspace((s) => s.reloadActive);
  const resolve = (choice: "merge" | "mine") =>
    window.dispatchEvent(new CustomEvent("archboard:resolve-conflict", { detail: choice }));
  return (
    <Modal
      open={!!conflict}
      title="This scene was updated in another tab"
      description="Choose how to continue. Merge keeps the newest version of each element from both tabs."
      onOpenChange={(o) => !o && setConflict(null)}
    >
      <button type="button" className={primary} onClick={() => resolve("merge")}>
        Merge
      </button>
      <button type="button" className={btn} onClick={() => void reload()}>
        Reload latest (discard my changes)
      </button>
      <button type="button" className={btn} onClick={() => resolve("mine")}>
        Keep mine (overwrite)
      </button>
    </Modal>
  );
}

export function RecoveryDialog() {
  const corrupt = useWorkspace((s) => s.corrupt);
  const scenes = useWorkspace((s) => s.scenes);
  const open = useWorkspace((s) => s.openScene);
  const newScene = useWorkspace((s) => s.newScene);
  const backup = useWorkspace((s) => s.downloadBackup);
  const other = scenes.find((s) => s.id !== corrupt?.sceneId);
  return (
    <Modal
      open={!!corrupt}
      title="This scene could not be opened"
      description={`Its stored data failed validation (${corrupt?.reason ?? ""}). Nothing was changed or deleted. Download the raw data so it can be repaired, or continue with another scene.`}
    >
      <button
        type="button"
        className={primary}
        onClick={() =>
          downloadText(
            JSON.stringify(corrupt?.raw ?? null, null, 2),
            `archboard-recovery-${corrupt?.sceneId}.json`,
          )
        }
      >
        Download raw data
      </button>
      <button type="button" className={btn} onClick={() => void backup()}>
        Download full backup
      </button>
      {other ? (
        <button type="button" className={btn} onClick={() => void open(other.id)}>
          Open “{other.title}”
        </button>
      ) : (
        <button type="button" className={btn} onClick={() => void newScene()}>
          Start a new scene
        </button>
      )}
    </Modal>
  );
}

/** Used by the error boundary, which cannot rely on the store being healthy. */
export async function downloadRawDatabase() {
  const db = getDb();
  const [scenes, pages] = await Promise.all([db.scenes.toArray(), db.pages.toArray()]);
  downloadText(JSON.stringify({ scenes, pages }), "archboard-raw-recovery.json");
}
