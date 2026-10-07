"use client";

import { Presentation } from "lucide-react";
import { useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { slidesOf, usePresent, withNotes } from "@/present/slides";
import { useUi } from "@/store/ui";
import { Modal, btn, btnPrimary } from "@/ui/common/Modal";

export function SlidesDialog() {
  return (
    <Modal
      kind="slides"
      title={
        <>
          <Presentation size={20} aria-hidden /> Slides
        </>
      }
      description="Each frame on the canvas is a slide, in reading order. Add speaker notes, then present or export the deck."
    >
      <Body />
    </Modal>
  );
}

function Body() {
  const api = getEditorApi();
  const [slides, setSlides] = useState(() => (api ? slidesOf(api.getSceneElements()) : []));

  async function saveNotes(id: string, notes: string) {
    if (!api) return;
    const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
    api.updateScene({
      elements: api
        .getSceneElementsIncludingDeleted()
        .map((e) => (e.id === id ? withNotes(e, notes) : e)),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }

  async function addFrame() {
    if (!api) return;
    const { convertToExcalidrawElements, CaptureUpdateAction } =
      await import("@excalidraw/excalidraw");
    const existing = slidesOf(api.getSceneElements());
    const last = api
      .getSceneElements()
      .filter((e) => e.type === "frame")
      .at(-1);
    const [f] = convertToExcalidrawElements([
      {
        type: "frame",
        children: [],
        name: `Slide ${existing.length + 1}`,
        x: last ? last.x + last.width + 80 : 0,
        y: last ? last.y : 0,
        width: 960,
        height: 540,
      } as never,
    ]);
    if (!f) return;
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), f],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setSlides(slidesOf(api.getSceneElements()));
  }

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      {slides.length === 0 ? (
        <p data-testid="slides-empty" className="border-border rounded-lg border p-3">
          No frames yet. Frames (press <kbd>F</kbd>) become slides. Add one to get started.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {slides.map((s, i) => (
            <li key={s.id} data-testid="slide-row" className="border-border rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <strong>
                  {i + 1}. {s.name}
                </strong>
                <button
                  className={btn}
                  onClick={() => {
                    useUi.getState().setDialog(null);
                    usePresent.getState().start(i);
                  }}
                >
                  Present from here
                </button>
              </div>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-muted text-xs">Speaker notes</span>
                <textarea
                  defaultValue={s.notes}
                  onBlur={(e) => e.target.value !== s.notes && void saveNotes(s.id, e.target.value)}
                  className="border-border bg-surface h-16 rounded border p-1"
                />
              </label>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button className={btn} onClick={() => void addFrame()}>
          Add slide frame
        </button>
        <button
          className={btn}
          disabled={!slides.length}
          onClick={() => {
            useUi.getState().setDialog(null);
            useUi.getState().setExportOpen(true);
          }}
          title="Opens Export with PDF: one page per frame"
        >
          Export deck as PDF
        </button>
        <button
          className={btnPrimary}
          disabled={!slides.length}
          onClick={() => {
            useUi.getState().setDialog(null);
            usePresent.getState().start(0);
          }}
        >
          Present
        </button>
      </div>
    </div>
  );
}
