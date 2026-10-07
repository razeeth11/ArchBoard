"use client";

import {
  Copy,
  Download,
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { daysLeft, timeAgo } from "@/lib/time";
import * as repo from "@/persistence/repo";
import { postTab } from "@/persistence/channel";
import { TRASH_TTL_MS, type Scene } from "@/persistence/types";
import { useWorkspace } from "@/store/workspace";

function Thumb({ blobId }: { blobId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    let made: string | null = null;
    if (!blobId) return;
    void repo.getBlob(blobId).then((b) => {
      if (!b || revoked) return;
      made = URL.createObjectURL(new Blob([b.bytes], { type: b.mime }));
      setUrl(made);
    });
    return () => {
      revoked = true;
      if (made) URL.revokeObjectURL(made); // memory hygiene: one URL per mounted thumbnail
    };
  }, [blobId]);
  return (
    <div className="bg-surface border-border h-12 w-16 shrink-0 overflow-hidden rounded border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && blobId ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}

const itemBtn =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface";

function SceneMenu({ scene, index, count }: { scene: Scene; index: number; count: number }) {
  const ws = useWorkspace();
  const [, force] = useState(0);
  const move = async (delta: number) => {
    const ids = ws.scenes.map((s) => s.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    await repo.reorderScenes(ids);
    await ws.refresh();
    postTab({ kind: "workspace-changed" });
  };
  return (
    <DropdownMenu.Root onOpenChange={() => force((n) => n + 1)}>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={`Actions for ${scene.title}`} className="rounded p-1">
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="bg-bg text-fg border-border z-50 min-w-44 rounded-lg border p-1 shadow-lg"
        >
          <DropdownMenu.Item
            className={itemBtn}
            onSelect={() =>
              window.dispatchEvent(new CustomEvent("archboard:rename", { detail: scene.id }))
            }
          >
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemBtn} onSelect={() => void ws.duplicateScene(scene.id)}>
            <Copy size={14} aria-hidden /> Duplicate
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemBtn}
            onSelect={async () => {
              await repo.setPinned(scene.id, !scene.pinned);
              await ws.refresh();
            }}
          >
            <Pin size={14} aria-hidden /> {scene.pinned ? "Unpin" : "Pin to top"}
          </DropdownMenu.Item>
          {index > 0 && (
            <DropdownMenu.Item className={itemBtn} onSelect={() => void move(-1)}>
              Move up
            </DropdownMenu.Item>
          )}
          {index < count - 1 && (
            <DropdownMenu.Item className={itemBtn} onSelect={() => void move(1)}>
              Move down
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemBtn}>Move to folder…</DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="bg-bg border-border z-50 rounded-lg border p-1 shadow-lg">
                <DropdownMenu.Item
                  className={itemBtn}
                  onSelect={async () => {
                    await repo.moveSceneToFolder(scene.id, null);
                    await ws.refresh();
                  }}
                >
                  No folder
                </DropdownMenu.Item>
                {ws.folders.map((f) => (
                  <DropdownMenu.Item
                    key={f.id}
                    className={itemBtn}
                    onSelect={async () => {
                      await repo.moveSceneToFolder(scene.id, f.id);
                      await ws.refresh();
                    }}
                  >
                    {f.name}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item className={itemBtn} onSelect={() => void ws.trashScene(scene.id)}>
            <Trash2 size={14} aria-hidden /> Move to trash
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SceneRow({ scene, index, count }: { scene: Scene; index: number; count: number }) {
  const ws = useWorkspace();
  const activeId = ws.active?.scene.id;
  const [renaming, setRenaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: Event) => (e as CustomEvent<string>).detail === scene.id && setRenaming(true);
    window.addEventListener("archboard:rename", h);
    return () => window.removeEventListener("archboard:rename", h);
  }, [scene.id]);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commit = async (value: string) => {
    setRenaming(false);
    if (value.trim() && value !== scene.title) {
      await repo.renameScene(scene.id, value);
      await ws.refresh();
      postTab({ kind: "workspace-changed" });
    }
  };
  const reorderable = ws.folderFilter === "all" && !ws.search;

  return (
    <li
      draggable={reorderable}
      onDragStart={(e) => e.dataTransfer.setData("text/archboard-scene", scene.id)}
      onDragOver={(e) => {
        if (!reorderable) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        setDragOver(false);
        const from = e.dataTransfer.getData("text/archboard-scene");
        if (!from || from === scene.id) return;
        const ids = ws.scenes.map((s) => s.id).filter((id) => id !== from);
        ids.splice(ids.indexOf(scene.id), 0, from);
        await repo.reorderScenes(ids);
        await ws.refresh();
        postTab({ kind: "workspace-changed" });
      }}
      className={`flex items-center gap-2 rounded-lg border p-1.5 ${
        scene.id === activeId ? "border-accent" : "border-transparent"
      } ${dragOver ? "bg-surface" : ""}`}
      data-testid="scene-row"
    >
      <Thumb blobId={scene.thumbnailBlobId} />
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            ref={inputRef}
            defaultValue={scene.title}
            aria-label="Scene name"
            className="bg-bg border-border w-full rounded border px-1 text-sm"
            onBlur={(e) => void commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit(e.currentTarget.value);
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="block w-full truncate text-left text-sm font-medium"
            aria-current={scene.id === activeId ? "true" : undefined}
            onClick={() => void ws.openScene(scene.id)}
          >
            {scene.pinned && <Pin size={12} className="mr-1 inline" aria-label="Pinned" />}
            {scene.title}
          </button>
        )}
        <div className="text-muted text-xs">Edited {timeAgo(scene.updatedAt)}</div>
      </div>
      <SceneMenu scene={scene} index={index} count={count} />
    </li>
  );
}

export function WorkspacePanel() {
  const ws = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState(false);

  const visible = useMemo(() => {
    const q = ws.search.trim().toLowerCase();
    return ws.scenes.filter(
      (s) =>
        (ws.folderFilter === "all" || s.folderId === ws.folderFilter) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [ws.scenes, ws.folderFilter, ws.search]);

  if (!ws.panelOpen) return null;
  const showTrash = ws.folderFilter === "trash";

  return (
    <aside
      id="workspace-panel"
      aria-label="Scenes"
      className="bg-bg text-fg border-border fixed top-0 bottom-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col border-r shadow-xl"
    >
      <div className="border-border flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Scenes</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="New scene"
            className="bg-accent text-accent-fg flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
            onClick={() => void ws.newScene()}
          >
            <Plus size={14} aria-hidden /> New
          </button>
          <button
            type="button"
            aria-label="Close scenes panel"
            onClick={() => ws.setPanelOpen(false)}
            className="rounded p-1"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="p-3 pb-0">
        <label className="relative block">
          <span className="sr-only">Search scenes</span>
          <Search size={14} className="text-muted absolute top-2.5 left-2" aria-hidden />
          <input
            type="search"
            value={ws.search}
            onChange={(e) => ws.setSearch(e.target.value)}
            placeholder="Search scenes"
            className="bg-bg border-border w-full rounded-md border py-1.5 pr-2 pl-7 text-sm"
          />
        </label>
      </div>

      <nav aria-label="Folders" className="flex flex-wrap gap-1 p-3 text-xs">
        {[
          { id: "all", name: "All" },
          ...ws.folders.map((f) => ({ id: f.id, name: f.name })),
          { id: "trash", name: `Trash (${ws.trash.length})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={ws.folderFilter === f.id}
            onClick={() => ws.setFolderFilter(f.id)}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              ws.folderFilter === f.id ? "bg-accent text-accent-fg border-accent" : "border-border"
            }`}
          >
            {f.id !== "all" && f.id !== "trash" && <FolderIcon size={11} aria-hidden />}
            {f.name}
          </button>
        ))}
        {newFolder ? (
          <input
            autoFocus
            aria-label="Folder name"
            placeholder="Folder name"
            className="bg-bg border-border w-28 rounded border px-1"
            onKeyDown={async (e) => {
              if (e.key === "Escape") setNewFolder(false);
              if (e.key === "Enter") {
                await repo.createFolder(e.currentTarget.value);
                setNewFolder(false);
                await ws.refresh();
              }
            }}
            onBlur={() => setNewFolder(false)}
          />
        ) : (
          <button
            type="button"
            aria-label="New folder"
            onClick={() => setNewFolder(true)}
            className="rounded-full border border-dashed px-1.5"
          >
            <FolderPlus size={12} aria-hidden />
          </button>
        )}
        {ws.folderFilter !== "all" && ws.folderFilter !== "trash" && (
          <button
            type="button"
            className="text-muted underline"
            onClick={async () => {
              await repo.deleteFolder(ws.folderFilter);
              ws.setFolderFilter("all");
              await ws.refresh();
            }}
          >
            Delete folder
          </button>
        )}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {showTrash ? (
          <>
            <p className="text-muted mb-2 text-xs">Trashed scenes are deleted after 30 days.</p>
            <ul className="space-y-1">
              {ws.trash.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {s.title}
                    <span className="text-muted block text-xs">
                      {daysLeft(s.deletedAt!, TRASH_TTL_MS)} days left
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Restore ${s.title}`}
                    onClick={() => void ws.restoreScene(s.id)}
                    className="rounded p-1"
                  >
                    <RotateCcw size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${s.title} forever`}
                    onClick={() => void ws.deleteForever(s.id)}
                    className="rounded p-1"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </li>
              ))}
              {ws.trash.length === 0 && <li className="text-muted text-sm">Trash is empty.</li>}
            </ul>
          </>
        ) : (
          <ul className="space-y-1">
            {visible.map((s) => (
              <SceneRow
                key={s.id}
                scene={s}
                index={ws.scenes.indexOf(s)}
                count={ws.scenes.length}
              />
            ))}
            {visible.length === 0 && <li className="text-muted text-sm">No scenes found.</li>}
          </ul>
        )}
      </div>

      <div className="border-border flex gap-2 border-t p-3 text-xs">
        <button
          type="button"
          className="border-border flex items-center gap-1 rounded-md border px-2 py-1"
          onClick={() => void ws.downloadBackup()}
        >
          <Download size={12} aria-hidden /> Backup
        </button>
        <button
          type="button"
          className="border-border flex items-center gap-1 rounded-md border px-2 py-1"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={12} aria-hidden /> Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.excalidraw,application/json"
          multiple
          hidden
          data-testid="import-input"
          onChange={(e) => {
            if (e.target.files) void ws.importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </aside>
  );
}
