"use client";

import { useEffect } from "react";
import { getSetting, setSetting } from "@/persistence/repo";
import { useToasts } from "@/store/toasts";
import { useWorkspace } from "@/store/workspace";

const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** Gentle, dismissible; once dismissed it stays off until the user re-enables it. */
export function BackupReminder() {
  const ready = useWorkspace((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const enabled = await getSetting("backupReminderEnabled", true);
      if (!enabled || cancelled) return;
      const last = await getSetting<number>("lastBackupAt", 0);
      const firstSeen = await getSetting<number>("firstSeenAt", 0);
      if (!firstSeen) return void (await setSetting("firstSeenAt", Date.now()));
      if (Date.now() - Math.max(last, firstSeen) < REMIND_AFTER_MS) return;
      if (cancelled) return;
      useToasts.getState().push({
        message: "It has been a while since your last backup.",
        ttl: 0,
        action: {
          label: "Download backup",
          run: () => void useWorkspace.getState().downloadBackup(),
        },
      });
      // Dismissing (or acting on) the toast turns reminders off; we only nag once.
      await setSetting("backupReminderEnabled", false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return null;
}
