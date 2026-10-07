import type { El } from "@/smart/reconcile";

const esc = (s: string) => s.replace(/"/g, "#quot;").replace(/\n/g, "<br/>");

/**
 * Export flowchart-style diagrams to Mermaid. Nodes are shapes (rectangle `[ ]`, ellipse `(( ))`,
 * diamond `{ }`); edges are arrows bound at both ends. Anything else is ignored: this is deliberately
 * limited to what Mermaid flowcharts can express faithfully.
 */
export function elementsToMermaid(elements: readonly El[]): {
  text: string;
  nodes: number;
  edges: number;
} {
  const live = elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const labelOf = (id: string) =>
    live.find((t) => t.type === "text" && t.containerId === id)?.text as string | undefined;
  const shapes = live.filter((e) => ["rectangle", "ellipse", "diamond"].includes(e.type));
  const names = new Map<string, string>();
  shapes.forEach((s, i) => names.set(s.id, `n${i + 1}`));

  const arrows = live
    .filter((e) => e.type === "arrow" || e.type === "line")
    .filter(
      (a) =>
        a.startBinding &&
        a.endBinding &&
        names.has(a.startBinding.elementId) &&
        names.has(a.endBinding.elementId),
    );
  let dx = 0;
  let dy = 0;
  for (const a of arrows) {
    const s = byId.get(a.startBinding!.elementId)!;
    const t = byId.get(a.endBinding!.elementId)!;
    dx += Math.abs(t.x - s.x);
    dy += Math.abs(t.y - s.y);
  }
  const dir = arrows.length ? (dx > dy ? "LR" : "TD") : "TD";

  const lines = [`flowchart ${dir}`];
  for (const s of shapes) {
    const name = names.get(s.id)!;
    const text = esc(labelOf(s.id) ?? "");
    const l = `"${text || name}"`;
    lines.push(
      `  ${name}${s.type === "ellipse" ? `((${l}))` : s.type === "diamond" ? `{${l}}` : `[${l}]`}`,
    );
  }
  for (const a of arrows) {
    const from = names.get(a.startBinding!.elementId)!;
    const to = names.get(a.endBinding!.elementId)!;
    const dashed =
      (a as unknown as { strokeStyle?: string }).strokeStyle === "dashed" ||
      (a as unknown as { strokeStyle?: string }).strokeStyle === "dotted";
    const headless =
      a.type === "line" || (a as unknown as { endArrowhead?: unknown }).endArrowhead == null;
    const label = labelOf(a.id);
    const op = dashed ? (headless ? "-.-" : "-.->") : headless ? "---" : "-->";
    lines.push(
      `  ${from} ${label ? `${op.startsWith("-.") ? op.replace(/(-\.)(-?>?)/, `$1$2`) : op}|${esc(label)}|` : op} ${to}`,
    );
  }
  return { text: lines.join("\n") + "\n", nodes: shapes.length, edges: arrows.length };
}
