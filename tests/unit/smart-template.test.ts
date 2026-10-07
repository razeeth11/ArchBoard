import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { ArchBoardDB, setDb } from "@/persistence/db";
import * as repo from "@/persistence/repo";
import { selectionToTemplate } from "@/smart/fromSelection";
import type { El } from "@/smart/reconcile";
import {
  generateFromTemplate,
  parseTemplateDef,
  templateToSmartDef,
  TEMPLATE_SCHEMA,
  type TemplateDef,
} from "@/smart/template";
import { defaultsOf } from "@/smart/types";

const valid = (): TemplateDef => ({
  schema: TEMPLATE_SCHEMA,
  id: "demo-box",
  name: "Demo box",
  version: 1,
  params: [
    { key: "name", label: "Name", type: "text", default: "Svc" },
    { key: "count", label: "Copies", type: "number", default: 3, min: 1, max: 6 },
    { key: "db", label: "Database", type: "boolean", default: true },
    { key: "kind", label: "Kind", type: "select", default: "a", options: ["a", "b"] },
  ],
  nodes: [
    {
      role: "svc",
      element: {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        text: "{{name}} #{{i}} ({{kind}})",
      },
      repeat: { count: "count", dx: 0, dy: 60 },
    },
    {
      role: "db",
      element: { type: "ellipse", x: 200, y: 0, width: 80, height: 40, text: "DB" },
      visibleIf: "db",
    },
    {
      role: "link",
      element: { type: "arrow", x: 0, y: 0, start: "svc", end: "db" },
      repeat: { count: "count", dx: 0, dy: 60 },
      visibleIf: "db",
    },
  ],
  ports: [{ name: "in", role: "svc" }],
});

const errorsOf = (raw: unknown) => {
  const r = parseTemplateDef(raw);
  return r.ok ? [] : r.errors;
};

