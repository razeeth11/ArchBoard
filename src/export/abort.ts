export interface Progress {
  stage: string;
  /** 0..1 */
  value: number;
}

export interface Hooks {
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

export const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === "AbortError";

/** Give the browser a chance to paint and handle input between heavy stages. */
export const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function step(h: Hooks, stage: string, value: number) {
  throwIfAborted(h.signal);
  h.onProgress?.({ stage, value });
  await yieldToUi();
  throwIfAborted(h.signal);
}
