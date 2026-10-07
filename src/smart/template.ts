import { DEFAULT_STYLE, type Skeleton, type StyleCtx } from "@/library/builder";
import { sanitizeSvg } from "@/library/svg";
import { SB } from "./sbuilder";
import {
  normalizeProps,
  type Generated,
  type PropSchema,
  type Props,
  type SmartDef,
} from "./types";

/**
 * Declarative ("no code") Smart Component definition. It is plain JSON: it can be stored, shared and
 * embedded in a scene without ever executing user-supplied code. See docs/SMART_COMPONENTS.md.
 */
export const TEMPLATE_SCHEMA = "archboard.smart/1";

export const LIMITS = {
  params: 20,
  nodes: 200,
  expanded: 1000,
  repeat: 50,
  files: 20,
  fileBytes: 100_000,
  json: 400_000,
} as const;

export interface TemplateParam {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  default: string | number | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export interface TemplateElement {
  type: "rectangle" | "ellipse" | "diamond" | "text" | "line" | "arrow" | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Container label or text content. May contain `{{param}}` and `{{i}}` (1-based repeat index). */
  text?: string;
  points?: [number, number][];
  /** Arrow endpoints, by role. */
  start?: string;
  end?: string;
  /** For images: key into `files`. */
  file?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  roughness?: number;
  opacity?: number;
  roundness?: { type: number } | null;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
}

export interface TemplateNode {
  role: string;
  element: TemplateElement;
  repeat?: { count: string; dx: number; dy: number };
  /** Param key (boolean). Prefix with "!" to invert. */
  visibleIf?: string;
}

export interface TemplateDef {
  schema: typeof TEMPLATE_SCHEMA;
  id: string;
  name: string;
  version: number;
  description?: string;
  category?: string;
  keywords?: string[];
  params: TemplateParam[];
  nodes: TemplateNode[];
  ports?: { name: string; role: string; description?: string }[];
  /** Standalone SVG documents for image nodes. */
  files?: Record<string, string>;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const ROLE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/;
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,30}$/;
const TYPES = ["rectangle", "ellipse", "diamond", "text", "line", "arrow", "image"];
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*|i)\s*\}\}/g;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e6;

export type ParseResult = { ok: true; def: TemplateDef } | { ok: false; errors: string[] };

