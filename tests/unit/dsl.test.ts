import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileDsl, unitIds } from "@/dsl/compile";
import { DSL_EXAMPLES } from "@/dsl/examples";
import { KINDS } from "@/dsl/kinds";
import { elementsToMermaid } from "@/dsl/mermaid-export";
import { parseDsl } from "@/dsl/parser";
import type { El } from "@/smart/reconcile";

const root = process.cwd();
const sets: Record<string, unknown> = {};
for (const p of ["logos", "devicon", "simple-icons", "mdi", "carbon", "lucide"])
  sets[p] = JSON.parse(readFileSync(join(root, "public", "icons", `${p}.json`), "utf8"));
const orig = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (u: string) => {
    const m = /\/icons\/([^/.]+)\.json/.exec(u);
    return new Response(JSON.stringify(m ? sets[m[1]!] : {}), {
      status: m && sets[m[1]!] ? 200 : 404,
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = orig;
});

const ok = (src: string) => {
  const r = parseDsl(src);
  expect(r.diagnostics, JSON.stringify(r.diagnostics)).toEqual([]);
  return r.program;
};

describe("the example from the brief", () => {
  const src = `service api "Orders API" -> db postgres "Orders DB"\nlb "Edge LB" -> [api x3]\napi -> queue kafka "order-events" -> worker "Fulfilment"\n`;
  it("parses without diagnostics into the expected graph", () => {
    const p = ok(src);
    expect(p.nodes.map((n) => [n.id, n.kind, n.label, n.replicas])).toEqual([
      ["api", "service", "Orders API", 3],
      ["orders-db", "db", "Orders DB", 1],
      ["edge-lb", "lb", "Edge LB", 1],
      ["order-events", "queue", "order-events", 1],
      ["fulfilment", "worker", "Fulfilment", 1],
    ]);
    expect(p.nodes[1]!.tech?.name).toBe("PostgreSQL");
    expect(p.nodes[3]!.tech?.name).toBe("Kafka");
    expect(p.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      "api>orders-db",
      "edge-lb>api",
      "api>order-events",
      "order-events>fulfilment",
    ]);
  });
  it("compiles to bound arrows between replicated units", async () => {
    const c = await compileDsl(ok(src));
    expect(c.nodeIds).toEqual([
      "api#1",
      "api#2",
      "api#3",
      "orders-db",
      "edge-lb",
      "order-events",
      "fulfilment",
    ]);
    const arrows = c.skeleton.filter((s) => s.type === "arrow") as unknown as {
      start: { id: string };
      end: { id: string };
    }[];
    // lb → each of 3 replicas, 3 replicas → db, 3 replicas → queue, queue → worker
    expect(arrows.filter((a) => a.start.id === "edge-lb").map((a) => a.end.id)).toEqual([
      "api#1",
      "api#2",
      "api#3",
    ]);
    expect(arrows.filter((a) => a.end.id === "orders-db")).toHaveLength(3);
    expect(arrows).toHaveLength(3 + 3 + 3 + 1);
    expect(c.files.length).toBeGreaterThan(1); // icons for postgres, kafka, ...
    for (const a of arrows) {
      expect(c.nodeIds).toContain(a.start.id);
      expect(c.nodeIds).toContain(a.end.id);
    }
  });
});

describe("syntax", () => {
  it("edge variants: dashed, labelled, bidirectional", () => {
    const p = ok(
      `service a "A"\nservice b "B"\na -> b\na --> b\na -[calls]-> b\na --[async]--> b\na <-> b\n`,
    );
    expect(p.edges.map((e) => [e.dashed, e.label ?? null, e.both])).toEqual([
      [false, null, false],
      [true, null, false],
      [false, "calls", false],
      [true, "async", false],
      [false, null, true],
    ]);
  });
  it("comments, blank lines, directives and a title", () => {
    const p = ok(`# top\n\ntitle "My system"\ndirection TB // inline\nservice a "A" # trailing\n`);
    expect(p.title).toBe("My system");
    expect(p.layout).toBe("down");
    expect(p.nodes).toHaveLength(1);
    expect(ok("direction LR\n").layout).toBe("right");
    expect(ok("layout radial\n").layout).toBe("radial");
  });
  it("ids: explicit, from the label, or generated; duplicates are disambiguated", () => {
    const p = ok(
      `service web "Web"\nservice "Billing Service"\nworker\nworker\nservice "Billing Service"\n`,
    );
    expect(p.nodes.map((n) => n.id)).toEqual([
      "web",
      "billing-service",
      "worker1",
      "worker2",
      "billing-service-2",
    ]);
    expect(p.nodes[2]!.label).toBe("Worker"); // defaults to the kind's name
  });
  it("fan-out chains and replicas with the 'x 3' spelling", () => {
    const p = ok(`service a "A"\nservice b "B"\nservice c "C"\na -> b -> c\n[b x 4]\n`);
    expect(p.nodes.find((n) => n.id === "b")!.replicas).toBe(4);
    expect(p.edges).toHaveLength(2);
  });
  it("kind aliases and technologies", () => {
    const p = ok(`database postgres "D"\nredis "R"\nkafka "K"\nlambda "L"\n`);
    expect(p.nodes.map((n) => n.def.name)).toEqual(["Database", "Cache", "Topic", "Function"]);
    expect(Object.keys(KINDS).length).toBeGreaterThan(40);
  });
  it("supports a technology followed by an explicit id", () => {
    const p = ok(`db postgres main "Main DB"\n`);
    expect(p.nodes[0]).toMatchObject({ id: "main", label: "Main DB" });
    expect(p.nodes[0]!.tech?.name).toBe("PostgreSQL");
  });
});