describe("parseTemplateDef", () => {
  it("accepts a valid definition", () => {
    expect(parseTemplateDef(valid()).ok).toBe(true);
  });

  it("rejects malformed definitions with specific, actionable messages", () => {
    const mut = (f: (d: Record<string, unknown>) => void) => {
      const d = JSON.parse(JSON.stringify(valid())) as Record<string, unknown>;
      f(d);
      return errorsOf(d).join(" | ");
    };
    expect(errorsOf(null)[0]).toMatch(/object/);
    expect(mut((d) => (d.schema = "x"))).toMatch(/schema/);
    expect(mut((d) => (d.id = "Bad Id!"))).toMatch(/"id"/);
    expect(mut((d) => (d.name = ""))).toMatch(/"name"/);
    expect(mut((d) => (d.version = 0))).toMatch(/version/);
    expect(
      mut(
        (d) =>
          ((d.params as unknown[])[1] = {
            key: "count",
            label: "x",
            type: "number",
            default: 99,
            min: 1,
            max: 6,
          }),
      ),
    ).toMatch(/default must be within/);
    expect(mut((d) => ((d.params as { key: string }[])[1]!.key = "name"))).toMatch(/duplicated/);
    expect(mut((d) => ((d.nodes as { role: string }[])[1]!.role = "svc"))).toMatch(/duplicated/);
    expect(
      mut((d) => ((d.nodes as { element: { text: string } }[])[0]!.element.text = "{{nope}}")),
    ).toMatch(/unknown parameter/);
    expect(
      mut((d) => ((d.nodes as { repeat: { count: string } }[])[0]!.repeat.count = "name")),
    ).toMatch(/number parameter/);
    expect(mut((d) => ((d.nodes as { visibleIf: string }[])[1]!.visibleIf = "name"))).toMatch(
      /boolean/,
    );
    expect(
      mut((d) => ((d.nodes as { element: { end: string } }[])[2]!.element.end = "ghost")),
    ).toMatch(/unknown role/);
    expect(
      mut((d) => ((d.nodes as { element: { type: string } }[])[0]!.element.type = "script")),
    ).toMatch(/type must be/);
    expect(mut((d) => ((d.nodes as unknown[]).length = 0))).toMatch(/non-empty/);
  });

  it("caps repeat sizes and total definition size", () => {
    const d = valid();
    d.params[1] = { key: "count", label: "x", type: "number", default: 3, min: 1, max: 5000 };
    expect(errorsOf(d).join()).toMatch(/may not exceed/);
    const big = valid();
    big.description = "x".repeat(500_000);
    expect(errorsOf(big).join()).toMatch(/too large/);
  });

  it("sanitizes embedded SVG files and rejects non-SVG ones", () => {
    const d = valid();
    d.nodes.push({ role: "icon", element: { type: "image", x: 0, y: 0, file: "i" } });
    d.files = {
      i: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" onload="alert(1)"><script>alert(2)</script><rect width="4" height="4"/></svg>',
    };
    const r = parseTemplateDef(d);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.def.files!.i).not.toMatch(/script|onload/);
    d.files = { i: "<html>no</html>" };
    expect(errorsOf(d).join()).toMatch(/files\["i"\]/);
  });

  it("is safe against prototype pollution style input", () => {
    const hostile = JSON.parse(
      '{"schema":"archboard.smart/1","id":"ab","name":"n","version":1,"params":[],"nodes":[{"role":"__proto__","element":{"type":"rectangle","x":0,"y":0}}],"__proto__":{"polluted":true}}',
    );
    parseTemplateDef(hostile);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("generateFromTemplate", () => {
  const def = valid();
  const gen = (props: Record<string, string | number | boolean> = {}) =>
    generateFromTemplate(def, props);
  const roles = (g: ReturnType<typeof gen>) => g.parts.map((p) => p.role);

  it("repeats nodes by a numeric parameter with stable, indexed roles", () => {
    expect(roles(gen({ count: 3 })).filter((r) => /^svc-\d$/.test(r))).toEqual([
      "svc-1",
      "svc-2",
      "svc-3",
    ]);
    expect(roles(gen({ count: 5 })).filter((r) => /^svc-\d$/.test(r))).toHaveLength(5);
    expect(roles(gen({ count: 999 })).filter((r) => /^svc-\d$/.test(r))).toHaveLength(6); // clamped to max
    const ys = gen({ count: 3 })
      .parts.filter((p) => /^svc-/.test(p.role))
      .map((p) => (p.skeleton as { y: number }).y);
    expect(ys).toEqual([0, 60, 120]);
  });

  it("toggles nodes with visibleIf and drops dependants", () => {
    expect(roles(gen({ db: true }))).toContain("db");
    const off = roles(gen({ db: false }));
    expect(off).not.toContain("db");
    expect(off.some((r) => r.startsWith("link"))).toBe(false);
  });

  it("interpolates parameters and the 1-based repeat index into text", () => {
    const labels = gen({ name: "API", kind: "b", count: 2 })
      .parts.filter((p) => /^svc-/.test(p.role))
      .map((p) => (p.skeleton as { label: { text: string } }).label.text);
    expect(labels).toEqual(["API #1 (b)", "API #2 (b)"]);
  });

  it("binds arrows to the same repeat index and to unrepeated targets", () => {
    const links = gen({ count: 3 })
      .parts.filter((p) => p.role.startsWith("link-"))
      .map((p) => p.skeleton as { start: { id: string }; end: { id: string } });
    expect(links.map((l) => l.start.id)).toEqual(["svc-1", "svc-2", "svc-3"]);
    expect(links.every((l) => l.end.id === "db")).toBe(true);
  });

  it("resolves ports to the first repeated instance and is deterministic", () => {
    expect(gen().ports).toEqual([{ name: "in", role: "svc-1", description: "in" }]);
    expect(JSON.stringify(gen({ count: 4 }))).toBe(JSON.stringify(gen({ count: 4 })));
  });

  it("turns into a SmartDef whose schema mirrors the parameters", async () => {
    const sd = templateToSmartDef(def);
    expect(sd.schema.map((p) => [p.key, p.type])).toEqual([
      ["name", "text"],
      ["count", "number"],
      ["db", "boolean"],
      ["kind", "select"],
    ]);
    expect((await sd.generate(defaultsOf(sd.schema))).parts.length).toBeGreaterThan(3);
    expect(sd.custom).toBe(def);
  });
});

describe("selectionToTemplate (create from selection)", () => {
  const rect = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): El => ({
    id,
    type: "rectangle",
    x,
    y,
    width: 120,
    height: 60,
    strokeColor: "#1971c2",
    backgroundColor: "#a5d8ff",
    version: 1,
    ...extra,
  });
  const text = (id: string, containerId: string, t: string): El => ({
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 50,
    height: 20,
    text: t,
    containerId,
    fontSize: 16,
    fontFamily: 5,
    version: 1,
  });
  const selection: El[] = [
    rect("r1", 500, 300, { boundElements: [{ id: "t1", type: "text" }] }),
    text("t1", "r1", "Worker"),
    rect("r2", 700, 300, { boundElements: [{ id: "t2", type: "text" }] }),
    text("t2", "r2", "Queue"),
    {
      id: "a1",
      type: "arrow",
      x: 620,
      y: 330,
      width: 80,
      height: 0,
      points: [
        [0, 0],
        [80, 0],
      ],
      startBinding: { elementId: "r1" },
      endBinding: { elementId: "r2" },
      version: 1,
    },
  ];

  it("normalizes coordinates, merges bound text into labels and keeps arrow bindings", () => {
    const { def } = selectionToTemplate(selection, {
      id: "wq",
      name: "Worker + queue",
      textParams: {},
    });
    expect(parseTemplateDef(def).ok).toBe(true);
    const worker = def.nodes.find((n) => n.element.text === "Worker")!;
    expect([worker.element.x, worker.element.y]).toEqual([0, 0]);
    expect(def.nodes.find((n) => n.element.text === "Queue")!.element.x).toBe(200);
    expect(def.nodes.some((n) => n.element.type === "text")).toBe(false); // bound text is not a separate node
    const arrow = def.nodes.find((n) => n.element.type === "arrow")!.element;
    expect([arrow.start, arrow.end]).toEqual(["worker", "queue"]);
  });

  it("turns chosen labels into text parameters and one part into a repeat", () => {
    const { def } = selectionToTemplate(selection, {
      id: "wq",
      name: "Worker + queue",
      textParams: { r1: { key: "workerName", label: "Worker name" } },
      repeat: {
        elementId: "r1",
        key: "workers",
        label: "Workers",
        max: 8,
        direction: "down",
        gap: 20,
      },
    });
    expect(parseTemplateDef(def).ok).toBe(true);
    expect(def.params.map((p) => [p.key, p.type])).toEqual([
      ["workerName", "text"],
      ["workers", "number"],
    ]);
    const g3 = generateFromTemplate(def, { workerName: "Job", workers: 3 });
    const workers = g3.parts.filter((p) => /^worker-\d$/.test(p.role));
    expect(workers).toHaveLength(3);
    expect((workers[1]!.skeleton as { y: number }).y).toBe(80); // height 60 + gap 20
    expect((workers[2]!.skeleton as { label: { text: string } }).label.text).toBe("Job");
  });

  it("defaults reproduce the original layout exactly (round trip)", () => {
    const { def } = selectionToTemplate(selection, {
      id: "wq",
      name: "Worker + queue",
      textParams: {},
    });
    const g = generateFromTemplate(def, {});
    const sk = (role: string) =>
      g.parts.find((p) => p.role === role)!.skeleton as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    expect(sk("worker")).toMatchObject({ x: 0, y: 0, width: 120, height: 60 });
    expect(sk("queue")).toMatchObject({ x: 200, y: 0, width: 120, height: 60 });
  });

  it("skips unsafe or non-SVG images with a warning and sanitizes the rest", () => {
    const img = (id: string, fileId: string): El => ({
      id,
      type: "image",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      fileId,
      version: 1,
    });
    const { def, warnings } = selectionToTemplate(
      [rect("r", 0, 0), img("i1", "f-svg"), img("i2", "f-png")],
      {
        id: "icons",
        name: "Icons",
        textParams: {},
        files: {
          "f-svg":
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><script>x</script><rect width="4" height="4"/></svg>',
        },
      },
    );
    expect(warnings.length).toBe(1);
    expect(Object.values(def.files!).join()).not.toMatch(/script/);
    expect(def.nodes.filter((n) => n.element.type === "image")).toHaveLength(1);
  });

  it("refuses an empty selection", () => {
    expect(() => selectionToTemplate([], { id: "x", name: "x", textParams: {} })).toThrow(/Select/);
  });
});

describe("database schema v2", () => {
  it("opening an existing v1 database keeps every row and adds smartDefs", async () => {
    const name = `legacy-${Date.now()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      scenes: "id, updatedAt, folderId, deletedAt, order",
      pages: "id, sceneId, [sceneId+order]",
      snapshots: "id, sceneId, [sceneId+createdAt]",
      folders: "id, order",
      libraries: "id",
      settings: "key",
      blobs: "hash",
      comments: "id, sceneId",
      recovery: "id, sceneId",
    });
    await old.table("scenes").add({
      id: "s1",
      title: "Old scene",
      folderId: null,
      pageIds: ["p1"],
      createdAt: 1,
      updatedAt: 1,
      thumbnailBlobId: null,
      tags: [],
      pinned: false,
      order: 0,
      deletedAt: null,
      schemaVersion: 1,
    });
    await old.table("pages").add({
      id: "p1",
      sceneId: "s1",
      order: 0,
      title: "Page 1",
      elements: [{ id: "e", type: "rectangle" }],
      appState: {},
      fileRefs: {},
      rev: 7,
      schemaVersion: 1,
    });
    await old.table("settings").add({ key: "k", value: 42 });
    old.close();

    setDb(new ArchBoardDB(name));
    const scenes = await repo.listScenes();
    expect(scenes.map((s) => s.title)).toEqual(["Old scene"]);
    expect((await repo.loadPage("s1")).rev).toBe(7);
    expect(await repo.getSetting("k", 0)).toBe(42);
    await repo.saveSmartDef("my-def", "My def", { hello: 1 });
    expect((await repo.listSmartDefs()).map((d) => d.id)).toEqual(["my-def"]);
    await repo.deleteSmartDef("my-def");
    expect(await repo.listSmartDefs()).toEqual([]);
  });
});
