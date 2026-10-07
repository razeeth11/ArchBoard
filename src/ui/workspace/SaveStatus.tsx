"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useWorkspace } from "@/store/workspace";

export function SaveStatus() {
  const status = useWorkspace((s) => s.saveStatus);
  const persisted = useWorkspace((s) => s.persisted);
  const low = useWorkspace((s) => s.storageLow);
  const backup = useWorkspace((s) => s.downloadBackup);
  const warn = persisted === false || low;

  let label = "Saved locally";
  if (status === "saving") label = "Saving…";
  if (status === "error") label = "Save failed";
  if (status === "conflict") label = "Changed in another tab";

  return (
    <div className="text-muted flex items-center gap-2 text-xs" data-testid="save-status">
      <span role="status" aria-live="polite" className="flex items-center gap-1">
        {status === "saving" ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : status === "error" || status === "conflict" ? (
          <AlertTriangle size={14} aria-hidden />
        ) : (
          <Check size={14} aria-hidden />
        )}
        {label}
      </span>
      {warn && (
        <button
          type="button"
          onClick={() => void backup()}
          title={
            low
              ? "Browser storage is almost full. Download a backup."
              : "Your browser may clear local data under storage pressure. Download a backup."
          }
          className="text-fg underline"
        >
          Download backup
        </button>
      )}
    </div>
  );
}
