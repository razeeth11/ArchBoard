import { KINDS } from "@/dsl/kinds";
import { parseDsl, type Diagnostic } from "@/dsl/parser";

export const AI_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_PROMPT = 2000;

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "network" | "rate" | "server" | "empty" | "invalid" = "server",
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** The model only ever produces text in our own DSL, which we parse like any user input. */
export function systemPrompt(): string {
  return `You turn a short description of a software system into a diagram written in the ArchBoard diagram DSL. Reply with the DSL only: no prose, no markdown fences.

Grammar (one statement per line):
- Node: kind [tech] ["label"]   (e.g. service api "Orders API", db postgres "Orders DB", cache redis "Cache")
- Give a node an id with: kind id "label" (only when the second word is not a known tech). Refer to a node later by its id, or if it has none by its label in lower case with dashes.
- Edges: a -> b (solid), a --> b (dashed), a <-> b (two-way), a -[label]-> b (labelled). Chain edges on one line.
- Replicas: [api x3]   Directives: direction LR|TB, layout tree|radial|layered, title "Text"
- Lines starting with # are comments. At most 40 nodes.

Known kinds: ${Object.keys(KINDS).join(", ")}.

Example:
title "URL shortener"
direction LR
user "Visitors" -> cdn cloudfront "CDN" -> lb nginx "Load balancer" -> service app "Shortener API"
app -> cache redis "Hot links"
app -> db postgres "Links DB"`;
}

/** Strip fences/prose the model may add despite instructions. */
export function extractDsl(text: string): string {
  const fenced = /```[a-z]*\n([\s\S]*?)```/i.exec(text);
  return (fenced?.[1] ?? text).trim();
}

export interface AiResult {
  source: string;
  diagnostics: Diagnostic[];
}

export async function generateDsl(
  prompt: string,
  opts: { apiKey: string; model?: string; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<AiResult> {
  const text = prompt.trim().slice(0, MAX_PROMPT);
  if (!text) throw new AiError("Describe the system you want to draw.", "invalid");
  if (!opts.apiKey.trim()) throw new AiError("Add your API key first.", "auth");
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(AI_ENDPOINT, {
      method: "POST",
      signal: opts.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey.trim(),
        "anthropic-version": "2023-06-01",
        // Required by the API for calls made straight from a browser with the user's own key.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: opts.model?.trim() || DEFAULT_MODEL,
        max_tokens: 1500,
        system: systemPrompt(),
        messages: [{ role: "user", content: text }],
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AiError(
      "Could not reach api.anthropic.com. You may be offline, or the request was blocked.",
      "network",
    );
  }
  if (res.status === 401 || res.status === 403)
    throw new AiError("The API key was rejected. Check that it is correct and active.", "auth");
  if (res.status === 429) throw new AiError("Rate limited. Wait a moment and try again.", "rate");
  if (!res.ok) throw new AiError(`The API returned an error (${res.status}).`, "server");
  const data: unknown = await res.json().catch(() => null);
  const blocks = (data as { content?: { type?: string; text?: string }[] } | null)?.content;
  const out = (blocks ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
  const source = extractDsl(out);
  if (!source) throw new AiError("The model returned nothing usable. Try rephrasing.", "empty");
  return { source, diagnostics: parseDsl(source).diagnostics };
}
