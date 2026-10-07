export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

/**
 * Debounced, serialized saver. `schedule` takes a thunk so we never serialize on every pointer event:
 * only the last thunk before the debounce fires (or a flush) runs. Saves never overlap.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => Promise<void>) | null = null;
  private inflight: Promise<void> = Promise.resolve();
  private paused = false;

  constructor(
    private readonly delayMs = 500,
    private readonly onStatus: (s: SaveStatus, err?: unknown) => void = () => {},
  ) {}

  get hasPending(): boolean {
    return this.pending !== null;
  }

  schedule(job: () => Promise<void>) {
    this.pending = job;
    if (this.paused) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  pause() {
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  resume() {
    this.paused = false;
    if (this.pending) void this.flush();
  }

  /** Drop unsaved work (used when the user chooses "load latest" after a conflict). */
  discard() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.paused) return this.inflight;
    const job = this.pending;
    this.pending = null;
    if (!job) return this.inflight;
    this.inflight = this.inflight.then(async () => {
      this.onStatus("saving");
      try {
        await job();
        this.onStatus(this.pending ? "saving" : "saved");
      } catch (e) {
        this.onStatus("error", e);
      }
    });
    return this.inflight;
  }
}
