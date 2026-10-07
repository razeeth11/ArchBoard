import type { Skeleton } from "@/library/builder";

export type PropSchema =
  | {
      key: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step?: number;
      default: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: string[];
      default: string;
      help?: string;
    }
  | { key: string; label: string; type: "boolean"; default: boolean; help?: string }
  | {
      key: string;
      label: string;
      type: "text";
      default: string;
      maxLength?: number;
      help?: string;
    };

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

/** One generated piece. `role` is its stable identity across regenerations. */
export interface Part {
  role: string;
  /** Skeleton for the converter. `id` is assigned from the role when materialized. */
  skeleton: Skeleton;
  /** True for elements arrows may bind to / that count as a "node". */
  node?: boolean;
}

/** Named connection point. Arrows connect to the element generated for `role`. */
export interface Port {
  name: string;
  role: string;
  description: string;
}

export interface Generated {
  parts: Part[];
  ports: Port[];
  /** Icon files needed by image parts. */
  files: { id: string; svg: string }[];
}

export interface SmartDef {
  id: string;
  name: string;
  /** Bump when the generated structure changes. */
  version: number;
  category: string;
  description: string;
  keywords: string[];
  schema: PropSchema[];
  /** Pure: same props in, same output out. Never reads the scene. */
  generate: (props: Props) => Promise<Generated>;
  /** Present for user-authored definitions so instances stay regenerable anywhere. */
  custom?: unknown;
}

/** Stored in `customData.smartComponent` on every element of an instance. */
export interface SmartMeta {
  id: string;
  version: number;
  instance: string;
  role: string;
  /** Only on the root element. */
  props?: Props;
  /** Only on the root element of custom components: the embedded definition. */
  def?: unknown;
}

export const META_KEY = "smartComponent";

export function defaultsOf(schema: PropSchema[]): Props {
  return Object.fromEntries(schema.map((p) => [p.key, p.default]));
}

/** Clamp and coerce arbitrary input to the schema; unknown keys are dropped. */
export function normalizeProps(schema: PropSchema[], raw: unknown): Props {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: Props = {};
  for (const p of schema) {
    const v = input[p.key];
    if (p.type === "number") {
      const n = typeof v === "number" && Number.isFinite(v) ? v : p.default;
      const step = p.step ?? 1;
      out[p.key] = Math.min(p.max, Math.max(p.min, Math.round(n / step) * step));
    } else if (p.type === "select") {
      out[p.key] = typeof v === "string" && p.options.includes(v) ? v : p.default;
    } else if (p.type === "boolean") {
      out[p.key] = typeof v === "boolean" ? v : p.default;
    } else {
      out[p.key] = typeof v === "string" ? v.slice(0, p.maxLength ?? 60) : p.default;
    }
  }
  return out;
}
