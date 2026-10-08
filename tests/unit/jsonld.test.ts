import { describe, expect, it } from "vitest";
import { article, creator, CREATOR_ID, webApplication } from "@/lib/jsonld";
import { buildCreator, CREATOR, SITE } from "@/lib/site";

describe("creator branding", () => {
  it("uses the real domain and creator profile", () => {
    expect(SITE.url).toBe("https://archboard.space");
    expect(CREATOR.name).toBe("codebyrazeeth");
    expect(CREATOR.url).toBe("https://github.com/razeeth11");
    expect(CREATOR.repoUrl).toBe("https://github.com/razeeth11/ArchBoard");
  });

  it("has no Store link until storeUrl is set", () => {
    expect(CREATOR.storeUrl).toBeUndefined();
    expect(CREATOR.sameAs).toEqual([CREATOR.url]);
    expect(buildCreator("https://apps.microsoft.com/detail/example").sameAs).toEqual([
      CREATOR.url,
      "https://apps.microsoft.com/detail/example",
    ]);
  });

  it("creator() is a Person with a stable @id", () => {
    const p = creator() as Record<string, unknown>;
    expect(p["@type"]).toBe("Person");
    expect(p["@id"]).toBe(`${SITE.url}/#creator`);
    expect(p["@id"]).toBe(CREATOR_ID);
    expect(p.name).toBe("codebyrazeeth");
    expect(p.url).toBe(CREATOR.url);
    expect(p.sameAs).toEqual([CREATOR.url]);
  });

  it("creator() de-duplicates sameAs and keeps only https", () => {
    const c = {
      ...buildCreator(),
      sameAs: [CREATOR.url, CREATOR.url, "http://insecure.example", "https://b.example"],
    };
    expect((creator(c) as { sameAs: string[] }).sameAs).toEqual([CREATOR.url, "https://b.example"]);
  });

  it("webApplication() and article() reference the creator by @id", () => {
    const w = webApplication() as Record<string, unknown>;
    expect(w.author).toEqual({ "@id": CREATOR_ID });
    expect(w.creator).toEqual({ "@id": CREATOR_ID });
    expect(w.codeRepository).toBe(CREATOR.repoUrl);
    const a = article({
      headline: "H",
      description: "D",
      path: "/guides/x",
      updated: "2026-01-01",
    }) as Record<string, unknown>;
    expect(a.author).toEqual({ "@id": CREATOR_ID });
    expect(a.publisher).toMatchObject({ "@type": "Organization", name: SITE.name });
  });

  it("emits no Store URL anywhere when unset", () => {
    expect(JSON.stringify([creator(), webApplication()])).not.toContain("microsoft");
  });
});
