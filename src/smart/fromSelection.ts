import { sanitizeSvg } from "@/library/svg";
import type { El } from "./reconcile";
import {
  LIMITS,
  TEMPLATE_SCHEMA,
  type TemplateDef,
  type TemplateElement,
  type TemplateNode,
  type TemplateParam,
} from "./template";

type Rec = Record<string, unknown>;

export interface SelectionOptions {
  id: string;
  name: string;
  description?: string;
  /** element id (container, standalone text) → parameter that replaces its text. */
  textParams: Record<string, { key: string; label: string }>;
  /** One part (an element id) repeated `count` times. */
  repeat?: {
    elementId: string;
    key: string;
    label: string;
    max: number;
    direction: "right" | "down";
    gap: number;
  };
  /** Files for image elements (id → SVG text). Non-SVG images are skipped. */
  files?: Record<string, string>;
}

export interface SelectionResult {
  def: TemplateDef;
  warnings: string[];
}

const STYLE = [
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "roundness",
  "startArrowhead",
  "endArrowhead",
] as const;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Convert live elements into a declarative definition. Bound text becomes the container's label;
 * chosen labels become text parameters; one chosen part can repeat N times.
 */
export function selectionToTemplate(selection: El[], o: SelectionOptions): SelectionResult {
  const warnings: string[] = [];
  const els = selection.filter((e) => !e.isDeleted);
  if (!els.length) throw new Error("Select at least one shape first.");
  const byId = new Map(els.map((e) => [e.id, e]));
  const boundText = new Map<string, El>();
  for (const e of els)
    if (e.type === "text" && e.containerId && byId.has(e.containerId))
      boundText.set(e.containerId, e);

  const roles = new Map<string, string>();
  const used = new Set<string>();
  const roleFor = (e: El, text: string | undefined) => {
    const base = slug(text ?? "") || `${e.type}`;
    let r = base;
    for (let i = 2; used.has(r); i++) r = `${base}-${i}`;
    used.add(r);
    roles.set(e.id, r);
    return r;
  };

  const params: TemplateParam[] = [];
  const addParam = (p: TemplateParam) => {
    if (!params.some((x) => x.key === p.key)) params.push(p);
  };
  const files: Record<string, string> = {};
  const nodes: TemplateNode[] = [];

  const shapes = els.filter(
    (e) => !(e.type === "text" && e.containerId && byId.has(e.containerId)),
  );
  // Normalize against the visible shapes only (bound text always lies inside its container).
  const minX = Math.min(...shapes.map((e) => e.x));
  const minY = Math.min(...shapes.map((e) => e.y));
  // Shapes first so arrows can reference their roles.
  const ordered = [
    ...shapes.filter((e) => e.type !== "arrow"),
    ...shapes.filter((e) => e.type === "arrow"),
  ];

  for (const e of ordered) {
    const bt = boundText.get(e.id);
    const rawText = (bt?.text ?? (e.type === "text" ? (e.text as string) : undefined)) as
      string | undefined;
    const role = roleFor(e, rawText);
    const tp = o.textParams[e.id] ?? (bt ? o.textParams[bt.id] : undefined);
    let text = rawText;
    if (rawText !== undefined && tp) {
      addParam({ key: tp.key, label: tp.label, type: "text", default: rawText });
      text = `{{${tp.key}}}`;
    }
    const el: TemplateElement = {
      type: e.type as TemplateElement["type"],
      x: round(e.x - minX),
      y: round(e.y - minY),
      width: round(e.width),
      height: round(e.height),
    };
    for (const k of STYLE) if (e[k] !== undefined) (el as unknown as Rec)[k] = e[k];
    if (text !== undefined) el.text = text;
    const anyEl = e as unknown as Rec;
    if (e.type === "text") {
      for (const k of ["fontSize", "fontFamily", "textAlign"] as const)
        if (anyEl[k] !== undefined) (el as unknown as Rec)[k] = anyEl[k];
      delete el.width;
      delete el.height;
    } else if (bt) {
      for (const k of ["fontSize", "fontFamily", "textAlign", "verticalAlign"] as const)
        if ((bt as unknown as Rec)[k] !== undefined)
          (el as unknown as Rec)[k] = (bt as unknown as Rec)[k];
    }
    if (e.type === "line" || e.type === "arrow") {
      el.points = (e.points ?? []).map(([px, py]) => [round(px), round(py)]);
      if (e.type === "arrow") {
        const s = e.startBinding && roles.get(e.startBinding.elementId);
        const t = e.endBinding && roles.get(e.endBinding.elementId);
        if (s) el.start = s;
        if (t) el.end = t;
      }
    }
    if (e.type === "image") {
      const fileId = anyEl.fileId as string | undefined;
      const svg = fileId ? o.files?.[fileId] : undefined;
      if (!svg) {
        warnings.push(
          "A non-SVG image was skipped (only vector icons can be part of a custom component).",
        );
        used.delete(role);
        continue;
      }
      try {
        files[role] = sanitizeSvg(svg);
        el.file = role;
      } catch {
        warnings.push("An image could not be sanitized and was skipped.");
        used.delete(role);
        continue;
      }
    }
    const node: TemplateNode = { role, element: el };
    if (o.repeat && (o.repeat.elementId === e.id || (bt && o.repeat.elementId === bt.id))) {
      const dx = o.repeat.direction === "right" ? round(e.width + o.repeat.gap) : 0;
      const dy = o.repeat.direction === "down" ? round(e.height + o.repeat.gap) : 0;
      const max = Math.min(LIMITS.repeat, Math.max(1, o.repeat.max));
      addParam({
        key: o.repeat.key,
        label: o.repeat.label,
        type: "number",
        default: 1,
        min: 1,
        max,
      } as TemplateParam);
      node.repeat = { count: o.repeat.key, dx, dy };
    }
    nodes.push(node);
  }

  if (nodes.length > LIMITS.nodes) throw new Error(`Too many shapes (max ${LIMITS.nodes}).`);
  const def: TemplateDef = {
    schema: TEMPLATE_SCHEMA,
    id: o.id,
    name: o.name,
    version: 1,
    description: o.description ?? `Custom component “${o.name}”.`,
    category: "Custom",
    keywords: [],
    params,
    nodes,
    ports: nodes
      .filter(
        (n) => n.element.type !== "arrow" && n.element.type !== "text" && n.element.type !== "line",
      )
      .slice(0, 4)
      .map((n) => ({ name: n.role, role: n.role, description: n.role })),
    files,
  };
  return { def, warnings };
}
