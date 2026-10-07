import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { getIcon, iconToSvg, type IconData } from "./icons";

export type Skeleton = ExcalidrawElementSkeleton;

export interface StyleCtx {
  /** 0 = clean, 1 = hand-drawn, 2 = very sketchy. */
  roughness: 0 | 1 | 2;
  stroke: string;
  fontFamily: number;
}

export const DEFAULT_STYLE: StyleCtx = { roughness: 1, stroke: "#1e1e1e", fontFamily: 5 };

export interface BuiltFile {
  id: string;
  /** Standalone SVG markup. */
  svg: string;
}

export interface BuiltItem {
  skeleton: Skeleton[];
  files: BuiltFile[];
  width: number;
  height: number;
  /** Stored on the first element's customData so inserted items stay identifiable. */
  meta: { kind: "block" | "kit" | "icon"; id: string };
}

type Opts = {
  bg?: string;
  stroke?: string;
  dashed?: boolean;
  round?: boolean | "pill";
  strokeWidth?: number;
  font?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  labelColor?: string;
};

/** Collects skeleton elements and icon files while an item is being assembled. */
export class Builder {
  readonly els: Skeleton[] = [];
  readonly files = new Map<string, BuiltFile>();
  private maxX = 0;
  private maxY = 0;

  constructor(readonly style: StyleCtx = DEFAULT_STYLE) {}

  private grow(x: number, y: number, w: number, h: number) {
    this.maxX = Math.max(this.maxX, x + w);
    this.maxY = Math.max(this.maxY, y + h);
  }

  private base(o: Opts) {
    return {
      strokeColor: o.stroke ?? this.style.stroke,
      backgroundColor: o.bg ?? "transparent",
      fillStyle: "solid" as const,
      strokeWidth: o.strokeWidth ?? 2,
      strokeStyle: o.dashed ? ("dashed" as const) : ("solid" as const),
      roughness: this.style.roughness,
    };
  }

  box(x: number, y: number, w: number, h: number, label?: string, o: Opts = {}) {
    this.grow(x, y, w, h);
    this.els.push({
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      ...this.base(o),
      roundness: o.round === "pill" ? { type: 2 } : o.round === false ? null : { type: 3 },
      ...(label
        ? {
            label: {
              text: label,
              fontSize: o.font ?? 16,
              fontFamily: this.style.fontFamily as never,
              textAlign: o.align ?? "center",
              verticalAlign: o.valign ?? "middle",
              strokeColor: o.labelColor ?? this.style.stroke,
            },
          }
        : {}),
    } as Skeleton);
    return this;
  }

  ellipse(x: number, y: number, w: number, h: number, label?: string, o: Opts = {}) {
    this.grow(x, y, w, h);
    this.els.push({
      type: "ellipse",
      x,
      y,
      width: w,
      height: h,
      ...this.base(o),
      ...(label
        ? {
            label: {
              text: label,
              fontSize: o.font ?? 16,
              fontFamily: this.style.fontFamily as never,
              strokeColor: o.labelColor ?? this.style.stroke,
            },
          }
        : {}),
    } as Skeleton);
    return this;
  }

  diamond(x: number, y: number, w: number, h: number, label?: string, o: Opts = {}) {
    this.grow(x, y, w, h);
    this.els.push({
      type: "diamond",
      x,
      y,
      width: w,
      height: h,
      ...this.base(o),
      ...(label
        ? {
            label: {
              text: label,
              fontSize: o.font ?? 14,
              fontFamily: this.style.fontFamily as never,
              strokeColor: o.labelColor ?? this.style.stroke,
            },
          }
        : {}),
    } as Skeleton);
    return this;
  }

  text(x: number, y: number, text: string, o: Opts & { size?: number } = {}) {
    const size = o.size ?? 16;
    const lines = text.split("\n");
    const w = Math.max(...lines.map((l) => l.length)) * size * 0.55;
    this.grow(x, y, w, lines.length * size * 1.25);
    this.els.push({
      type: "text",
      x,
      y,
      text,
      fontSize: size,
      fontFamily: this.style.fontFamily as never,
      textAlign: o.align ?? "left",
      strokeColor: o.labelColor ?? o.stroke ?? this.style.stroke,
    } as Skeleton);
    return this;
  }

  line(x: number, y: number, points: [number, number][], o: Opts = {}) {
    for (const [px, py] of points) this.grow(x + px, y + py, 0, 0);
    this.els.push({
      type: "line",
      x,
      y,
      points: points as never,
      ...this.base(o),
      roundness: null,
    } as Skeleton);
    return this;
  }

  /** Closed polygon (first point repeated) so it can be filled. */
  polygon(x: number, y: number, points: [number, number][], o: Opts = {}) {
    const first = points[0]!;
    return this.line(x, y, [...points, first], o);
  }

  arrow(
    x: number,
    y: number,
    points: [number, number][],
    o: Opts & {
      label?: string;
      start?: string | null;
      end?: string | null;
      elbow?: boolean;
    } = {},
  ) {
    for (const [px, py] of points) this.grow(x + px, y + py, 0, 0);
    this.els.push({
      type: "arrow",
      x,
      y,
      points: points as never,
      ...this.base(o),
      roundness: o.elbow ? null : { type: 2 },
      startArrowhead: (o.start ?? null) as never,
      endArrowhead: (o.end === undefined ? "arrow" : o.end) as never,
      ...(o.elbow ? { elbowed: true } : {}),
      ...(o.label
        ? {
            label: {
              text: o.label,
              fontSize: o.font ?? 14,
              fontFamily: this.style.fontFamily as never,
              strokeColor: this.style.stroke,
            },
          }
        : {}),
    } as Skeleton);
    return this;
  }

  /** Place an icon image. Missing icons are skipped so one bad reference never breaks an insert. */
  async icon(ref: string, x: number, y: number, size: number, color?: string) {
    const data = await getIcon(ref).catch(() => null);
    if (!data) return this;
    return this.iconData(ref, data, x, y, size, color);
  }

  /** Place an icon whose data is already in hand (e.g. fetched from the Iconify API and sanitized). */
  iconData(key: string, data: IconData, x: number, y: number, size: number, color?: string) {
    const col = color ?? this.style.stroke;
    const id = `ic_${key.replace(/[^a-z0-9]/gi, "_")}_${col.replace("#", "")}`;
    if (!this.files.has(id)) this.files.set(id, { id, svg: iconToSvg(data, { color: col }) });
    const ratio = data.width / data.height;
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    return this.imageEl(id, x + (size - w) / 2, y + (size - h) / 2, w, h);
  }

  /** Place an already-sanitized standalone SVG (imported by the user) as a vector image. */
  svgImage(id: string, svg: string, x: number, y: number, w: number, h: number) {
    this.files.set(id, { id, svg });
    return this.imageEl(id, x, y, w, h);
  }

  private imageEl(id: string, x: number, y: number, w: number, h: number) {
    this.grow(x, y, w, h);
    this.els.push({
      type: "image",
      x,
      y,
      width: w,
      height: h,
      fileId: id as never,
      status: "saved",
      scale: [1, 1],
    } as Skeleton);
    return this;
  }

  finish(meta: BuiltItem["meta"]): BuiltItem {
    return {
      skeleton: this.els,
      files: [...this.files.values()],
      width: this.maxX,
      height: this.maxY,
      meta,
    };
  }
}