describe("diagnostics (squiggles)", () => {
  const diag = (src: string) => parseDsl(src).diagnostics;
  it("unknown references suggest the closest name", () => {
    const d = diag(`service api "A"\napi -> apj\n`);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ line: 2, col: 8, len: 3 });
    expect(d[0]!.message).toMatch(/Unknown node “apj”.*Did you mean “api”/);
  });
  it("unknown kinds suggest a kind", () => {
    const d = diag(`servise api "A"\n`);
    expect(d[0]!.message).toMatch(/Unknown kind “servise”.*Did you mean “service”/);
    expect(d[0]).toMatchObject({ line: 1, col: 1, len: 7 });
  });
  it("reports structure errors with positions", () => {
    expect(diag(`service a "A" ->\n`)[0]!.message).toMatch(/Expected a node after this arrow/);
    expect(diag(`-> service a "A"\n`)[0]!.message).toMatch(/must start with a node/);
    expect(diag(`service a "A\n`)[0]!.message).toMatch(/Unterminated string/);
    expect(diag(`service a "A" service b "B"\n`)[0]!.message).toMatch(/Expected “->”/);
    expect(diag(`service a "A"\n[a x99]\n`)[0]!.message).toMatch(/between 1 and 12/);
    expect(diag(`service a "A"\n[a]\n`)[0]!.message).toMatch(/replicas/);
    expect(diag(`service a "A"\nservice a "B"\n`)[0]!.message).toMatch(/already defined/);
    expect(diag(`title\n`)[0]!.message).toMatch(/quoted text/);
    expect(diag(`direction sideways\n`)[0]!.message).toMatch(/LR, RL, TB or BT/);
    expect(diag(`service a "A" @ b\n`)[0]!.message).toMatch(/Unexpected character/);
  });
  it("keeps going after an error so later lines still produce nodes", () => {
    const r = parseDsl(`servise x "bad"\nservice ok "Fine"\n`);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.program.nodes.map((n) => n.id)).toEqual(["ok"]);
  });
  it("never throws on arbitrary garbage", () => {
    for (const junk of [
      "",
      "\u0000\u0001",
      "[[[[",
      '"""',
      "->->->",
      "x".repeat(10_000),
      "a -[ -> b",
      "[ ] x",
      "<-> <->",
    ]) {
      expect(() => parseDsl(junk)).not.toThrow();
    }
  });
  it("caps the number of nodes", () => {
    const src = Array.from({ length: 200 }, (_, i) => `service s${i} "S${i}"`).join("\n");
    expect(parseDsl(src).diagnostics.some((d) => /Too many nodes/.test(d.message))).toBe(true);
  });
});

describe("example snippets", () => {
  it("there are at least 10, with unique ids", () => {
    expect(DSL_EXAMPLES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(DSL_EXAMPLES.map((e) => e.id)).size).toBe(DSL_EXAMPLES.length);
  });
  for (const ex of DSL_EXAMPLES) {
    it(`"${ex.title}" parses cleanly and compiles`, async () => {
      const p = ok(ex.source);
      expect(p.nodes.length).toBeGreaterThan(1);
      expect(p.edges.length).toBeGreaterThan(0);
      const c = await compileDsl(p);
      expect(c.skeleton.length).toBeGreaterThan(p.nodes.length);
      expect(ex.description.length).toBeGreaterThan(30);
    });
  }
});

describe("unitIds", () => {
  it("expands replicas", () => {
    expect(unitIds("a", 1)).toEqual(["a"]);
    expect(unitIds("a", 3)).toEqual(["a#1", "a#2", "a#3"]);
  });
});

describe("elementsToMermaid", () => {
  const shape = (id: string, type: string, x: number, y: number): El => ({
    id,
    type,
    x,
    y,
    width: 100,
    height: 50,
    version: 1,
  });
  const label = (id: string, container: string, text: string): El => ({
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    text,
    containerId: container,
    version: 1,
  });
  const arrow = (id: string, a: string, b: string, extra: Record<string, unknown> = {}): El => ({
    id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    version: 1,
    startBinding: { elementId: a },
    endBinding: { elementId: b },
    endArrowhead: "arrow",
    ...extra,
  });
  it("exports shapes, labels and edges as a flowchart", () => {
    const els = [
      shape("1", "rectangle", 0, 0),
      label("t1", "1", 'Say "hi"'),
      shape("2", "diamond", 300, 0),
      label("t2", "2", "ok?"),
      shape("3", "ellipse", 600, 0),
      arrow("a", "1", "2"),
      arrow("b", "2", "3", { strokeStyle: "dashed" }),
      label("tb", "b", "yes"),
      arrow("c", "1", "9"),
    ];
    const r = elementsToMermaid(els);
    expect(r.nodes).toBe(3);
    expect(r.edges).toBe(2);
    expect(r.text).toContain("flowchart LR");
    expect(r.text).toContain('n1["Say #quot;hi#quot;"]');
    expect(r.text).toContain('n2{"ok?"}');
    expect(r.text).toContain('n3(("n3"))');
    expect(r.text).toContain("n1 --> n2");
    expect(r.text).toContain("n2 -.->|yes| n3");
  });
  it("uses top-down for vertical flows and ignores deleted or unbound arrows", () => {
    const els = [
      shape("1", "rectangle", 0, 0),
      shape("2", "rectangle", 0, 400),
      arrow("a", "1", "2"),
      { ...arrow("d", "1", "2"), isDeleted: true },
      { id: "free", type: "arrow", x: 0, y: 0, width: 5, height: 5, version: 1 } as El,
    ];
    const r = elementsToMermaid(els);
    expect(r.text).toContain("flowchart TD");
    expect(r.edges).toBe(1);
    expect(elementsToMermaid([]).text).toBe("flowchart TD\n");
  });
});
