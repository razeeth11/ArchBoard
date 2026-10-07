"use client";

import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { useUi } from "@/store/ui";

type Kind = NonNullable<ReturnType<typeof useUi.getState>["dialog"]>;

/** Shared shell for the Phase 6 dialogs: one open at a time, body mounted only while open. */
export function Modal({
  kind,
  title,
  description,
  wide,
  children,
}: {
  kind: Kind;
  title: ReactNode;
  description: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const open = useUi((s) => s.dialog === kind);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && useUi.getState().setDialog(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          aria-describedby={`${kind}-desc`}
          className={`bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-xl border p-5 shadow-xl ${wide ? "w-[min(96vw,60rem)]" : "w-[min(96vw,34rem)]"}`}
        >
          <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Description id={`${kind}-desc`} className="text-muted mt-1 text-sm">
            {description}
          </Dialog.Description>
          {open && children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const btn =
  "border-border bg-surface text-fg inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50";
export const btnPrimary =
  "bg-accent text-accent-fg inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium disabled:opacity-50";
