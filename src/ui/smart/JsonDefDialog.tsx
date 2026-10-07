"use client";

import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { downloadText } from "@/store/workspace";
import { useSmart } from "@/store/smart";
import { useUi } from "@/store/ui";
import { SMART_DEFS } from "@/smart/defs";
import { parseTemplateDef, TEMPLATE_SCHEMA, type TemplateDef } from "@/smart/template";

const SAMPLE: TemplateDef = {
  schema: TEMPLATE_SCHEMA,
  id: "my-service-box",
  name: "My service box",
  version: 1,
  description: "A labelled service that can repeat.",
  params: [
    { key: "name", label: "Name", type: "text", default: "Service" },
    { key: "count", label: "Copies", type: "number", default: 2, min: 1, max: 6 },
    { key: "showDb", label: "Database", type: "boolean", default: true },
  ],
  nodes: [
    {
      role: "svc",
      element: {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 140,
        height: 60,
        backgroundColor: "#d3f9d8",
        text: "{{name}} {{i}}",
      },
      repeat: { count: "count", dx: 0, dy: 80 },
    },
    {
      role: "db",
      element: {
        type: "ellipse",
        x: 200,
        y: 0,
        width: 100,
        height: 60,
        backgroundColor: "#ffe8cc",
        text: "DB",
      },
      visibleIf: "showDb",
    },
    {
      role: "link",
      element: { type: "arrow", x: 0, y: 0, start: "svc", end: "db", text: "reads" },
      repeat: { count: "count", dx: 0, dy: 80 },
      visibleIf: "showDb",
    },
  ],
  ports: [{ name: "in", role: "svc", description: "First service" }],
};

export function JsonDefDialog() {
  const dialog = useUi((s) => s.smartDialog);
  const open = dialog?.mode === "json";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && useUi.getState().setSmartDialog(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="bg-bg text-fg border-border fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(94vw,44rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-5 shadow-xl"
          aria-describedby="json-def-desc"
        >
          {open && <Body editId={dialog.id} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ editId }: { editId?: string }) {
  const custom = useSmart((s) => s.customDefs);
  const saveDef = useSmart((s) => s.saveDef);
  const [text, setText] = useState(() => JSON.stringify(editId ? custom[editId] : SAMPLE, null, 2));
  const [saved, setSaved] = useState(false);

  const result = useMemo(() => {
    try {
      const parsed = parseTemplateDef(JSON.parse(text));
      if (parsed.ok && SMART_DEFS.some((d) => d.id === parsed.def.id))
        return {
          ok: false as const,
          errors: [`"id" ${parsed.def.id} is used by a built-in component.`],
        };
      return parsed;
    } catch (e) {
      return { ok: false as const, errors: [`Not valid JSON: ${(e as Error).message}`] };
    }
  }, [text]);

  return (
    <>
      <Dialog.Title className="text-lg font-semibold">
        {editId ? "Edit component definition" : "New component from JSON"}
      </Dialog.Title>
      <Dialog.Description id="json-def-desc" className="text-muted mt-1 text-sm">
        Definitions are plain JSON (no code runs). Parameters become the properties panel;{" "}
        <code>{"{{param}}"}</code> fills text; <code>repeat</code> multiplies a node;{" "}
        <code>visibleIf</code> toggles one.
      </Dialog.Description>
      <label className="mt-3 block min-h-0 flex-1">
        <span className="sr-only">Definition JSON</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          spellCheck={false}
          data-testid="json-def-text"
          className="border-border bg-bg h-72 w-full rounded-md border p-2 font-mono text-xs"
        />
      </label>
      <div role="status" data-testid="json-def-status" className="mt-2 min-h-12 text-sm">
        {result.ok ? (
          <span className="text-green-700 dark:text-green-400">
            Valid: {result.def.name} ({result.def.nodes.length} nodes, {result.def.params.length}{" "}
            parameters)
          </span>
        ) : (
          <ul className="list-disc pl-5 text-red-700 dark:text-red-400">
            {result.errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {saved && (
          <span className="text-muted block">Saved. Find it under Smart → Your components.</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="border-border rounded-md border px-3 py-1.5 text-sm"
          onClick={() => useUi.getState().setSmartDialog(null)}
        >
          Close
        </button>
        <button
          type="button"
          disabled={!result.ok}
          className="border-border rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() =>
            result.ok &&
            downloadText(
              JSON.stringify(result.def, null, 2),
              `${result.def.id}.archboard-smart.json`,
            )
          }
        >
          Download
        </button>
        <button
          type="button"
          disabled={!result.ok}
          className="bg-accent text-accent-fg rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          onClick={async () => {
            if (!result.ok) return;
            await saveDef(result.def);
            setSaved(true);
          }}
        >
          Save
        </button>
      </div>
    </>
  );
}
