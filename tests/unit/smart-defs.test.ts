import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMART_DEFS } from "@/smart/defs";
import {
  defaultsOf,
  normalizeProps,
  type PropSchema,
  type Props,
  type SmartDef,
} from "@/smart/types";

const root = process.cwd();
const sets: Record<string, unknown> = {};
for (const p of ["logos", "devicon", "simple-icons", "mdi", "carbon", "lucide"]) {
  sets[p] = JSON.parse(readFileSync(join(root, "public", "icons", `${p}.json`), "utf8"));
}
const origFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (url: string) => {
    const m = /\/icons\/([^/.]+)\.json/.exec(url);
    const body = m ? sets[m[1]!] : undefined;
    return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404 });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = origFetch;
});

const arb = (schema: PropSchema[]) =>
  fc.record(
    Object.fromEntries(
      schema.map((p) => [
        p.key,
        p.type === "number"
          ? fc.integer({ min: p.min - 2, max: p.max + 2 }) // out-of-range values must be clamped, not crash
          : p.type === "select"
            ? fc.constantFrom(...p.options, "not-an-option")
            : p.type === "boolean"
              ? fc.boolean()
              : fc.string({ maxLength: 80 }),
      ]),
    ),
  ) as fc.Arbitrary<Props>;

type Sk = {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  start?: { id: string };
  end?: { id: string };
};

async function check(def: SmartDef, props: Props) {
  const gen = await def.generate(props);
  const roles = gen.parts.map((p) => p.role);
  expect(new Set(roles).size, `${def.id}: duplicate roles`).toBe(roles.length);
  expect(roles, `${def.id}: needs a root`).toContain("root");
  expect(roles[0], `${def.id}: root must be first (bottom of the z-order)`).toBe("root");
  for (const p of gen.parts) {
    const sk = p.skeleton as unknown as Sk;
    expect(sk.id, `${def.id}/${p.role}: skeleton id must equal role`).toBe(p.role);
    for (const k of ["x", "y", "width", "height"] as const)
      if (sk[k] !== undefined)
        expect(Number.isFinite(sk[k]), `${def.id}/${p.role}.${k}`).toBe(true);
    if (sk.start) expect(roles, `${def.id}/${p.role} start`).toContain(sk.start.id);
    if (sk.end) expect(roles, `${def.id}/${p.role} end`).toContain(sk.end.id);
  }
  for (const port of gen.ports) expect(roles, `${def.id}: port ${port.name}`).toContain(port.role);
  expect(new Set(gen.ports.map((p) => p.name)).size, `${def.id}: duplicate port names`).toBe(
    gen.ports.length,
  );
  return gen;
}

