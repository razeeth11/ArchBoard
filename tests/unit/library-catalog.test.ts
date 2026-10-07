import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCKS, TECH, CATEGORY_COLORS, searchBlocks, searchTech } from "@/library/blocks";
import { KIT_ITEMS, KITS, searchKits } from "@/library/kits";
import { ALLOWED_PREFIXES, parseOnlineRef } from "@/library/iconify";
import { parsePayload } from "@/library/insert";
import type { LicenseManifest } from "@/library/icons";

const root = process.cwd();
const sets: Record<string, { icons: Record<string, { body: string }> }> = {};
for (const p of ["logos", "devicon", "simple-icons", "mdi", "carbon", "lucide"]) {
  sets[p] = JSON.parse(readFileSync(join(root, "public", "icons", `${p}.json`), "utf8"));
}
const manifest = JSON.parse(
  readFileSync(join(root, "public", "licenses", "manifest.json"), "utf8"),
) as LicenseManifest;
const index = JSON.parse(
  readFileSync(join(root, "public", "icons", "index.json"), "utf8"),
) as Record<string, string[]>;

const hasIcon = (ref: string) => {
  const [prefix, name] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
  return !!sets[prefix]?.icons[name];
};

describe("icon pipeline and licenses", () => {
  it("every bundled set has a permissive license, attribution, author and a license file", () => {
    expect(manifest.sets.map((s) => s.prefix).sort()).toEqual(Object.keys(sets).sort());
    for (const s of manifest.sets) {
      expect(["CC0-1.0", "MIT", "Apache-2.0", "ISC"]).toContain(s.license.spdx);
      expect(s.attribution).toContain(s.author);
      expect(s.author).not.toBe("");
      const text = readFileSync(join(root, "public", s.licenseFile), "utf8");
      expect(text.length).toBeGreaterThan(20);
      expect(s.iconCount).toBe(Object.keys(sets[s.prefix]!.icons).length);
    }
  });
  it("the search index matches the shipped icons", () => {
    for (const [prefix, names] of Object.entries(index)) {
      expect([...names].sort()).toEqual(Object.keys(sets[prefix]!.icons).sort());
    }
  });
  it("icon bodies contain no scripts or external references", () => {
    for (const set of Object.values(sets)) {
      for (const icon of Object.values(set.icons)) {
        expect(icon.body).not.toMatch(/<script|\son\w+=|javascript:|https?:\/\/(?!www\.w3\.org)/i);
      }
    }
  });
});

describe("building blocks", () => {
  it("covers every block named in the product brief", () => {
    const required = [
      "client",
      "browser",
      "mobile-app",
      "api-gateway",
      "load-balancer",
      "cdn",
      "reverse-proxy",
      "service",
      "microservice",
      "worker",
      "cron-job",
      "serverless-function",
      "container",
      "pod",
      "node",
      "k8s-cluster",
      "vpc",
      "subnet",
      "firewall",
      "waf",
      "dns",
      "cache-redis",
      "cache-memcached",
      "sql-db",
      "nosql-db",
      "object-storage",
      "search-index",
      "data-warehouse",
      "message-queue",
      "topic-stream",
      "pub-sub",
      "event-bus",
      "scheduler",
      "auth-provider",
      "secrets-vault",
      "observability",
      "ci-cd",
      "feature-flags",
      "rate-limiter",
      "third-party-api",
    ];
    const ids = new Set(BLOCKS.map((b) => b.id));
    expect(required.filter((r) => !ids.has(r))).toEqual([]);
  });
  it("has unique ids, known categories, descriptions and resolvable icons", () => {
    expect(new Set(BLOCKS.map((b) => b.id)).size).toBe(BLOCKS.length);
    for (const b of BLOCKS) {
      expect(CATEGORY_COLORS[b.category]).toBeDefined();
      expect(b.description.length).toBeGreaterThan(10);
      expect(hasIcon(b.icon), `${b.id} → ${b.icon}`).toBe(true);
    }
  });
  it("tech logos resolve and have unique ids", () => {
    expect(new Set(TECH.map((t) => t.id)).size).toBe(TECH.length);
    for (const t of TECH) expect(hasIcon(t.icon), `${t.name} → ${t.icon}`).toBe(true);
    for (const g of ["AWS", "Google Cloud", "Azure", "Platform"])
      expect(TECH.some((t) => t.group === g)).toBe(true);
    expect(TECH.some((t) => t.name === "Kubernetes")).toBe(true);
    expect(TECH.some((t) => t.name === "Docker")).toBe(true);
    expect(TECH.some((t) => t.name === "Terraform")).toBe(true);
  });
  it("searches by name, keyword and description", () => {
    expect(searchBlocks("redis").map((b) => b.id)).toContain("cache-redis");
    expect(searchBlocks("kafka").map((b) => b.id)).toContain("topic-stream");
    expect(searchBlocks("lambda").map((b) => b.id)).toContain("serverless-function");
    expect(searchBlocks("zzzz")).toEqual([]);
    expect(searchTech("route 53").length).toBe(1);
  });
});

