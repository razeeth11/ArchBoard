import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { create } from "zustand";

export const NOTES_KEY = "archboardNotes";
export interface Slide {
  id: string;
  name: string;
  notes: string;
}

type FrameLike = ExcalidrawElement & { name?: string | null };

/** Frames in reading order: rows top to bottom (within a tolerance), then left to right. */
export function orderedFrames(all: readonly ExcalidrawElement[]): FrameLike[] {
  const frames = all.filter((e) => !e.isDeleted && (e.type === "frame" || e.type === "magicframe"));
  const tol = 40;
  return [...frames].sort((a, b) =>
    Math.abs(a.y - b.y) > tol ? a.y - b.y : a.x - b.x,
  ) as FrameLike[];
}

export function slidesOf(all: readonly ExcalidrawElement[]): Slide[] {
  return orderedFrames(all).map((f, i) => ({
    id: f.id,
    name: f.name?.trim() || `Slide ${i + 1}`,
    notes: String(((f.customData ?? {}) as Record<string, unknown>)[NOTES_KEY] ?? ""),
  }));
}

export function withNotes(frame: ExcalidrawElement, notes: string): ExcalidrawElement {
  const cd = { ...((frame.customData ?? {}) as Record<string, unknown>) };
  if (notes.trim()) cd[NOTES_KEY] = notes.slice(0, 4000);
  else delete cd[NOTES_KEY];
  return {
    ...frame,
    customData: Object.keys(cd).length ? cd : undefined,
    version: frame.version + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
  } as ExcalidrawElement;
}

interface PresentState {
  active: boolean;
  index: number;
  notes: boolean;
  laser: boolean;
  start: (index?: number) => void;
  stop: () => void;
  go: (i: number) => void;
  toggleNotes: () => void;
  setLaser: (v: boolean) => void;
}
export const usePresent = create<PresentState>((set) => ({
  active: false,
  index: 0,
  notes: false,
  laser: false,
  start: (index = 0) => set({ active: true, index }),
  stop: () => set({ active: false, laser: false }),
  go: (index) => set({ index }),
  toggleNotes: () => set((s) => ({ notes: !s.notes })),
  setLaser: (laser) => set({ laser }),
}));
