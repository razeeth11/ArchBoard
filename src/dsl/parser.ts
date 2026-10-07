import { KINDS, KIND_NAMES, suggest, type KindDef } from "./kinds";

export interface Diagnostic {
  /** 1-based. */
  line: number;
  /** 1-based column of the first character. */
  col: number;
  len: number;
  message: string;
}

export interface DslNode {
  id: string;
  kind: string;
  def: KindDef;
  tech?: { icon: string; name: string };
  label: string;
  replicas: number;
  line: number;
}

export interface DslEdge {
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  both: boolean;
  line: number;
}

export interface DslProgram {
  nodes: DslNode[];
  edges: DslEdge[];
  title?: string;
  /** Layout requested with `direction` / `layout`. */
  layout: "right" | "down" | "tree" | "radial" | "layered";
}

export interface ParseResult {
  program: DslProgram;
  diagnostics: Diagnostic[];
}

type Tok =
  | { t: "word"; v: string; col: number; len: number }
  | { t: "str"; v: string; col: number; len: number }
  | { t: "num"; v: number; col: number; len: number }
  | { t: "edge"; dashed: boolean; both: boolean; label?: string; col: number; len: number }
  | { t: "lbr" | "rbr"; col: number; len: number }
  | { t: "bad"; v: string; col: number; len: number; message: string };

const MAX_REPLICAS = 12;
const MAX_NODES = 150;

/** Edges: `->`, `-->`, `<->`, `-[label]->`, `--[label]->`. */
const EDGE_LABELLED = /^(<)?(-{1,2})\[([^\]\n]*)\]-{1,2}>/;
const EDGE_PLAIN = /^(<)?(-{1,2})>/;

function tokenize(line: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i]!;
    if (c === " " || c === "\t" || c === ",") {
      i++;
      continue;
    }
    if (c === "#" || (c === "/" && line[i + 1] === "/")) break;
    const col = i + 1;
    if (c === '"') {
      let j = i + 1;
      let v = "";
      let closed = false;
      while (j < line.length) {
        if (line[j] === "\\" && j + 1 < line.length) {
          v += line[j + 1];
          j += 2;
          continue;
        }
        if (line[j] === '"') {
          closed = true;
          break;
        }
        v += line[j];
        j++;
      }
      if (!closed) {
        toks.push({
          t: "bad",
          v: line.slice(i),
          col,
          len: line.length - i,
          message: "Unterminated string: add a closing quote.",
        });
        break;
      }
      toks.push({ t: "str", v, col, len: j - i + 1 });
      i = j + 1;
      continue;
    }
    if (c === "[" || c === "]") {
      toks.push({ t: c === "[" ? "lbr" : "rbr", col, len: 1 });
      i++;
      continue;
    }
    if (c === "-" || c === "<") {
      const rest = line.slice(i);
      const m = EDGE_LABELLED.exec(rest) ?? EDGE_PLAIN.exec(rest);
      if (m) {
        toks.push({
          t: "edge",
          dashed: m[2] === "--",
          both: m[1] === "<",
          label: m[3]?.trim() || undefined,
          col,
          len: m[0].length,
        });
        i += m[0].length;
        continue;
      }
    }
    const word = /^[A-Za-z_][\w.-]*/.exec(line.slice(i));
    if (word) {
      // A hyphen followed by '>' belongs to an edge, not to the word.
      let v = word[0];
      const cut = v.search(/-+>?$/);
      if (cut > 0 && /-+$/.test(v) && line[i + v.length] === ">") v = v.slice(0, cut);
      toks.push({ t: "word", v, col, len: v.length });
      i += v.length;
      continue;
    }
    const num = /^\d+/.exec(line.slice(i));
    if (num) {
      toks.push({ t: "num", v: Number(num[0]), col, len: num[0].length });
      i += num[0].length;
      continue;
    }
    toks.push({ t: "bad", v: c, col, len: 1, message: `Unexpected character “${c}”.` });
    i++;
  }
  return toks;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

