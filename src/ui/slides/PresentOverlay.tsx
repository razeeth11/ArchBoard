"use client";

import { useEffect, useMemo } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { slidesOf, usePresent } from "@/present/slides";
import { btn } from "@/ui/common/Modal";

/** Frames as slides: view + zen mode on the live canvas, keyboard driven, notes in a bottom bar. */
export function PresentOverlay() {
  const { active, index, notes, laser } = usePresent();
  const slides = useMemo(() => {
    const api = getEditorApi();
    return active && api ? slidesOf(api.getSceneElements()) : [];
  }, [active]);

  // Enter/leave presenting: remember the previous view settings and restore them.
  useEffect(() => {
    const api = getEditorApi();
    if (!active || !api) return;
    if (!slides.length) {
      usePresent.getState().stop();
      return;
    }
    const prev = api.getAppState();
    const saved = {
      viewModeEnabled: prev.viewModeEnabled,
      zenModeEnabled: prev.zenModeEnabled,
      scrollX: prev.scrollX,
      scrollY: prev.scrollY,
      zoom: prev.zoom,
      activeTool: prev.activeTool,
    };
    api.updateScene({ appState: { viewModeEnabled: true, zenModeEnabled: true } });
    void document.documentElement
      .requestFullscreen?.()
      .then(() => {
        document.documentElement.dataset.presentFs = "1";
      })
      .catch(() => undefined);
    return () => {
      delete document.documentElement.dataset.presentFs;
      const a = getEditorApi();
      a?.updateScene({
        appState: {
          viewModeEnabled: saved.viewModeEnabled,
          zenModeEnabled: saved.zenModeEnabled,
          scrollX: saved.scrollX,
          scrollY: saved.scrollY,
          zoom: saved.zoom,
        },
      });
      a?.setActiveTool({ type: "selection" });
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [active, slides]);

  useEffect(() => {
    const api = getEditorApi();
    if (!active || !api || !slides[index]) return;
    const frame = api.getSceneElements().find((e) => e.id === slides[index]!.id);
    if (frame)
      api.scrollToContent(frame, { fitToViewport: true, viewportZoomFactor: 0.95, animate: false });
  }, [active, index, slides]);

  useEffect(() => {
    const api = getEditorApi();
    if (!active || !api) return;
    api.setActiveTool(laser ? { type: "laser" } : { type: "hand" });
  }, [active, laser]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const p = usePresent.getState();
      const last = slides.length - 1;
      const k = e.key;
      const used = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") {
        used();
        p.go(Math.min(last, p.index + 1));
      } else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") {
        used();
        p.go(Math.max(0, p.index - 1));
      } else if (k === "Home") {
        used();
        p.go(0);
      } else if (k === "End") {
        used();
        p.go(last);
      } else if (k === "Escape") {
        used();
        p.stop();
      } else if (k.toLowerCase() === "l") {
        used();
        p.setLaser(!p.laser);
      } else if (k.toLowerCase() === "n") {
        used();
        p.toggleNotes();
      }
    };
    const onFs = () => {
      if (!document.fullscreenElement && document.documentElement.dataset.presentFs === "1")
        usePresent.getState().stop();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [active, slides.length]);

  if (!active || !slides[index]) return null;
  const s = slides[index]!;
  return (
    <div
      data-testid="present-overlay"
      role="region"
      aria-label="Presentation controls"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-3"
    >
      {notes && (
        <p
          data-testid="present-notes"
          className="bg-surface text-fg border-border pointer-events-auto max-w-3xl rounded-lg border p-3 text-sm shadow"
        >
          {s.notes || "No notes for this slide."}
        </p>
      )}
      <div className="bg-surface text-fg border-border pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1 text-sm shadow">
        <button
          className={btn}
          aria-label="Previous slide"
          onClick={() => usePresent.getState().go(Math.max(0, index - 1))}
        >
          ←
        </button>
        <span data-testid="present-counter" aria-live="polite">
          {index + 1} / {slides.length} · {s.name}
        </span>
        <button
          className={btn}
          aria-label="Next slide"
          onClick={() => usePresent.getState().go(Math.min(slides.length - 1, index + 1))}
        >
          →
        </button>
        <button
          className={btn}
          aria-pressed={laser}
          onClick={() => usePresent.getState().setLaser(!laser)}
        >
          Laser (L)
        </button>
        <button
          className={btn}
          aria-pressed={notes}
          onClick={() => usePresent.getState().toggleNotes()}
        >
          Notes (N)
        </button>
        <button className={btn} onClick={() => usePresent.getState().stop()}>
          Exit (Esc)
        </button>
      </div>
    </div>
  );
}
