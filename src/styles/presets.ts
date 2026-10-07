import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface StylePreset {
  id: string;
  name: string;
  builtin?: boolean;
  roughness: 0 | 1 | 2;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  /** Excalidraw font family id: 5 hand-drawn, 6 normal, 8 code. */
  fontFamily: number;
  rounded: boolean;
  /** Optional canvas colour (blueprint). */
  canvas?: string;
}

export const BUILTIN_PRESETS: StylePreset[] = [
  {
    id: "sketchy",
    name: "Sketchy",
    builtin: true,
    roughness: 2,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    fontFamily: 5,
    rounded: true,
  },
  {
    id: "clean",
    name: "Clean",
    builtin: true,
    roughness: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "#f1f3f5",
    fillStyle: "solid",
    strokeWidth: 2,
    fontFamily: 6,
    rounded: true,
  },
  {
    id: "blueprint",
    name: "Blueprint",
    builtin: true,
    roughness: 0,
    strokeColor: "#e7f0ff",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    fontFamily: 8,
    rounded: false,
    canvas: "#0b3d91",
  },
  {
    id: "mono",
    name: "Mono",
    builtin: true,
    roughness: 0,
    strokeColor: "#111111",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    strokeWidth: 1,
    fontFamily: 8,
    rounded: false,
  },
  {
    id: "pastel",
    name: "Pastel",
    builtin: true,
    roughness: 1,
    strokeColor: "#495057",
    backgroundColor: "#fff3bf",
    fillStyle: "solid",
    strokeWidth: 2,
    fontFamily: 5,
    rounded: true,
  },
];

export const DEFAULT_BRAND = ["#1e1e1e", "#1971c2", "#2f9e44", "#f08c00", "#e03131", "#ffffff"];
const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: string) => HEX.test(s);

const SHAPES = new Set(["rectangle", "diamond", "ellipse"]);
const bumpFields = () => ({
  versionNonce: Math.floor(Math.random() * 2 ** 31),
  updated: Date.now(),
});

/** Re-style one element with a preset. Arrows and lines only take stroke; text takes font + colour. */
export function applyPresetTo(e: ExcalidrawElement, p: StylePreset): ExcalidrawElement {
  if (e.isDeleted) return e;
  const base = { ...e, version: e.version + 1, ...bumpFields() } as Record<string, unknown>;
  if (e.type === "text") {
    return {
      ...base,
      strokeColor: p.strokeColor,
      fontFamily: p.fontFamily,
    } as unknown as ExcalidrawElement;
  }
  base.strokeColor = p.strokeColor;
  base.strokeWidth = p.strokeWidth;
  base.roughness = p.roughness;
  if (SHAPES.has(e.type)) {
    base.backgroundColor = p.backgroundColor;
    base.fillStyle = p.fillStyle;
    if (e.type !== "ellipse") base.roundness = p.rounded ? { type: 3 } : null;
  }
  return base as unknown as ExcalidrawElement;
}

export function presetFromElement(
  e: ExcalidrawElement,
  name: string,
  fontFamily: number,
): StylePreset {
  const x = e as unknown as Record<string, unknown>;
  return {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim().slice(0, 40) || "My style",
    roughness: ([0, 1, 2].includes(Number(x.roughness)) ? x.roughness : 1) as 0 | 1 | 2,
    strokeColor: String(x.strokeColor ?? "#1e1e1e"),
    backgroundColor: String(x.backgroundColor ?? "transparent"),
    fillStyle: (["solid", "hachure", "cross-hatch"].includes(String(x.fillStyle))
      ? x.fillStyle
      : "solid") as StylePreset["fillStyle"],
    strokeWidth: Number(x.strokeWidth ?? 2),
    fontFamily,
    rounded: !!x.roundness,
  };
}

/** Defensive parse for presets read back from storage. */
export function sanitizePresets(raw: unknown): StylePreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is StylePreset =>
        !!p &&
        typeof p === "object" &&
        typeof (p as StylePreset).id === "string" &&
        typeof (p as StylePreset).name === "string",
    )
    .map((p) => ({
      ...p,
      builtin: false,
      name: p.name.slice(0, 40),
      roughness: ([0, 1, 2].includes(p.roughness) ? p.roughness : 1) as 0 | 1 | 2,
    }))
    .slice(0, 50);
}
