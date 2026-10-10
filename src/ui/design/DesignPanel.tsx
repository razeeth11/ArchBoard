"use client";

import { useCallback, useEffect, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import {
  applyBox,
  boundsOf,
  setOpacity,
  setRotation,
  targets,
  type Box,
  type TEl,
} from "@/engine/transform";
import { usePresent } from "@/present/slides";
import { useUi } from "@/store/ui";

interface Snap {
  count: number;
  box: Box | null;
  opacity: number;
  angle: number | null;
}

const NAMES: Record<string, string> = {
  X: "X position",
  Y: "Y position",
  W: "Width",
  H: "Height",
  R: "Rotation",
  Op: "Opacity",
};

const EMPTY: Snap = { count: 0, box: null, opacity: 100, angle: null };

function read(): Snap {
  const api = getEditorApi();
  if (!api) return EMPTY;
  const sel = api.getAppState().selectedElementIds;
  const picked = targets(api.getSceneElements() as unknown as TEl[], sel);
  if (!picked.length) return EMPTY;
  const ops = new Set(picked.map((e) => e.opacity));
  return {
    count: picked.length,
    box: boundsOf(picked),
    opacity: ops.size === 1 ? picked[0]!.opacity : -1,
    angle: picked.length === 1 ? Math.round((picked[0]!.angle * 180) / Math.PI) % 360 : null,
  };
}

const sameSnap = (a: Snap, b: Snap) =>
  a.count === b.count &&
  a.opacity === b.opacity &&
  a.angle === b.angle &&
  a.box?.x === b.box?.x &&
  a.box?.y === b.box?.y &&
  a.box?.w === b.box?.w &&
  a.box?.h === b.box?.h;

/** Figma-style numeric controls for the selection: position, size, rotation and opacity. */
export function DesignPanel() {
  const open = useUi((s) => s.designOpen);
  const componentsOpen = useUi((s) => s.componentsOpen);
  const presenting = usePresent((s) => s.active);
  const [snap, setSnap] = useState<Snap>(EMPTY);
  const [ratio, setRatio] = useState(true);

  useEffect(() => {
    let off: (() => void) | undefined;
    let raf = 0;
    const refresh = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = read();
        setSnap((cur) => (sameSnap(cur, next) ? cur : next));
      });
    };
    const attach = () => {
      const api = getEditorApi();
      if (!api) return false;
      off = api.onChange(refresh);
      refresh();
      return true;
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!attach()) timer = setInterval(() => attach() && clearInterval(timer), 150);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      off?.();
    };
  }, []);

  const commit = useCallback(async (fn: (all: TEl[], sel: Record<string, boolean>) => TEl[]) => {
    const api = getEditorApi();
    if (!api) return;
    const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
    const sel = api.getAppState().selectedElementIds as Record<string, boolean>;
    const all = api.getSceneElementsIncludingDeleted() as unknown as TEl[];
    api.updateScene({
      elements: fn(all, sel) as never,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

  if (!open || snap.count === 0 || !snap.box || presenting) return null;
  const b = snap.box;

  const num = (label: string, value: number | null, apply: (v: number) => void, suffix = "") => (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-muted w-6 shrink-0">{label}</span>
      <input
        key={`${label}:${value}`}
        type="number"
        inputMode="decimal"
        aria-label={NAMES[label] ?? label}
        defaultValue={value === null ? "" : Math.round(value * 10) / 10}
        placeholder={value === null ? "mixed" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).value = String(
              value === null ? "" : Math.round(value * 10) / 10,
            );
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && (value === null || Math.abs(v - value) > 0.049)) apply(v);
        }}
        className="border-border bg-bg h-7 w-full min-w-0 rounded border px-1.5"
      />
      {suffix && <span className="text-muted">{suffix}</span>}
    </label>
  );

  return (
    <aside
      aria-label="Design"
      data-testid="design-panel"
      className={`bg-bg text-fg border-border pointer-events-auto fixed top-16 z-20 hidden w-56 rounded-xl border p-3 text-sm shadow-xl lg:block ${componentsOpen ? "right-[35rem]" : "right-3"}`}
    >
      <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
        Design{snap.count > 1 ? ` · ${snap.count} selected` : ""}
      </h2>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {num("X", b.x, (v) => void commit((a, s) => applyBox(a, s, { x: v }, false)))}
        {num("Y", b.y, (v) => void commit((a, s) => applyBox(a, s, { y: v }, false)))}
        {num("W", b.w, (v) => void commit((a, s) => applyBox(a, s, { w: v }, ratio)))}
        {num("H", b.h, (v) => void commit((a, s) => applyBox(a, s, { h: v }, ratio)))}
        {snap.angle !== null &&
          num("R", snap.angle, (v) => void commit((a, s) => setRotation(a, s, v)), "°")}
        {num(
          "Op",
          snap.opacity < 0 ? null : snap.opacity,
          (v) => void commit((a, s) => setOpacity(a, s, v)),
          "%",
        )}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={ratio} onChange={(e) => setRatio(e.target.checked)} />
        Lock proportions
      </label>
    </aside>
  );
}
