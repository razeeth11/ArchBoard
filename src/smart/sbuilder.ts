import { CATEGORY_COLORS, type BlockCategory } from "@/library/blocks";
import { DEFAULT_STYLE, type Skeleton, type StyleCtx } from "@/library/builder";
import { getIcon, iconToSvg } from "@/library/icons";
import type { Generated, Part, Port } from "./types";

type NodeOpts = {
  cat?: BlockCategory;
  icon?: string;
  w?: number;
  h?: number;
  dashed?: boolean;
  bg?: string;
  stroke?: string;
  shape?: "rectangle" | "ellipse" | "diamond";
  font?: number;
};

type EdgeOpts = {
  label?: string;
  dashed?: boolean;
  /** Arrowhead on the `from` end. */
  start?: string | null;
  end?: string | null;
  stroke?: string;
};

/**
 * Builds the parts of a Smart Component. Every part has a stable `role`; the role becomes the
 * element id, which is what makes regeneration in place possible. Roles must be unique and derived
 * only from props (never from random values or time).
 */
export class SB {
  readonly parts: Part[] = [];
  readonly ports: Port[] = [];
  readonly files = new Map<string, { id: string; svg: string }>();
  private readonly roles = new Set<string>();
  private readonly wraps: { role: string; title: string; members: string[]; o: NodeOpts }[] = [];

  constructor(readonly style: StyleCtx = DEFAULT_STYLE) {}

  private add(role: string, skeleton: Skeleton, node = false) {
    if (this.roles.has(role)) throw new Error(`Duplicate role "${role}"`);
    this.roles.add(role);
    this.parts.push({ role, skeleton: { ...skeleton, id: role } as Skeleton, node });
  }

  private base(stroke: string | undefined, bg: string | undefined, dashed?: boolean) {
    return {
      strokeColor: stroke ?? this.style.stroke,
      backgroundColor: bg ?? "transparent",
      fillStyle: "solid" as const,
      strokeWidth: 2,
      strokeStyle: dashed ? ("dashed" as const) : ("solid" as const),
      roughness: this.style.roughness,
    };
  }

  /** Icon card: coloured container, icon on top, bound label below. */
  async node(role: string, x: number, y: number, label: string, o: NodeOpts = {}) {
    const c = CATEGORY_COLORS[o.cat ?? "Compute"];
    const w = o.w ?? 150;
    const h = o.h ?? 88;
    const shape = o.shape ?? "rectangle";
    const hasIcon = !!o.icon;
    this.add(
      role,
      {
        type: shape,
        x,
        y,
        width: w,
        height: h,
        ...this.base(o.stroke ?? c.stroke, o.bg ?? c.bg, o.dashed),
        ...(shape === "rectangle" ? { roundness: { type: 3 } } : {}),
        label: {
          text: label,
          fontSize: o.font ?? 15,
          fontFamily: this.style.fontFamily as never,
          verticalAlign: hasIcon ? "bottom" : "middle",
          strokeColor: this.style.stroke,
        },
      } as Skeleton,
      true,
    );
    if (hasIcon) {
      const size = Math.min(36, h - 44);
      await this.icon(`${role}:icon`, o.icon!, x + (w - size) / 2, y + 10, size);
    }
  }

  /** Plain container with optional centred label. */
  box(role: string, x: number, y: number, w: number, h: number, label?: string, o: NodeOpts = {}) {
    this.add(
      role,
      {
        type: o.shape ?? "rectangle",
        x,
        y,
        width: w,
        height: h,
        ...this.base(o.stroke, o.bg, o.dashed),
        roundness: o.shape === "rectangle" || !o.shape ? { type: 3 } : null,
        ...(label
          ? {
              label: {
                text: label,
                fontSize: o.font ?? 14,
                fontFamily: this.style.fontFamily as never,
                strokeColor: this.style.stroke,
              },
            }
          : {}),
      } as Skeleton,
      true,
    );
  }

  /** Dashed boundary with its title at the top-left. */
  frame(role: string, x: number, y: number, w: number, h: number, title: string, o: NodeOpts = {}) {
    this.add(role, {
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      ...this.base(o.stroke ?? "#868e96", o.bg, o.dashed ?? true),
      roundness: { type: 3 },
      label: {
        text: title,
        fontSize: 15,
        fontFamily: this.style.fontFamily as never,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: this.style.stroke,
      },
    } as Skeleton);
  }