/**
 * Parse the diagram DSL.
 *
 *   service api "Orders API" -> db postgres "Orders DB"
 *   lb "Edge LB" -> [api x3]
 *   api -> queue kafka "order-events" -> worker "Fulfilment"
 *
 * Never throws: problems become diagnostics with a line/column so the editor can underline them.
 */
export function parseDsl(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map<string, DslNode>();
  const edges: DslEdge[] = [];
  const program: DslProgram = { nodes: [], edges, layout: "right" };
  const counters = new Map<string, number>();
  const err = (line: number, tok: { col: number; len: number }, message: string) =>
    diagnostics.push({ line, col: tok.col, len: Math.max(1, tok.len), message });

  const lines = source.split(/\r?\n/);
  for (const [li, text] of lines.entries()) {
    const line = li + 1;
    const toks = tokenize(text);
    if (!toks.length) continue;
    const bad = toks.find((t) => t.t === "bad") as Extract<Tok, { t: "bad" }> | undefined;
    if (bad) {
      err(line, bad, bad.message);
      continue;
    }

    const first = toks[0]!;
    if (first.t === "word" && ["direction", "title", "layout"].includes(first.v.toLowerCase())) {
      const arg = toks[1];
      const kw = first.v.toLowerCase();
      if (kw === "title") {
        if (arg?.t === "str") program.title = arg.v;
        else err(line, first, 'title needs a quoted text, e.g. title "Checkout flow".');
      } else if (kw === "direction") {
        const v = arg?.t === "word" ? arg.v.toUpperCase() : "";
        if (v === "LR" || v === "RL") program.layout = "right";
        else if (v === "TB" || v === "TD" || v === "BT") program.layout = "down";
        else err(line, arg ?? first, "direction must be LR, RL, TB or BT.");
      } else {
        const v = arg?.t === "word" ? arg.v.toLowerCase() : "";
        if (["right", "down", "tree", "radial", "layered"].includes(v))
          program.layout = v as DslProgram["layout"];
        else err(line, arg ?? first, "layout must be right, down, tree, radial or layered.");
      }
      continue;
    }

    // chain := node (edge node)*
    let pos = 0;
    let prev: string[] | null = null;
    let pendingEdge: Extract<Tok, { t: "edge" }> | null = null;
    const lineOk = diagnostics.length;
    while (pos < toks.length) {
      const res = parseNode(toks, pos, line);
      if (!res) break;
      pos = res.next;
      if (prev && pendingEdge) {
        for (const a of prev)
          for (const b of res.ids)
            edges.push({
              from: a,
              to: b,
              label: pendingEdge.label,
              dashed: pendingEdge.dashed,
              both: pendingEdge.both,
              line,
            });
      }
      prev = res.ids;
      pendingEdge = null;
      if (pos >= toks.length) break;
      const e = toks[pos]!;
      if (e.t !== "edge") {
        err(line, e, "Expected “->” between nodes.");
        break;
      }
      pendingEdge = e;
      pos++;
      if (pos >= toks.length) {
        err(line, e, "Expected a node after this arrow.");
        break;
      }
    }
    void lineOk;
  }

  function define(def: DslNode) {
    nodes.set(def.id, def);
    program.nodes.push(def);
  }

  /** node := kind [tech|id] ["label"] | ref | "[" ref ("x" N | "x" "N") "]" */
  function parseNode(
    toks: Tok[],
    start: number,
    line: number,
  ): { ids: string[]; next: number } | null {
    const t = toks[start]!;
    if (t.t === "lbr") {
      const ref = toks[start + 1];
      const times = toks[start + 2];
      const count = toks[start + 3];
      const close = toks[start + 4] ?? toks[start + 3];
      if (ref?.t !== "word") {
        err(line, t, "Expected a node name inside [ ].");
        return null;
      }
      const target = nodes.get(ref.v);
      if (!target) {
        const s = suggest(ref.v, [...nodes.keys()]);
        err(line, ref, `Unknown node “${ref.v}”.${s ? ` Did you mean “${s}”?` : ""}`);
        return null;
      }
      let n: number | null = null;
      let end = start + 3;
      if (times?.t === "word" && /^x\d+$/i.test(times.v)) {
        n = Number(times.v.slice(1));
        end = start + 3;
        if (toks[start + 3]?.t !== "rbr") {
          err(line, toks[start + 3] ?? t, "Missing “]”.");
          return null;
        }
      } else if (times?.t === "word" && times.v.toLowerCase() === "x" && count?.t === "num") {
        n = count.v;
        end = start + 4;
        if (close?.t !== "rbr") {
          err(line, close ?? t, "Missing “]”.");
          return null;
        }
      } else {
        err(line, times ?? ref, "Write replicas as [name x3].");
        return null;
      }
      if (n < 1 || n > MAX_REPLICAS) {
        err(line, times, `Replicas must be between 1 and ${MAX_REPLICAS}.`);
        return null;
      }
      target.replicas = n;
      return { ids: [target.id], next: end + 1 };
    }
    if (t.t !== "word") {
      err(
        line,
        t,
        t.t === "edge" ? "A line must start with a node, not an arrow." : "Expected a node.",
      );
      return null;
    }

    const existing = nodes.get(t.v);
    const next = toks[start + 1];
    const kind = KINDS[t.v.toLowerCase()];
    // A bare known id (not followed by more node words) is a reference.
    if (existing && !(next?.t === "str")) return { ids: [existing.id], next: start + 1 };
    if (!kind) {
      if (next?.t === "str" || (next?.t === "word" && toks[start + 2]?.t === "str")) {
        const s = suggest(t.v, KIND_NAMES);
        err(
          line,
          t,
          `Unknown kind “${t.v}”.${s ? ` Did you mean “${s}”?` : ` Try one of: service, db, lb, cache, queue, worker, client.`}`,
        );
      } else {
        const s = suggest(t.v, [...nodes.keys()]);
        err(line, t, `Unknown node “${t.v}”.${s ? ` Did you mean “${s}”?` : ""}`);
      }
      return null;
    }

    let pos = start + 1;
    let tech: DslNode["tech"];
    let id: string | undefined;
    const w = toks[pos];
    if (w?.t === "word") {
      const techDef = kind.techs?.[w.v.toLowerCase()];
      if (techDef) tech = techDef;
      else id = w.v;
      pos++;
      // `db postgres main "Main DB"`: an explicit id may follow the technology.
      const maybeId = toks[pos];
      if (tech && maybeId?.t === "word" && toks[pos + 1]?.t === "str") {
        id = maybeId.v;
        pos++;
      }
    }
    let label: string | undefined;
    if (toks[pos]?.t === "str") {
      label = (toks[pos] as Extract<Tok, { t: "str" }>).v;
      pos++;
    }

    const finalLabel = label ?? tech?.name ?? kind.name;
    let finalId = id ?? (label ? slug(label) : "") ?? "";
    if (!finalId) {
      const n = (counters.get(t.v.toLowerCase()) ?? 0) + 1;
      counters.set(t.v.toLowerCase(), n);
      finalId = `${t.v.toLowerCase()}${n}`;
    }
    if (nodes.has(finalId)) {
      if (id) {
        err(line, w!, `“${finalId}” is already defined. Refer to it by name without a kind.`);
        return null;
      }
      let n = 2;
      while (nodes.has(`${finalId}-${n}`)) n++;
      finalId = `${finalId}-${n}`;
    }
    if (nodes.size >= MAX_NODES) {
      err(line, t, `Too many nodes (max ${MAX_NODES}).`);
      return null;
    }
    define({
      id: finalId,
      kind: t.v.toLowerCase(),
      def: kind,
      tech,
      label: finalLabel,
      replicas: 1,
      line,
    });
    return { ids: [finalId], next: pos };
  }

  return { program, diagnostics };
}