describe("built-in smart components", () => {
  it("ships at least 15 uniquely identified, documented components covering the brief", () => {
    expect(SMART_DEFS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(SMART_DEFS.map((d) => d.id)).size).toBe(SMART_DEFS.length);
    const required = [
      "load-balanced-service",
      "database-with-replicas",
      "queue-with-consumers",
      "cache-aside",
      "api-gateway-fanout",
      "k8s-deployment",
      "cqrs",
      "saga-orchestrator",
      "event-sourcing",
      "circuit-breaker",
      "three-tier-web-app",
      "multi-region-active-passive",
      "cdn-origin-shield",
      "etl-pipeline",
    ];
    expect(required.filter((r) => !SMART_DEFS.some((d) => d.id === r))).toEqual([]);
    for (const d of SMART_DEFS) {
      expect(d.version).toBeGreaterThanOrEqual(1);
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.schema.length).toBeGreaterThan(0);
    }
  });

  it("schemas have defaults inside their own constraints", () => {
    for (const d of SMART_DEFS) {
      const keys = d.schema.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const p of d.schema) {
        if (p.type === "number") {
          expect(p.min).toBeLessThanOrEqual(p.default);
          expect(p.default).toBeLessThanOrEqual(p.max);
        }
        if (p.type === "select") expect(p.options).toContain(p.default);
      }
      expect(normalizeProps(d.schema, defaultsOf(d.schema))).toEqual(defaultsOf(d.schema));
    }
  });

  for (const def of SMART_DEFS) {
    describe(def.name, () => {
      it("generates a valid, deterministic structure from its defaults", async () => {
        const a = await check(def, defaultsOf(def.schema));
        const b = await def.generate(defaultsOf(def.schema));
        expect(JSON.stringify(b)).toBe(JSON.stringify(a)); // pure: same props, same output
        expect(a.parts.length).toBeGreaterThan(3);
      });

      it("holds its invariants for any props, including out-of-range input (property test)", async () => {
        await fc.assert(
          fc.asyncProperty(arb(def.schema), async (props) => {
            const gen = await check(def, props);
            const again = await def.generate(props);
            expect(JSON.stringify(again)).toBe(JSON.stringify(gen));
          }),
          { numRuns: 12 },
        );
      });

      it("keeps the root frame around its nodes", async () => {
        const gen = await def.generate(defaultsOf(def.schema));
        const sized = (p: (typeof gen.parts)[number]) => p.skeleton as unknown as Sk;
        const r = sized(gen.parts[0]!);
        for (const p of gen.parts.slice(1)) {
          const s = sized(p);
          if (
            s.width === undefined ||
            s.x === undefined ||
            s.y === undefined ||
            s.height === undefined ||
            p.role.endsWith(":icon")
          )
            continue;
          expect(s.x, p.role).toBeGreaterThanOrEqual(r.x! - 0.5);
          expect(s.y, p.role).toBeGreaterThanOrEqual(r.y! - 0.5);
          expect(s.x + s.width, p.role).toBeLessThanOrEqual(r.x! + r.width! + 0.5);
          expect(s.y + s.height, p.role).toBeLessThanOrEqual(r.y! + r.height! + 0.5);
        }
      });
    });
  }

  it("count-style props add and remove exactly that many parts", async () => {
    const byId = (id: string) => SMART_DEFS.find((d) => d.id === id)!;
    const count = async (id: string, props: Props, re: RegExp) =>
      (await byId(id).generate(props)).parts.filter((p) => re.test(p.role)).length;
    for (const n of [1, 3, 8])
      expect(await count("load-balanced-service", { replicas: n }, /^replica-\d+$/)).toBe(n);
    for (const n of [0, 2, 6])
      expect(await count("database-with-replicas", { readReplicas: n }, /^replica-\d+$/)).toBe(n);
    for (const n of [1, 6, 12])
      expect(await count("queue-with-consumers", { partitions: n }, /^partition-\d+$/)).toBe(n);
    for (const n of [1, 4, 8])
      expect(await count("api-gateway-fanout", { services: n }, /^svc-\d+$/)).toBe(n);
    for (const n of [1, 5, 8])
      expect(await count("k8s-deployment", { replicas: n }, /^pod-\d+$/)).toBe(n);
    for (const n of [2, 5, 8])
      expect(await count("saga-orchestrator", { steps: n }, /^step-\d+$/)).toBe(n);
  });

  it("boolean props toggle their parts", async () => {
    const has = async (id: string, props: Props, role: string) =>
      (await SMART_DEFS.find((d) => d.id === id)!.generate(props)).parts.some(
        (p) => p.role === role,
      );
    expect(await has("load-balanced-service", { showHealthChecks: true }, "health")).toBe(true);
    expect(await has("load-balanced-service", { showHealthChecks: false }, "health")).toBe(false);
    expect(await has("api-gateway-fanout", { auth: false }, "auth")).toBe(false);
    expect(await has("queue-with-consumers", { dlq: true }, "dlq")).toBe(true);
    expect(await has("k8s-deployment", { hpa: false }, "hpa")).toBe(false);
  });

  it("roles are stable when unrelated props change (this is what lets regeneration keep user edits)", async () => {
    const lb = SMART_DEFS.find((d) => d.id === "load-balanced-service")!;
    const a = (await lb.generate({ replicas: 3 })).parts.map((p) => p.role);
    const b = (await lb.generate({ replicas: 5 })).parts.map((p) => p.role);
    for (const role of a.filter((r) => !r.startsWith("lb-to-"))) expect(b).toContain(role);
    expect(b.filter((r) => !a.includes(r)).every((r) => /(replica|lb-to)-[45]/.test(r))).toBe(true);
  });
});

describe("normalizeProps", () => {
  const schema: PropSchema[] = [
    { key: "n", label: "N", type: "number", min: 1, max: 5, default: 3 },
    { key: "s", label: "S", type: "select", options: ["a", "b"], default: "a" },
    { key: "b", label: "B", type: "boolean", default: false },
    { key: "t", label: "T", type: "text", default: "x", maxLength: 5 },
  ];
  it("clamps, coerces and drops unknown keys", () => {
    expect(normalizeProps(schema, { n: 99, s: "zzz", b: "yes", t: "abcdefgh", extra: 1 })).toEqual({
      n: 5,
      s: "a",
      b: false,
      t: "abcde",
    });
    expect(normalizeProps(schema, { n: -4 }).n).toBe(1);
    expect(normalizeProps(schema, { n: NaN }).n).toBe(3);
    expect(normalizeProps(schema, null)).toEqual({ n: 3, s: "a", b: false, t: "x" });
  });
});
