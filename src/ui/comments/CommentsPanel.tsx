"use client";

import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { getEditorApi } from "@/engine/apiRef";
import * as repo from "@/persistence/comments";
import type { Comment } from "@/persistence/types";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { btn, btnPrimary } from "@/ui/common/Modal";

interface CommentsState {
  items: Comment[];
  showResolved: boolean;
  setItems: (c: Comment[]) => void;
  setShowResolved: (v: boolean) => void;
}
export const useComments = create<CommentsState>((set) => ({
  items: [],
  showResolved: false,
  setItems: (items) => set({ items }),
  setShowResolved: (showResolved) => set({ showResolved }),
}));

/** Keep the comments store in sync with the active page (and refresh after any change). */
export function useCommentsSync() {
  const sceneId = useWorkspace((s) => s.active?.scene.id);
  const pageId = useWorkspace((s) => s.active?.page.id);
  const refresh = useCallback(async () => {
    if (!sceneId || !pageId) return useComments.getState().setItems([]);
    useComments.getState().setItems(await repo.listComments(sceneId, pageId));
  }, [sceneId, pageId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return refresh;
}

export function CommentsPanel() {
  const open = useUi((s) => s.commentsOpen);
  const refresh = useCommentsSync();
  const { items, showResolved } = useComments();
  const sceneId = useWorkspace((s) => s.active?.scene.id);
  const pageId = useWorkspace((s) => s.active?.page.id);
  const [text, setText] = useState("");
  const shown = items.filter((c) => showResolved || !c.resolved);

  async function add() {
    const api = getEditorApi();
    if (!api || !sceneId || !pageId) return;
    const sel = Object.keys(api.getAppState().selectedElementIds);
    const s = api.getAppState();
    const anchor = sel[0]
      ? { elementId: sel[0] }
      : {
          x: (s.width / 2 - s.scrollX * s.zoom.value) / s.zoom.value,
          y: (s.height / 2 - s.scrollY * s.zoom.value) / s.zoom.value,
        };
    try {
      await repo.addComment(sceneId, pageId, text, anchor);
      setText("");
      await refresh();
    } catch (e) {
      useToasts
        .getState()
        .push({ message: e instanceof Error ? e.message : "Could not add comment" });
    }
  }

  function goTo(c: Comment) {
    const api = getEditorApi();
    if (!api) return;
    const p = repo.anchorPoint(c.anchor, api.getSceneElements());
    if (!p) return useToasts.getState().push({ message: "The commented shape was deleted." });
    api.scrollToContent(
      "elementId" in c.anchor
        ? api
            .getSceneElements()
            .filter((e) => e.id === (c.anchor as { elementId: string }).elementId)
        : [],
      { animate: false },
    );
    if (!("elementId" in c.anchor)) {
      const s = api.getAppState();
      api.updateScene({
        appState: {
          scrollX: s.width / 2 / s.zoom.value - p.x,
          scrollY: s.height / 2 / s.zoom.value - p.y,
        },
      });
    }
  }

  if (!open) return null;
  return (
    <aside
      id="comments-panel"
      aria-label="Comments"
      className="bg-bg text-fg border-border fixed top-16 right-3 bottom-16 z-30 flex w-80 flex-col rounded-xl border p-3 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquare size={18} aria-hidden /> Comments
        </h2>
        <button
          aria-label="Close comments"
          className={btn}
          onClick={() => useUi.getState().setCommentsOpen(false)}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => useComments.getState().setShowResolved(e.target.checked)}
        />
        Show resolved
      </label>
      <ul className="mt-2 flex-1 space-y-2 overflow-auto">
        {shown.length === 0 && <li className="text-muted text-sm">No comments yet.</li>}
        {shown.map((c) => (
          <li
            key={c.id}
            data-testid="comment-item"
            className={`border-border rounded-lg border p-2 text-sm ${c.resolved ? "opacity-60" : ""}`}
          >
            <button
              className="text-left"
              onClick={() => goTo(c)}
              aria-label={`Go to comment: ${c.text.slice(0, 40)}`}
            >
              {c.text}
            </button>
            <div className="mt-1 flex gap-1">
              <button
                className={btn}
                onClick={() => void repo.setResolved(c.id, !c.resolved).then(refresh)}
              >
                {c.resolved ? <RotateCcw size={14} aria-hidden /> : <Check size={14} aria-hidden />}
                {c.resolved ? "Reopen" : "Resolve"}
              </button>
              <button
                className={btn}
                aria-label="Delete comment"
                onClick={() => void repo.deleteComment(c.id).then(refresh)}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          aria-label="New comment"
          data-testid="comment-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Comment on the selected shape, or on the centre of the view"
          className="border-border bg-surface h-16 rounded border p-1 text-sm"
        />
        <button className={btnPrimary} disabled={!text.trim()} onClick={() => void add()}>
          Add comment
        </button>
      </div>
    </aside>
  );
}

/** Numbered pins over the canvas, following scroll and zoom. */
export function CommentPins() {
  const items = useComments((s) => s.items);
  const [, tick] = useState(0);
  const nonce = useWorkspace((s) => s.active?.nonce);
  // The engine mounts after this component on a fresh load: wait for it, then follow scroll/zoom.
  useEffect(() => {
    let off: (() => void) | undefined;
    const attach = () => {
      const api = getEditorApi();
      if (!api) return false;
      off = api.onChange(() => tick((n) => n + 1));
      tick((n) => n + 1);
      return true;
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!attach()) {
      timer = setInterval(() => attach() && clearInterval(timer), 150);
    }
    return () => {
      clearInterval(timer);
      off?.();
    };
  }, [nonce, items.length]);
  const api = getEditorApi();
  if (!api) return null;
  const els = api.getSceneElements();
  const s = api.getAppState();
  return (
    <>
      {items
        .filter((c) => !c.resolved)
        .map((c, i) => {
          const p = repo.anchorPoint(c.anchor, els);
          if (!p) return null;
          const x = (p.x + s.scrollX) * s.zoom.value + s.offsetLeft;
          const y = (p.y + s.scrollY) * s.zoom.value + s.offsetTop;
          return (
            <span
              key={c.id}
              data-testid="comment-pin"
              title={c.text}
              style={{ left: x, top: y }}
              className="bg-accent text-accent-fg pointer-events-none fixed z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs shadow"
            >
              {i + 1}
            </span>
          );
        })}
    </>
  );
}
