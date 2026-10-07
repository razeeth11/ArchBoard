"use client";

import { X } from "lucide-react";
import { useToasts } from "@/store/toasts";

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-fg text-bg flex items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-lg"
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
