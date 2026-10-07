"use client";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/store/workspace";

const item =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface";

/** Pages of the current scene (e.g. Context / Containers / Deployment). */
export function PageTabs() {
  const active = useWorkspace((s) => s.active);
  const { openPage, addPage, renamePage, deletePage, movePage, duplicatePage } =
    useWorkspace.getState();
  const [renaming, setRenaming] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) input.current?.select();
  }, [renaming]);
  if (!active) return null;
  const pages = active.pages;

  return (
    <nav
      aria-label="Pages"
      className="bg-bg text-fg border-border fixed bottom-3 left-1/2 z-20 flex max-w-[60vw] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border p-1 shadow-lg"
    >
      <div role="tablist" aria-label="Scene pages" className="flex items-center gap-1">
        {pages.map((p, i) => {
          const current = p.id === active.page.id;
          return (
            <div
              key={p.id}
              className={`flex items-center rounded-lg ${current ? "bg-accent text-accent-fg" : "hover:bg-surface"}`}
            >
              {renaming === p.id ? (
                <input
                  ref={input}
                  defaultValue={p.title}
                  aria-label="Page name"
                  className="text-fg bg-bg w-28 rounded px-1 text-sm"
                  onBlur={(e) => {
                    void renamePage(p.id, e.currentTarget.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={current}
                  data-testid="page-tab"
                  onClick={() => void openPage(p.id)}
                  onDoubleClick={() => setRenaming(p.id)}
                  className="max-w-40 truncate px-3 py-1 text-sm"
                >
                  {p.title}
                </button>
              )}
              {current && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for page ${p.title}`}
                      className="rounded p-1"
                    >
                      <MoreHorizontal size={14} aria-hidden />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="top"
                      className="bg-bg text-fg border-border z-50 min-w-40 rounded-lg border p-1 shadow-lg"
                    >
                      <DropdownMenu.Item className={item} onSelect={() => setRenaming(p.id)}>
                        <Pencil size={14} aria-hidden /> Rename
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={item} onSelect={() => void duplicatePage(p.id)}>
                        <Copy size={14} aria-hidden /> Duplicate
                      </DropdownMenu.Item>
                      {i > 0 && (
                        <DropdownMenu.Item
                          className={item}
                          onSelect={() => void movePage(p.id, -1)}
                        >
                          <ChevronLeft size={14} aria-hidden /> Move left
                        </DropdownMenu.Item>
                      )}
                      {i < pages.length - 1 && (
                        <DropdownMenu.Item className={item} onSelect={() => void movePage(p.id, 1)}>
                          <ChevronRight size={14} aria-hidden /> Move right
                        </DropdownMenu.Item>
                      )}
                      {pages.length > 1 && (
                        <DropdownMenu.Item className={item} onSelect={() => void deletePage(p.id)}>
                          <Trash2 size={14} aria-hidden /> Delete page
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Add page"
        title="Add page"
        onClick={() => void addPage()}
        className="hover:bg-surface rounded-lg p-1.5"
      >
        <Plus size={16} aria-hidden />
      </button>
    </nav>
  );
}