  /**
   * Boundary drawn around other parts once the layout is known. Wraps are placed underneath
   * the content (largest first), so the outermost wrap should be given the role "root".
   */
  wrap(role: string, title: string, members: string[], o: NodeOpts = {}) {
    if (this.roles.has(role)) throw new Error(`Duplicate role "${role}"`);
    this.roles.add(role);
    this.wraps.push({ role, title, members, o });
  }

  text(
    role: string,
    x: number,
    y: number,
    text: string,
    o: { size?: number; stroke?: string; align?: "left" | "center" | "right" } = {},
  ) {
    this.add(role, {
      type: "text",
      x,
      y,
      text,
      fontSize: o.size ?? 14,
      fontFamily: this.style.fontFamily as never,
      textAlign: o.align ?? "left",
      strokeColor: o.stroke ?? this.style.stroke,
    } as Skeleton);
  }

  /** Arrow bound to two parts by role. The converter computes its geometry from the endpoints. */
  edge(role: string, from: string, to: string, o: EdgeOpts = {}) {
    if (!this.roles.has(from) || !this.roles.has(to)) {
      throw new Error(`Edge "${role}" references an unknown role (${from} → ${to})`);
    }
    this.add(role, {
      type: "arrow",
      x: 0,
      y: 0,
      start: { id: from },
      end: { id: to },
      ...this.base(o.stroke, undefined, o.dashed),
      roundness: { type: 2 },
      startArrowhead: (o.start ?? null) as never,
      endArrowhead: (o.end === undefined ? "arrow" : o.end) as never,
      ...(o.label
        ? {
            label: {
              text: o.label,
              fontSize: 13,
              fontFamily: this.style.fontFamily as never,
              strokeColor: this.style.stroke,
            },
          }
        : {}),
    } as Skeleton);
  }

  async icon(role: string, ref: string, x: number, y: number, size: number, color?: string) {
    const data = await getIcon(ref).catch(() => null);
    if (!data) return;
    const col = color ?? this.style.stroke;
    const id = `ic_${ref.replace(/[^a-z0-9]/gi, "_")}_${col.replace("#", "")}`;
    if (!this.files.has(id)) this.files.set(id, { id, svg: iconToSvg(data, { color: col }) });
    const ratio = data.width / data.height;
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    this.add(role, {
      type: "image",
      x: x + (size - w) / 2,
      y: y + (size - h) / 2,
      width: w,
      height: h,
      fileId: id as never,
      status: "saved",
      scale: [1, 1],
    } as Skeleton);
  }

  port(name: string, role: string, description: string) {
    if (!this.roles.has(role)) throw new Error(`Port "${name}" targets unknown role "${role}"`);
    this.ports.push({ name, role, description });
  }

  has(role: string) {
    return this.roles.has(role);
  }

  done(): Generated {
    const sized = new Map(
      this.parts.map((p) => {
        const k = p.skeleton as unknown as {
          x: number;
          y: number;
          width?: number;
          height?: number;
        };
        return [p.role, k] as const;
      }),
    );
    const frames = this.wraps
      .map((w) => {
        const boxes = w.members
          .map((m) => sized.get(m))
          .filter(
            (b): b is { x: number; y: number; width: number; height: number } =>
              !!b && b.width !== undefined,
          );
        if (!boxes.length) throw new Error(`Wrap "${w.role}" has no sized members`);
        const pad = 24;
        const x = Math.min(...boxes.map((b) => b.x)) - pad;
        const y = Math.min(...boxes.map((b) => b.y)) - pad - 22;
        const x2 = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
        const y2 = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
        const skeleton = {
          type: "rectangle",
          id: w.role,
          x,
          y,
          width: x2 - x,
          height: y2 - y,
          ...this.base(w.o.stroke ?? "#868e96", w.o.bg, w.o.dashed ?? true),
          roundness: { type: 3 },
          label: {
            text: w.title,
            fontSize: 15,
            fontFamily: this.style.fontFamily as never,
            textAlign: "left",
            verticalAlign: "top",
            strokeColor: this.style.stroke,
          },
        } as Skeleton;
        sized.set(w.role, skeleton as never);
        return { part: { role: w.role, skeleton } as Part, area: (x2 - x) * (y2 - y) };
      })
      // Wraps can contain other wraps, so size them largest-first for z-order only.
      .sort((a, b) => b.area - a.area)
      .map((f) => f.part);
    return {
      parts: [...frames, ...this.parts],
      ports: this.ports,
      files: [...this.files.values()],
    };
  }
}