describe("diagram kits", () => {
  it("covers UML, sequence, ERD, C4, flowchart/BPMN, network, wireframe and data-flow", () => {
    expect(KITS.map((k) => k.id).sort()).toEqual([
      "c4",
      "dfd",
      "erd",
      "flowchart",
      "network",
      "sequence",
      "uml",
      "wireframe",
    ]);
    for (const k of KITS) expect(KIT_ITEMS.some((i) => i.kit === k.id)).toBe(true);
    expect(KIT_ITEMS.length).toBeGreaterThanOrEqual(55);
  });
  it("has unique ids and every item builds a non-empty skeleton with valid sizes", async () => {
    expect(new Set(KIT_ITEMS.map((i) => i.id)).size).toBe(KIT_ITEMS.length);
    // Icons are fetched over HTTP in the app; stub them out so structure can be checked in Node.
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const m = /\/icons\/([^/.]+)\.json/.exec(url);
      const body = m ? sets[m[1]!] : undefined;
      return new Response(
        JSON.stringify({ prefix: m?.[1], width: 24, height: 24, ...(body ?? {}) }),
        { status: body ? 200 : 404 },
      );
    }) as typeof fetch;
    try {
      for (const item of KIT_ITEMS) {
        const built = await item.build();
        expect(built.skeleton.length, item.id).toBeGreaterThan(0);
        expect(built.width + built.height, item.id).toBeGreaterThan(0);
        expect(built.meta.id).toBe(item.id);
        for (const el of built.skeleton) {
          expect(["rectangle", "ellipse", "diamond", "text", "line", "arrow", "image"]).toContain(
            el.type,
          );
        }
        const needs = built.skeleton.filter((e) => e.type === "image").length;
        expect(built.files.length > 0 || needs === 0, `${item.id} images need files`).toBe(true);
      }
    } finally {
      globalThis.fetch = orig;
    }
  });
  it("search narrows by kit and keyword", () => {
    expect(searchKits("crow").length).toBeGreaterThan(0);
    expect(searchKits("", "erd").every((i) => i.kit === "erd")).toBe(true);
    expect(searchKits("lifeline").map((i) => i.id)).toContain("seq-lifeline");
  });
});

describe("online icon safety and drag payloads", () => {
  it("only accepts refs from allowed sets with well-formed names", () => {
    expect(parseOnlineRef("mdi:server")).toEqual({ prefix: "mdi", name: "server" });
    expect(parseOnlineRef("fa-solid:server")).toBeNull();
    expect(parseOnlineRef("mdi:../etc/passwd")).toBeNull();
    expect(parseOnlineRef("mdi:Server")).toBeNull();
    expect(parseOnlineRef("nope")).toBeNull();
    expect(ALLOWED_PREFIXES).toContain("lucide");
  });
  it("parses only well-formed drag payloads", () => {
    expect(parsePayload('{"type":"block","id":"cdn"}')).toEqual({ type: "block", id: "cdn" });
    expect(parsePayload('{"type":"icon","ref":"mdi:server","online":true}')).toEqual({
      type: "icon",
      ref: "mdi:server",
      online: true,
    });
    expect(parsePayload('{"type":"evil","id":"x"}')).toBeNull();
    expect(parsePayload("not json")).toBeNull();
    expect(parsePayload('{"type":"block"}')).toBeNull();
  });
});
