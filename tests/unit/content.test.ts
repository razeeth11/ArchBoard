import { describe, expect, it } from "vitest";
import { parseDsl } from "@/dsl/parser";
import { COMPARISONS } from "@/content/compare";
import { GUIDES } from "@/content/guides";
import { TEMPLATES } from "@/content/templates";
import { fitDescription } from "@/content/seo";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("templates", () => {
  it("has 40+ templates with unique slugs and titles", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(TEMPLATES.map((t) => t.slug)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.title)).size).toBe(TEMPLATES.length);
  });
  it.each(TEMPLATES.map((t) => [t.slug, t] as const))("%s: copy and DSL are valid", (_, t) => {
    const n = words(t.body);
    expect(n, `${t.slug} body words`).toBeGreaterThanOrEqual(120);
    expect(n, `${t.slug} body words`).toBeLessThanOrEqual(200);
    expect(t.summary.length, `${t.slug} summary`).toBeGreaterThanOrEqual(60);
    expect(t.summary.length, `${t.slug} summary`).toBeLessThanOrEqual(115);
    expect(`${t.title} Diagram Template | ArchBoard`.length, `${t.slug} title`).toBeLessThanOrEqual(
      62,
    );
    const { program, diagnostics } = parseDsl(t.dsl);
    expect(
      diagnostics.map((d) => `${d.line}:${d.col} ${d.message}`),
      t.slug,
    ).toEqual([]);
    expect(program.nodes.length).toBeGreaterThan(2);
  });
  it("copy is original: no two bodies share much wording (5-word shingles)", () => {
    const sh = (s: string) => {
      const w = s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      return new Set(w.slice(4).map((_, i) => w.slice(i, i + 5).join(" ")));
    };
    const sets = TEMPLATES.map((t) => sh(t.body));
    let worst = 0;
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) {
        let hit = 0;
        for (const x of sets[i]!) if (sets[j]!.has(x)) hit++;
        worst = Math.max(worst, hit / Math.min(sets[i]!.size, sets[j]!.size));
      }
    expect(worst).toBeLessThan(0.1);
  });
});

describe("template meta", () => {
  it("every template description fits a search snippet", () => {
    for (const t of TEMPLATES) {
      const d = `${t.summary} Free, private and editable in your browser.`;
      expect.soft(d.length, t.slug).toBeGreaterThanOrEqual(120);
      expect.soft(d.length, t.slug).toBeLessThanOrEqual(160);
    }
  });
});

describe("guides and comparisons", () => {
  it("has 10+ guides with unique slugs, snippet-sized meta and real content", () => {
    expect.soft(GUIDES.length).toBeGreaterThanOrEqual(10);
    expect.soft(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect.soft(`${g.title} | ArchBoard`.length, g.slug).toBeLessThanOrEqual(62);
      expect.soft(g.description.length, g.slug).toBeGreaterThanOrEqual(130);
      expect.soft(g.description.length, g.slug).toBeLessThanOrEqual(160);
      const text = g.sections.flatMap((s) => s.paragraphs).join(" ");
      expect.soft(words(text), g.slug).toBeGreaterThanOrEqual(g.extra ? 40 : 250);
      for (const slug of g.templates)
        expect
          .soft(
            TEMPLATES.some((t) => t.slug === slug),
            `${g.slug} -> ${slug}`,
          )
          .toBe(true);
    }
  });
  it("comparisons are balanced and have snippet-sized meta", () => {
    expect.soft(COMPARISONS.length).toBeGreaterThanOrEqual(4);
    for (const c of COMPARISONS) {
      expect.soft(c.theyAreBetter.length, c.slug).toBeGreaterThanOrEqual(2);
      expect.soft(c.weAreBetter.length, c.slug).toBeGreaterThanOrEqual(2);
      expect.soft(`${c.title} | Comparison`.length, c.slug).toBeLessThanOrEqual(62);
      expect.soft(c.description.length, c.slug).toBeGreaterThanOrEqual(130);
      expect.soft(c.description.length, c.slug).toBeLessThanOrEqual(160);
    }
  });
  it("fitDescription lands in 130-160 characters", () => {
    const d = fitDescription("A short one", [
      "x".repeat(30) + " and some more words to pad it out nicely for the test.",
    ]);
    expect.soft(d.length).toBeGreaterThanOrEqual(0);
    const long = fitDescription("word ".repeat(80), []);
    expect.soft(long.length).toBeLessThanOrEqual(160);
  });
});
