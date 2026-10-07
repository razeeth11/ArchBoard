import { describe, expect, it, vi } from "vitest";
import { AI_ENDPOINT, AiError, extractDsl, generateDsl, systemPrompt } from "@/ai/generate";

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const ok = (text: string) => reply(200, { content: [{ type: "text", text }] });

describe("bring-your-own-key generation", () => {
  it("sends the key only to the Anthropic endpoint, with no credentials or referrer", async () => {
    const f = ok('service api "API" -> db postgres "DB"');
    const r = await generateDsl("an api and a db", { apiKey: " sk-test ", fetchImpl: f });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    expect(url).toBe(AI_ENDPOINT);
    const h = init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("sk-test");
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(JSON.parse(init.body as string).messages[0].content).toBe("an api and a db");
    expect(r.diagnostics).toEqual([]);
  });
  it("strips markdown fences and reports DSL diagnostics instead of trusting the model", async () => {
    expect(extractDsl("```dsl\nservice a\n```")).toBe("service a");
    const r = await generateDsl("x", { apiKey: "k", fetchImpl: ok("```\nservce a\n```") });
    expect(r.source).toBe("servce a");
    expect(r.diagnostics.length).toBeGreaterThan(0);
  });
  it("turns failures into friendly, specific errors", async () => {
    const run = (f: typeof fetch) => generateDsl("x", { apiKey: "k", fetchImpl: f });
    await expect(run(reply(401, {}))).rejects.toMatchObject({ kind: "auth" });
    await expect(run(reply(429, {}))).rejects.toMatchObject({ kind: "rate" });
    await expect(run(reply(500, {}))).rejects.toMatchObject({ kind: "server" });
    await expect(run(ok("   "))).rejects.toMatchObject({ kind: "empty" });
    await expect(
      run((async () => Promise.reject(new TypeError("net"))) as typeof fetch),
    ).rejects.toMatchObject({
      kind: "network",
    });
    await expect(generateDsl("", { apiKey: "k" })).rejects.toBeInstanceOf(AiError);
    await expect(generateDsl("x", { apiKey: " " })).rejects.toMatchObject({ kind: "auth" });
  });
  it("teaches the model the real vocabulary", () => {
    const p = systemPrompt();
    expect(p).toContain("postgres");
    expect(p).toContain("a -[label]-> b");
  });
});
