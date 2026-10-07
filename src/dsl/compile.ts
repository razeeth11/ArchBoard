import { CATEGORY_COLORS } from "@/library/blocks";
import {
  Builder,
  DEFAULT_STYLE,
  type BuiltFile,
  type Skeleton,
  type StyleCtx,
} from "@/library/builder";
import type { DslProgram } from "./parser";

const W = 160;
const H = 92;

export interface CompiledDsl {
  skeleton: Skeleton[];
  files: BuiltFile[];
  /** Ids of node shapes (replicas expanded), used by tests and layout. */
  nodeIds: string[];
}

export const unitIds = (id: string, replicas: number): string[] =>
  replicas > 1 ? Array.from({ length: replicas }, (_, i) => `${id}#${i + 1}`) : [id];

/** Turn a parsed program into converter skeletons with stable ids (positions are fixed by layout later). */
export async function compileDsl(
  program: DslProgram,
  style: StyleCtx = DEFAULT_STYLE,
): Promise<CompiledDsl> {
  const b = new Builder(style);
  const nodeIds: string[] = [];
  let n = 0;
  for (const node of program.nodes) {
    const colors = CATEGORY_COLORS[node.def.category];
    for (const [i, uid] of unitIds(node.id, node.replicas).entries()) {
      const x = (n % 4) * (W + 60);
      const y = Math.floor(n / 4) * (H + 60);
      n++;
      const label = node.replicas > 1 ? `${node.label} ${i + 1}` : node.label;
      b.box(x, y, W, H, label, {
        bg: colors.bg,
        stroke: colors.stroke,
        valign: "bottom",
        font: 15,
      });
      (b.els[b.els.length - 1] as { id?: string }).id = uid;
      await b.icon(node.tech?.icon ?? node.def.icon, x + (W - 40) / 2, y + 10, 40, "#1e1e1e");
      nodeIds.push(uid);
    }
  }
  const replicasOf = new Map(program.nodes.map((nd) => [nd.id, nd.replicas]));
  for (const e of program.edges) {
    const from = unitIds(e.from, replicasOf.get(e.from) ?? 1);
    const to = unitIds(e.to, replicasOf.get(e.to) ?? 1);
    const pairs: [string, string][] =
      from.length === to.length && from.length > 1
        ? from.map((f, i) => [f, to[i]!])
        : from.flatMap((f) => to.map((t) => [f, t] as [string, string]));
    for (const [f, t] of pairs) {
      b.els.push({
        type: "arrow",
        x: 0,
        y: 0,
        start: { id: f },
        end: { id: t },
        strokeColor: style.stroke,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: e.dashed ? "dashed" : "solid",
        roughness: style.roughness,
        roundness: { type: 2 },
        startArrowhead: e.both ? "arrow" : null,
        endArrowhead: "arrow",
        ...(e.label
          ? { label: { text: e.label, fontSize: 13, fontFamily: style.fontFamily as never } }
          : {}),
      } as unknown as Skeleton);
    }
  }
  return { skeleton: b.els, files: [...b.files.values()], nodeIds };
}
