"use client";

import { Minus, Plus, RotateCcw, Unlink, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import { useSmart } from "@/store/smart";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import {
  connectToPort,
  detach,
  instanceMembers,
  portsOf,
  propsOfInstance,
  regenerate,
  rootMeta,
} from "@/smart/instance";
import { metaOf, type El } from "@/smart/reconcile";
import { resolveDef } from "@/smart/registry";
import { defaultsOf, type PropSchema, type Props, type SmartDef } from "@/smart/types";

const field = "border-border bg-bg rounded-md border px-2 py-1 text-sm";

function Control({
  p,
  value,
  onChange,
}: {
  p: PropSchema;
  value: Props[string];
  onChange: (v: Props[string]) => void;
}) {
  const id = `sc-${p.key}`;
  if (p.type === "number") {
    const v = Number(value);
    const step = p.step ?? 1;
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${p.label}`}
          disabled={v <= p.min}
          className="border-border rounded border p-1 disabled:opacity-40"
          onClick={() => onChange(v - step)}
        >
          <Minus size={14} aria-hidden />
        </button>
        <input
          id={id}
          type="number"
          min={p.min}
          max={p.max}
          step={step}
          value={v}
          className={`${field} w-16 text-center`}
          onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        />
        <button
          type="button"
          aria-label={`Increase ${p.label}`}
          disabled={v >= p.max}
          className="border-border rounded border p-1 disabled:opacity-40"
          onClick={() => onChange(v + step)}
        >
          <Plus size={14} aria-hidden />
        </button>
        <span className="text-muted text-xs">
          {p.min}–{p.max}
        </span>
      </div>
    );
  }
  if (p.type === "select") {
    return (
      <select
        id={id}
        className={`${field} w-full`}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {p.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (p.type === "boolean") {
    return (
      <input
        id={id}
        type="checkbox"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    );
  }
  return <TextControl id={id} p={p} value={String(value)} onChange={onChange} />;
}

function TextControl({
  id,
  p,
  value,
  onChange,
}: {
  id: string;
  p: Extract<PropSchema, { type: "text" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      queueMicrotask(() => setLocal(value));
    }
  }, [value]);
  useEffect(() => {
    if (local === last.current) return;
    const t = setTimeout(() => {
      last.current = local;
      onChange(local);
    }, 250);
    return () => clearTimeout(t);
  }, [local, onChange]);
  return (
    <input
      id={id}
      className={`${field} w-full`}
      value={local}
      maxLength={p.maxLength ?? 60}
      onChange={(e) => setLocal(e.target.value)}
    />
  );
}

export function SmartInspector() {
  const selected = useSmart((s) => s.selected);
  const rev = useSmart((s) => s.rev);
  const custom = useSmart((s) => s.customDefs);
  const bump = useSmart((s) => s.bump);
  const componentsOpen = useUi((s) => s.componentsOpen);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [ports, setPorts] = useState<{ name: string; description: string; elementId: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);

  const api = getEditorApi();
  const members =
    selected && api
      ? instanceMembers(api.getSceneElementsIncludingDeleted(), selected.instance)
      : [];
  const live = members.filter((e) => !e.isDeleted);
  const root = rootMeta(members);
  const def: SmartDef | null = root ? resolveDef(root, custom) : null;
  const props = def ? propsOfInstance(def, members) : null;
  void rev;

  useEffect(() => {
    if (!def || !props || !selected) return;
    let alive = true;
    void portsOf(def, selected.instance, props).then((p) => alive && setPorts(p));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.id, selected?.instance, JSON.stringify(props)]);

  const apply = (next: Props) => {
    const a = getEditorApi();
    if (!a || !def || !selected) return;
    // Serialize regenerations so rapid clicks on a stepper never interleave.
    queue.current = queue.current.then(async () => {
      setBusy(true);
      try {
        await regenerate(a, selected.instance, def, next);
        bump();
      } catch (e) {
        useToasts
          .getState()
          .push({ message: e instanceof Error ? e.message : "Could not update the component" });
      } finally {
        setBusy(false);
      }
    });
  };

  if (!selected || !api || live.length === 0) return null;

  if (!def || !props) {
    return (
      <aside
        aria-label="Smart component properties"
        data-testid="smart-inspector"
        className={`bg-bg text-fg border-border fixed bottom-16 z-20 w-72 rounded-xl border p-3 shadow-xl ${componentsOpen ? "right-[21rem]" : "right-3"}`}
      >
        <h2 className="text-sm font-semibold">Smart component</h2>
        <p className="text-muted mt-1 text-xs">
          Its definition “{root?.id ?? selected.id}” is not installed here, so it cannot be edited
          with properties. The shapes stay fully editable.
        </p>
        <button
          type="button"
          className="border-border mt-2 rounded-md border px-2 py-1 text-xs"
          onClick={() => void detach(api, selected.instance).then(bump)}
        >
          Convert to plain shapes
        </button>
      </aside>
    );
  }

  const outdated = (root?.version ?? def.version) < def.version;
  const selectedIds = api.getAppState().selectedElementIds;
  const external = api
    .getSceneElements()
    .find(
      (e) =>
        selectedIds[e.id] &&
        !metaOf(e as unknown as El)?.instance &&
        e.type !== "arrow" &&
        e.type !== "text",
    );

  return (
    <aside
      aria-label="Smart component properties"
      data-testid="smart-inspector"
      className={`bg-bg text-fg border-border fixed bottom-16 z-20 flex max-h-[70dvh] w-72 flex-col rounded-xl border shadow-xl ${componentsOpen ? "right-[21rem]" : "right-3"}`}
    >
      <div className="border-border flex items-center gap-2 border-b p-3">
        <Wand2 size={16} className="text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{def.name}</h2>
          <p className="text-muted text-xs">
            v{root?.version ?? def.version} · {live.length} shapes{busy ? " · updating…" : ""}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {outdated && (
          <button
            type="button"
            className="bg-accent text-accent-fg w-full rounded-md px-2 py-1 text-xs"
            onClick={() => apply(props)}
          >
            Update to v{def.version}
          </button>
        )}
        {def.schema.map((p) => (
          <div
            key={p.key}
            className={
              p.type === "boolean" ? "flex items-center justify-between gap-2" : "space-y-1"
            }
          >
            <label htmlFor={`sc-${p.key}`} className="text-sm">
              {p.label}
            </label>
            <Control
              p={p}
              value={props[p.key]!}
              onChange={(v) => apply({ ...props, [p.key]: v })}
            />
          </div>
        ))}

        {ports.length > 0 && (
          <section>
            <h3 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              Connection ports
            </h3>
            <p className="text-muted mb-1 text-xs">
              Shift-click the component and another shape, then connect it to a port. Arrows follow
              when the component changes.
            </p>
            <ul className="space-y-1">
              {ports.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate" title={p.description}>
                    <code>{p.name}</code>
                  </span>
                  <button
                    type="button"
                    disabled={!external}
                    aria-label={`Connect selected shape to port ${p.name}`}
                    className="border-border rounded border px-1.5 py-0.5 disabled:opacity-40"
                    onClick={() => {
                      if (!external) return;
                      void connectToPort(api, external.id, p.elementId)
                        .then(bump)
                        .catch((e) =>
                          useToasts.getState().push({
                            message: e instanceof Error ? e.message : "Could not connect",
                          }),
                        );
                    }}
                  >
                    Connect
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="border-border flex gap-2 border-t p-2">
        <button
          type="button"
          className="border-border flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs"
          onClick={() => apply(defaultsOf(def.schema))}
        >
          <RotateCcw size={12} aria-hidden /> Reset
        </button>
        <button
          type="button"
          className="border-border flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs"
          onClick={() => void detach(api, selected.instance).then(bump)}
        >
          <Unlink size={12} aria-hidden /> Detach
        </button>
      </div>
    </aside>
  );
}
