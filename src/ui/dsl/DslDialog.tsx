"use client";

import { Wand2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { buildDsl, type DslBuild } from "@/dsl/build";
import { DSL_EXAMPLES } from "@/dsl/examples";
import type { Diagnostic } from "@/dsl/parser";
import { previewUrl } from "@/lib/preview";
import { insertElements } from "@/library/insert";
import { svgToDataURL } from "@/library/svg";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";

const STORAGE = "archboard:dsl:last";
const START = DSL_EXAMPLES[1]!.source;

/** Mirror layer with wavy underlines under the exact characters a diagnostic points at. */
function Mirror({ text, diagnostics }: { text: string; diagnostics: Diagnostic[] }) {
  const parts = useMemo(() => {
    const lines = text.split("\n");
    const starts: number[] = [];
    let off = 0;
    for (const l of lines) {
      starts.push(off);
      off += l.length + 1;
    }
    const marks = diagnostics
      .map((d) => ({
        from: (starts[d.line - 1] ?? 0) + d.col - 1,
        to: (starts[d.line - 1] ?? 0) + d.col - 1 + d.len,
        msg: d.message,
      }))
      .sort((a, b) => a.from - b.from);
    const out: { t: string; msg?: string }[] = [];
    let cur = 0;
    for (const m of marks) {
      if (m.from < cur) continue;
      out.push({ t: text.slice(cur, m.from) });
      out.push({ t: text.slice(m.from, Math.max(m.to, m.from + 1)) || " ", msg: m.msg });
      cur = Math.max(m.to, m.from + 1);
    }
    out.push({ t: text.slice(cur) + "\n" });
    return out;
  }, [text, diagnostics]);
  return (
    <>
      {parts.map((p, i) =>
        p.msg ? (
          <span
            key={i}
            title={p.msg}
            data-testid="dsl-squiggle"
            className="underline decoration-red-500 decoration-wavy"
          >
            {p.t}
          </span>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

export function DslDialog() {
  const open = useUi((s) => s.dialog === "dsl");
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && useUi.getState().setDialog(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[min(96vw,66rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-5 shadow-xl"
          aria-describedby="dsl-desc"
        >
          {open && <Body />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body() {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(STORAGE) ?? START;
    } catch {
      return START;
    }
  });
  const [build, setBuild] = useState<DslBuild | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const mirror = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const b = await buildDsl(text);
        let u: string | null = null;
        if (b.elements.length) {
          const files = Object.fromEntries(
            b.files.map((f) => [
              f.id,
              { id: f.id, mimeType: "image/svg+xml", dataURL: svgToDataURL(f.svg), created: 1 },
            ]),
          );
          u = await previewUrl(b.elements, files as never);
        }
        if (!alive) return u && URL.revokeObjectURL(u);
        setBuild(b);
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return u;
        });
        setFailure(null);
      } catch (e) {
        if (alive) setFailure(e instanceof Error ? e.message : "Could not render the diagram");
      }
    }, 350);
    try {
      localStorage.setItem(STORAGE, text);
    } catch {
      /* ignore */
    }
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text]);

  useEffect(
    () => () => {
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    },
    [],
  );

  const diagnostics = build?.diagnostics ?? [];
  const canInsert = !!build && build.elements.length > 0 && diagnostics.length === 0;

  async function insert() {
    const api = getEditorApi();
    if (!api || !build) return;
    try {
      await insertElements(api, build.elements, build.files, { kind: "kit", id: "dsl" });
      useUi.getState().setDialog(null);
    } catch (e) {
      useToasts.getState().push({ message: e instanceof Error ? e.message : "Could not insert" });
    }
  }

  return (
    <>
      <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
        <Wand2 size={18} aria-hidden /> Diagram as code
      </Dialog.Title>
      <Dialog.Description id="dsl-desc" className="text-muted mt-1 text-sm">
        Describe your system, one chain per line. Arrows are <code>-&gt;</code>, <code>--&gt;</code>{" "}
        (dashed), <code>-[label]-&gt;</code>. Replicas: <code>[api x3]</code>. See the{" "}
        <a className="underline" href="/guides/diagram-dsl" target="_blank" rel="noreferrer">
          guide
        </a>
        .
      </Dialog.Description>
      <div className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden md:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <label className="text-sm">
            <span className="sr-only">Examples</span>
            <select
              aria-label="Load an example"
              className="border-border bg-bg w-full rounded-md border px-2 py-1 text-sm"
              value=""
              onChange={(e) => {
                const ex = DSL_EXAMPLES.find((x) => x.id === e.target.value);
                if (ex) setText(ex.source);
              }}
            >
              <option value="">Load an example…</option>
              {DSL_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <div className="border-border bg-bg relative h-64 min-h-40 flex-1 overflow-hidden rounded-md border font-mono text-sm leading-6">
            <pre
              ref={mirror}
              aria-hidden
              className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-2 break-words whitespace-pre-wrap"
            >
              <Mirror text={text} diagnostics={diagnostics} />
            </pre>
            <textarea
              aria-label="Diagram source"
              data-testid="dsl-source"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={(e) => {
                if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
              }}
              className="absolute inset-0 h-full w-full resize-none bg-transparent p-2 font-mono text-sm leading-6 text-transparent caret-current outline-none selection:bg-blue-500/30"
              style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
            />
          </div>
          <ul
            data-testid="dsl-diagnostics"
            aria-live="polite"
            className="max-h-24 overflow-y-auto text-xs"
          >
            {diagnostics.length === 0 && build && (
              <li className="text-green-700 dark:text-green-400">
                No problems · {build.program.nodes.length} nodes, {build.program.edges.length}{" "}
                connections
              </li>
            )}
            {diagnostics.map((d, i) => (
              <li key={i} className="text-red-700 dark:text-red-400">
                Line {d.line}, col {d.col}: {d.message}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-border bg-surface flex min-h-48 items-center justify-center overflow-auto rounded-lg border p-2">
          {failure ? (
            <p role="alert" className="text-muted p-4 text-sm">
              {failure}
            </p>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Preview of the diagram"
              data-testid="dsl-preview"
              className="max-h-[55dvh] max-w-full object-contain"
            />
          ) : (
            <p className="text-muted text-sm">
              {diagnostics.length
                ? "Fix the underlined problems to see a preview."
                : "Type a diagram to see it here."}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="border-border rounded-md border px-3 py-1.5 text-sm"
          onClick={() => useUi.getState().setDialog(null)}
        >
          Close
        </button>
        <button
          type="button"
          disabled={!canInsert}
          onClick={() => void insert()}
          className="bg-accent text-accent-fg rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Insert diagram
        </button>
      </div>
    </>
  );
}