/** Strict validation. Returns every problem found so authors can fix them in one pass. */
export function parseTemplateDef(raw: unknown): ParseResult {
  const errors: string[] = [];
  const err = (m: string) => errors.length < 25 && errors.push(m);
  if (!isRec(raw)) return { ok: false, errors: ["Definition must be a JSON object."] };
  if (JSON.stringify(raw).length > LIMITS.json)
    return { ok: false, errors: ["Definition is too large."] };
  if (raw.schema !== TEMPLATE_SCHEMA) err(`"schema" must be "${TEMPLATE_SCHEMA}".`);
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id))
    err('"id" must be lowercase letters, digits and dashes (2–41 chars).');
  if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 60)
    err('"name" is required (max 60 chars).');
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1)
    err('"version" must be a positive integer.');

  const params: TemplateParam[] = [];
  if (!Array.isArray(raw.params)) err('"params" must be an array.');
  else {
    if (raw.params.length > LIMITS.params) err(`At most ${LIMITS.params} params.`);
    const seen = new Set<string>();
    raw.params.slice(0, LIMITS.params).forEach((p, i) => {
      const at = `params[${i}]`;
      if (!isRec(p)) return err(`${at} must be an object.`);
      if (typeof p.key !== "string" || !KEY_RE.test(p.key) || p.key === "i")
        return err(`${at}.key is invalid (letters, digits, _; not "i").`);
      if (seen.has(p.key)) return err(`${at}.key "${p.key}" is duplicated.`);
      seen.add(p.key);
      if (typeof p.label !== "string" || !p.label) return err(`${at}.label is required.`);
      if (!["text", "number", "boolean", "select"].includes(p.type as string))
        return err(`${at}.type must be text, number, boolean or select.`);
      if (p.type === "number") {
        if (!finite(p.min) || !finite(p.max) || (p.min as number) > (p.max as number))
          return err(`${at} needs numeric min <= max.`);
        if (
          !finite(p.default) ||
          (p.default as number) < (p.min as number) ||
          (p.default as number) > (p.max as number)
        )
          return err(`${at}.default must be within min..max.`);
      }
      if (p.type === "boolean" && typeof p.default !== "boolean")
        return err(`${at}.default must be true or false.`);
      if (p.type === "text" && typeof p.default !== "string")
        return err(`${at}.default must be a string.`);
      if (p.type === "select") {
        if (
          !Array.isArray(p.options) ||
          p.options.length < 1 ||
          p.options.length > 30 ||
          !p.options.every((o) => typeof o === "string")
        )
          return err(`${at}.options must list 1–30 strings.`);
        if (!(p.options as string[]).includes(p.default as string))
          return err(`${at}.default must be one of options.`);
      }
      params.push(p as unknown as TemplateParam);
    });
  }
  const byKey = new Map(params.map((p) => [p.key, p]));

  const files: Record<string, string> = {};
  if (raw.files !== undefined) {
    if (!isRec(raw.files)) err('"files" must be an object.');
    else {
      const entries = Object.entries(raw.files);
      if (entries.length > LIMITS.files) err(`At most ${LIMITS.files} files.`);
      for (const [k, v] of entries.slice(0, LIMITS.files)) {
        if (!ROLE_RE.test(k)) err(`files key "${k}" is invalid.`);
        else if (typeof v !== "string" || v.length > LIMITS.fileBytes)
          err(`files["${k}"] must be an SVG string under ${LIMITS.fileBytes / 1000} KB.`);
        else {
          try {
            files[k] = sanitizeSvg(v); // definitions are untrusted input too
          } catch (e) {
            err(`files["${k}"]: ${(e as Error).message}`);
          }
        }
      }
    }
  }

  const nodes: TemplateNode[] = [];
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0)
    err('"nodes" must be a non-empty array.');
  else {
    if (raw.nodes.length > LIMITS.nodes) err(`At most ${LIMITS.nodes} nodes.`);
    const roles = new Set<string>();
    for (const [i, nd] of raw.nodes.slice(0, LIMITS.nodes).entries()) {
      const at = `nodes[${i}]`;
      if (!isRec(nd) || !isRec(nd.element)) {
        err(`${at} needs a role and an element.`);
        continue;
      }
      if (typeof nd.role !== "string" || !ROLE_RE.test(nd.role) || nd.role.includes(":"))
        err(`${at}.role is invalid.`);
      else if (roles.has(nd.role)) err(`${at}.role "${nd.role}" is duplicated.`);
      else roles.add(nd.role);
      const el = nd.element;
      if (!TYPES.includes(el.type as string))
        err(`${at}.element.type must be one of ${TYPES.join(", ")}.`);
      for (const f of ["x", "y"] as const)
        if (!finite(el[f])) err(`${at}.element.${f} must be a number.`);
      for (const f of ["width", "height"] as const)
        if (el[f] !== undefined && (!finite(el[f]) || (el[f] as number) < 0))
          err(`${at}.element.${f} must be >= 0.`);
      if (el.type === "text" && typeof el.text !== "string")
        err(`${at}: text elements need "text".`);
      if (el.type === "image" && (typeof el.file !== "string" || !(el.file in files)))
        err(`${at}: image needs "file" naming an entry in "files".`);
      if (
        (el.type === "line" || el.type === "arrow") &&
        el.points !== undefined &&
        !(
          Array.isArray(el.points) &&
          el.points.length >= 2 &&
          el.points.length <= 200 &&
          el.points.every((p) => Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]))
        )
      )
        err(`${at}.element.points must be 2–200 [x, y] pairs.`);
      if (typeof el.text === "string") {
        for (const m of el.text.matchAll(PLACEHOLDER))
          if (m[1] !== "i" && !byKey.has(m[1]!)) err(`${at}: unknown parameter {{${m[1]}}}.`);
        if (el.text.length > 500) err(`${at}.element.text is too long.`);
      }
      if (nd.repeat !== undefined) {
        const r = nd.repeat;
        const p = isRec(r) ? byKey.get(String(r.count)) : undefined;
        if (!isRec(r) || !p || p.type !== "number")
          err(`${at}.repeat.count must name a number parameter.`);
        else {
          if (!finite(r.dx) || !finite(r.dy)) err(`${at}.repeat needs numeric dx and dy.`);
          if ((p.max ?? 0) > LIMITS.repeat)
            err(`Parameter "${p.key}" max may not exceed ${LIMITS.repeat}.`);
        }
      }
      if (nd.visibleIf !== undefined) {
        const k = String(nd.visibleIf).replace(/^!/, "");
        if (byKey.get(k)?.type !== "boolean") err(`${at}.visibleIf must name a boolean parameter.`);
      }
      nodes.push(nd as unknown as TemplateNode);
    }
    for (const [i, nd] of nodes.entries()) {
      for (const f of ["start", "end"] as const) {
        const target = nd.element[f];
        if (
          target !== undefined &&
          !roles.has(target) &&
          !nodes.some((o) => target.startsWith(`${o.role}-`))
        )
          err(`nodes[${i}].element.${f} references unknown role "${target}".`);
      }
    }
    if (isRec(raw) && Array.isArray(raw.ports)) {
      for (const [i, p] of raw.ports.entries()) {
        if (
          !isRec(p) ||
          typeof p.name !== "string" ||
          typeof p.role !== "string" ||
          !roles.has(p.role)
        )
          err(`ports[${i}] needs a name and an existing role.`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    def: {
      ...(raw as unknown as TemplateDef),
      files,
      ports: (raw.ports as TemplateDef["ports"]) ?? [],
    },
  };
}

const interpolate = (text: string, props: Props, i: number) =>
  text.replace(PLACEHOLDER, (_, k: string) => (k === "i" ? String(i) : String(props[k] ?? "")));

export function templateSchema(def: TemplateDef): PropSchema[] {
  return def.params.map((p): PropSchema => {
    if (p.type === "number")
      return {
        key: p.key,
        label: p.label,
        type: "number",
        min: p.min!,
        max: p.max!,
        step: 1,
        default: p.default as number,
      };
    if (p.type === "select")
      return {
        key: p.key,
        label: p.label,
        type: "select",
        options: p.options!,
        default: p.default as string,
      };
    if (p.type === "boolean")
      return { key: p.key, label: p.label, type: "boolean", default: p.default as boolean };
    return {
      key: p.key,
      label: p.label,
      type: "text",
      default: p.default as string,
      maxLength: 60,
    };
  });
}

const STYLE_KEYS = [
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

/** Pure: expand a validated template with the given props. */
export function generateFromTemplate(
  def: TemplateDef,
  rawProps: Props,
  style: StyleCtx = DEFAULT_STYLE,
): Generated {
  const schema = templateSchema(def);
  const props = normalizeProps(schema, rawProps);
  const sb = new SB(style);
  const repeated = new Set(def.nodes.filter((n) => n.repeat).map((n) => n.role));
  const counts = new Map<string, number>();
  let budget = LIMITS.expanded;

  const visible = (n: TemplateNode) => {
    if (!n.visibleIf) return true;
    const neg = n.visibleIf.startsWith("!");
    const v = props[n.visibleIf.replace(/^!/, "")] === true;
    return neg ? !v : v;
  };
  const countOf = (n: TemplateNode) =>
    n.repeat ? Math.max(0, Math.min(LIMITS.repeat, Math.floor(Number(props[n.repeat.count])))) : 1;
  for (const n of def.nodes) counts.set(n.role, visible(n) ? countOf(n) : 0);

  // Resolve an arrow endpoint role: a repeated target follows the arrow's own repeat index.
  const resolve = (target: string, index: number, selfRepeats: boolean): string | null => {
    if (repeated.has(target)) {
      const c = counts.get(target) ?? 0;
      if (c === 0) return null;
      const i = selfRepeats ? Math.min(index, c) : 1;
      return `${target}-${i}`;
    }
    return (counts.get(target) ?? (target.match(/-\d+$/) ? 1 : 0)) > 0 ? target : null;
  };

  const shapes = def.nodes.filter((n) => n.element.type !== "arrow");
  const arrows = def.nodes.filter((n) => n.element.type === "arrow");
  const emitted = new Set<string>();

  const emit = (n: TemplateNode, idx: number, total: number) => {
    if (budget-- <= 0) return;
    const e = n.element;
    const role = n.repeat ? `${n.role}-${idx}` : n.role;
    const ox = n.repeat ? n.repeat.dx * (idx - 1) : 0;
    const oy = n.repeat ? n.repeat.dy * (idx - 1) : 0;
    const style = Object.fromEntries(
      STYLE_KEYS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]),
    );
    const base = { x: e.x + ox, y: e.y + oy, ...style };
    const text = e.text === undefined ? undefined : interpolate(e.text, props, idx);
    const label =
      text !== undefined && e.type !== "text"
        ? {
            text,
            fontSize: e.fontSize ?? 15,
            fontFamily: (e.fontFamily ?? style_font(style)) as never,
            textAlign: e.textAlign as never,
            verticalAlign: e.verticalAlign as never,
          }
        : undefined;
    void total;
    let sk: Skeleton;
    switch (e.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
        sk = {
          type: e.type,
          ...base,
          width: e.width ?? 100,
          height: e.height ?? 60,
          ...(label ? { label } : {}),
        } as Skeleton;
        break;
      case "text":
        sk = {
          type: "text",
          ...base,
          text: text ?? "",
          fontSize: e.fontSize ?? 16,
          fontFamily: (e.fontFamily ?? style_font(style)) as never,
          textAlign: e.textAlign as never,
        } as Skeleton;
        break;
      case "line":
        sk = {
          type: "line",
          ...base,
          points: (e.points ?? [
            [0, 0],
            [e.width ?? 100, e.height ?? 0],
          ]) as never,
        } as Skeleton;
        break;
      case "image": {
        const key = e.file!;
        const id = `ic_custom_${def.id}_${key}`;
        sb.files.set(id, { id, svg: def.files![key]! });
        sk = {
          type: "image",
          ...base,
          width: e.width ?? 48,
          height: e.height ?? 48,
          fileId: id as never,
          status: "saved",
          scale: [1, 1],
        } as Skeleton;
        break;
      }
      default:
        return;
    }
    sb.parts.push({
      role,
      skeleton: { ...sk, id: role } as Skeleton,
      node: e.type !== "text" && e.type !== "line",
    });
    emitted.add(role);
  };

  for (const n of shapes)
    for (let i = 1; i <= (counts.get(n.role) ?? 0); i++) emit(n, i, counts.get(n.role) ?? 1);

  for (const n of arrows) {
    const total = counts.get(n.role) ?? 0;
    for (let i = 1; i <= total; i++) {
      if (budget-- <= 0) break;
      const e = n.element;
      const role = n.repeat ? `${n.role}-${i}` : n.role;
      const start = e.start ? resolve(e.start, i, !!n.repeat) : null;
      const end = e.end ? resolve(e.end, i, !!n.repeat) : null;
      const style = Object.fromEntries(
        STYLE_KEYS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]),
      );
      const ox = n.repeat ? n.repeat.dx * (i - 1) : 0;
      const oy = n.repeat ? n.repeat.dy * (i - 1) : 0;
      const bound = start && end && emitted.has(start) && emitted.has(end);
      const text = e.text === undefined ? undefined : interpolate(e.text, props, i);
      sb.parts.push({
        role,
        skeleton: {
          type: "arrow",
          id: role,
          x: e.x + ox,
          y: e.y + oy,
          ...(bound
            ? { start: { id: start }, end: { id: end } }
            : {
                points: (e.points ?? [
                  [0, 0],
                  [e.width ?? 100, e.height ?? 0],
                ]) as never,
              }),
          ...style,
          ...(text
            ? {
                label: {
                  text,
                  fontSize: e.fontSize ?? 14,
                  fontFamily: (e.fontFamily ?? style_font(style)) as never,
                },
              }
            : {}),
        } as Skeleton,
      });
      emitted.add(role);
    }
  }

  const ports = (def.ports ?? [])
    .map((p) => ({
      name: p.name,
      role: repeated.has(p.role) ? `${p.role}-1` : p.role,
      description: p.description ?? p.name,
    }))
    .filter((p) => emitted.has(p.role));
  return { parts: sb.parts, ports, files: [...sb.files.values()] };
}

// Font family defaults to the builder's configured family unless the element sets one.
function style_font(_style: Record<string, unknown>): number {
  void _style;
  return DEFAULT_STYLE.fontFamily;
}

export function templateToSmartDef(def: TemplateDef): SmartDef {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    category: def.category ?? "Custom",
    description: def.description ?? "Custom component",
    keywords: def.keywords ?? [],
    schema: templateSchema(def),
    generate: async (props) => generateFromTemplate(def, props),
    custom: def,
  };
}
