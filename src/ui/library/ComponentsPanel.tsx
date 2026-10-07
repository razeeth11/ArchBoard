"use client";

import { Search, Upload, X } from "lucide-react";
import { Tabs } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { getEditorApi } from "@/engine/apiRef";
import {
  BLOCKS,
  CATEGORY_COLORS,
  TECH,
  searchBlocks,
  searchTech,
  type BlockCategory,
} from "@/library/blocks";
import {
  ALLOWED_PREFIXES,
  OnlineError,
  fetchOnlineIcon,
  searchOnlineIcons,
} from "@/library/iconify";
import type { IconData, IconHit } from "@/library/icons";
import { searchLocalIcons } from "@/library/icons";
import { DRAG_MIME, buildPayload, insertItem, type Payload } from "@/library/insert";
import { KITS, searchKits, type KitId } from "@/library/kits";
import { importSvgIntoScene, looksLikeSvg, readSvgFile } from "@/library/svgImport";
import { useToasts } from "@/store/toasts";
import { useUi } from "@/store/ui";
import { IconPreview } from "./IconPreview";
import { SmartTab, insertSmartById } from "@/ui/smart/SmartTab";

export async function insertPayload(p: Payload, at?: { x: number; y: number }) {
  const api = getEditorApi();
  if (!api) return;
  try {
    if (p.type === "smart") return void (await insertSmartById(p.id, at));
    await insertItem(api, await buildPayload(p), { at });
  } catch (e) {
    useToasts
      .getState()
      .push({ message: e instanceof Error ? e.message : "Could not insert that item" });
  }
}

function Card({
  payload,
  title,
  sub,
  preview,
}: {
  payload: Payload;
  title: string;
  sub?: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => void insertPayload(payload)}
      title={sub ? `${title} — ${sub}` : title}
      data-testid="library-item"
      className="border-border hover:bg-surface flex w-full items-center gap-2 rounded-lg border p-2 text-left"
    >
      {preview}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        {sub && <span className="text-muted block truncate text-xs">{sub}</span>}
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <div className="grid grid-cols-1 gap-1.5">{children}</div>
    </section>
  );
}

function BlocksTab({ q }: { q: string }) {
  const items = useMemo(() => searchBlocks(q), [q]);
  const cats = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))) as BlockCategory[],
    [items],
  );
  if (!items.length) return <p className="text-muted text-sm">No components match “{q}”.</p>;
  return (
    <>
      {cats.map((c) => (
        <Group key={c} title={c}>
          {items
            .filter((i) => i.category === c)
            .map((i) => (
              <Card
                key={i.id}
                payload={{ type: "block", id: i.id }}
                title={i.name}
                sub={i.description}
                preview={
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background:
                        CATEGORY_COLORS[c].bg === "transparent"
                          ? "var(--surface)"
                          : CATEGORY_COLORS[c].bg,
                    }}
                  >
                    <IconPreview iconRef={i.icon} size={22} />
                  </span>
                }
              />
            ))}
        </Group>
      ))}
    </>
  );
}

function TechTab({ q }: { q: string }) {
  const items = useMemo(() => searchTech(q), [q]);
  const groups = useMemo(() => Array.from(new Set(items.map((i) => i.group))), [items]);
  if (!items.length) return <p className="text-muted text-sm">No technologies match “{q}”.</p>;
  return (
    <>
      <p className="text-muted mb-3 text-xs">
        Logos identify technologies and are trademarks of their owners. Sources and licenses are on
        the{" "}
        <a className="underline" href="/credits" target="_blank" rel="noreferrer">
          credits page
        </a>
        .
      </p>
      {groups.map((g) => (
        <Group key={g} title={g}>
          {items
            .filter((i) => i.group === g)
            .map((i) => (
              <Card
                key={i.id}
                payload={{ type: "tech", id: i.id }}
                title={i.name}
                preview={<IconPreview iconRef={i.icon} size={28} />}
              />
            ))}
        </Group>
      ))}
    </>
  );
}

function ShapesTab({ q }: { q: string }) {
  const [kit, setKit] = useState<KitId | "all">("all");
  const items = useMemo(() => searchKits(q, kit === "all" ? undefined : kit), [q, kit]);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Diagram kit">
        {[{ id: "all" as const, name: "All" }, ...KITS].map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={kit === k.id}
            onClick={() => setKit(k.id)}
            className={`rounded-full border px-2 py-0.5 text-xs ${kit === k.id ? "bg-accent text-accent-fg border-accent" : "border-border"}`}
          >
            {k.name}
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="text-muted text-sm">No shapes match “{q}”.</p>}
      <div className="grid grid-cols-1 gap-1.5">
        {items.map((i) => (
          <Card
            key={i.id}
            payload={{ type: "kit", id: i.id }}
            title={i.name}
            sub={KITS.find((k) => k.id === i.kit)?.name}
            preview={
              <span className="bg-surface text-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] uppercase">
                {i.kit.slice(0, 3)}
              </span>
            }
          />
        ))}
      </div>
    </>
  );
}

function IconsTab({ q }: { q: string }) {
  const online = useUi((s) => s.iconifyOnline);
  const setOnline = useUi((s) => s.setIconifyOnline);
  const [local, setLocal] = useState<IconHit[]>([]);
  const [remote, setRemote] = useState<{ ref: string; data?: IconData }[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void searchLocalIcons(q)
      .catch(() => [] as IconHit[])
      .then((hits) => alive && setLocal(hits));
    return () => {
      alive = false;
    };
  }, [q]);

  useEffect(() => {
    if (!online || q.trim().length < 2) {
      queueMicrotask(() => {
        setRemote([]);
        setMessage(null);
      });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const refs = await searchOnlineIcons(q, ctrl.signal);
        setRemote(refs.map((ref) => ({ ref })));
        setMessage(refs.length ? null : "No online results.");
        // Preview data is fetched lazily, sanitized, and capped to the first few results.
        for (const ref of refs.slice(0, 24)) {
          const data = await fetchOnlineIcon(ref, ctrl.signal).catch(() => null);
          if (ctrl.signal.aborted) return;
          if (data) setRemote((cur) => cur.map((r) => (r.ref === ref ? { ...r, data } : r)));
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setRemote([]);
        setMessage(e instanceof OnlineError ? e.message : "Online search failed.");
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [online, q]);

  return (
    <>
      <label className="border-border mb-3 flex items-start gap-2 rounded-lg border p-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={online}
          onChange={(e) => setOnline(e.target.checked)}
        />
        <span>
          Also search online (Iconify)
          <span className="text-muted block text-xs">
            Off by default. When on, your search text is sent to api.iconify.design. Results are
            limited to permissively licensed sets ({ALLOWED_PREFIXES.length} sets). Bundled icons
            work offline.
          </span>
        </span>
      </label>
      {q.trim().length === 0 && (
        <p className="text-muted text-sm">Type to search {`>`}400 bundled icons.</p>
      )}
      {message && (
        <p role="status" className="text-muted mb-2 text-xs" data-testid="online-message">
          {message}
        </p>
      )}
      {local.length > 0 && (
        <Group title={`Bundled (${local.length})`}>
          <div className="grid grid-cols-4 gap-1.5">
            {local.map((h) => (
              <IconCell
                key={h.ref}
                payload={{ type: "icon", ref: h.ref }}
                label={h.ref}
                iconRef={h.ref}
              />
            ))}
          </div>
        </Group>
      )}
      {remote.length > 0 && (
        <Group title={`Online (${remote.length})`}>
          <div className="grid grid-cols-4 gap-1.5" data-testid="online-results">
            {remote.map((r) => (
              <IconCell
                key={r.ref}
                payload={{ type: "icon", ref: r.ref, online: true }}
                label={r.ref}
                data={r.data}
              />
            ))}
          </div>
        </Group>
      )}
      {q.trim().length > 0 && local.length === 0 && remote.length === 0 && !message && (
        <p className="text-muted text-sm">No icons match “{q}”.</p>
      )}
    </>
  );
}

function IconCell({
  payload,
  label,
  iconRef,
  data,
}: {
  payload: Payload;
  label: string;
  iconRef?: string;
  data?: IconData;
}) {
  return (
    <button
      type="button"
      draggable
      aria-label={`Insert icon ${label}`}
      title={label}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => void insertPayload(payload)}
      data-testid="icon-cell"
      className="border-border hover:bg-surface flex aspect-square items-center justify-center rounded-lg border"
    >
      <IconPreview iconRef={iconRef} data={data} size={26} />
    </button>
  );
}

function SvgTab() {
  const mode = useUi((s) => s.svgMode);
  const setMode = useUi((s) => s.setSvgMode);
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function run(source: string, name: string) {
    const api = getEditorApi();
    if (!api) return;
    try {
      const r = await importSvgIntoScene(api, source, name, mode);
      useToasts
        .getState()
        .push({ message: r.notes[0] ?? "SVG imported (scripts and external references removed)" });
      setText("");
    } catch (e) {
      useToasts
        .getState()
        .push({ message: e instanceof Error ? e.message : "Could not import that SVG" });
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted text-xs">
        Imports are treated as untrusted: scripts, event handlers, remote links and external styles
        are stripped before anything is added. You can also drop a .svg file or paste SVG markup
        onto the canvas.
      </p>
      <fieldset>
        <legend className="text-muted mb-1 text-xs font-semibold uppercase">Import as</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="SVG import mode">
          {(
            [
              ["image", "Vector image"],
              ["shapes", "Editable shapes"],
            ] as const
          ).map(([v, l]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-md border px-2.5 py-1 ${mode === v ? "bg-accent text-accent-fg border-accent" : "border-border"}`}
            >
              <input
                type="radio"
                className="sr-only"
                name="svg-mode"
                checked={mode === v}
                onChange={() => setMode(v)}
              />
              {l}
            </label>
          ))}
        </div>
        {mode === "shapes" && (
          <p className="text-muted mt-1 text-xs">
            Curves become polylines, so complex art is approximate.
          </p>
        )}
      </fieldset>
      <button
        type="button"
        className="border-border flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-3"
        onClick={() => file.current?.click()}
      >
        <Upload size={16} aria-hidden /> Choose an SVG file
      </button>
      <input
        ref={file}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        data-testid="svg-file-input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            await run(await readSvgFile(f), f.name.replace(/\.svg$/i, ""));
          } catch (err) {
            useToasts
              .getState()
              .push({ message: err instanceof Error ? err.message : "Could not read that file" });
          }
        }}
      />
      <label className="block">
        <span className="text-muted mb-1 block text-xs font-semibold uppercase">
          Or paste SVG markup
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder="<svg …>…</svg>"
          className="border-border bg-bg w-full rounded-md border p-2 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        disabled={!looksLikeSvg(text)}
        className="bg-accent text-accent-fg rounded-md px-3 py-1.5 font-medium disabled:opacity-50"
        onClick={() => void run(text, "pasted")}
      >
        Import pasted SVG
      </button>
    </div>
  );
}

const TAB =
  "border-b-2 px-2 py-1.5 text-sm data-[state=active]:border-accent data-[state=inactive]:border-transparent data-[state=inactive]:text-muted";

export function ComponentsPanel() {
  const open = useUi((s) => s.componentsOpen);
  const setOpen = useUi((s) => s.setComponentsOpen);
  const [q, setQ] = useState("");
  if (!open) return null;
  return (
    <aside
      id="components-panel"
      aria-label="Components"
      className="bg-bg text-fg border-border fixed top-14 right-0 bottom-0 z-30 flex w-80 max-w-[90vw] flex-col border-l shadow-xl"
    >
      <div className="border-border flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Components</h2>
        <button
          type="button"
          aria-label="Close components panel"
          className="rounded p-1"
          onClick={() => setOpen(false)}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <Tabs.Root defaultValue="smart" className="flex min-h-0 flex-1 flex-col">
        <div className="p-3 pb-0">
          <label className="relative block">
            <span className="sr-only">Search components</span>
            <Search size={14} className="text-muted absolute top-2.5 left-2" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="bg-bg border-border w-full rounded-md border py-1.5 pr-2 pl-7 text-sm"
            />
          </label>
        </div>
        <Tabs.List
          aria-label="Library sections"
          className="border-border mt-2 flex flex-wrap gap-x-1 border-b px-2"
        >
          <Tabs.Trigger value="smart" className={TAB}>
            Smart
          </Tabs.Trigger>
          <Tabs.Trigger value="blocks" className={TAB}>
            Blocks ({BLOCKS.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="tech" className={TAB}>
            Tech ({TECH.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="shapes" className={TAB}>
            Kits
          </Tabs.Trigger>
          <Tabs.Trigger value="icons" className={TAB}>
            Icons
          </Tabs.Trigger>
          <Tabs.Trigger value="svg" className={TAB}>
            SVG
          </Tabs.Trigger>
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <Tabs.Content value="smart">
            <SmartTab q={q} />
          </Tabs.Content>
          <Tabs.Content value="blocks">
            <BlocksTab q={q} />
          </Tabs.Content>
          <Tabs.Content value="tech">
            <TechTab q={q} />
          </Tabs.Content>
          <Tabs.Content value="shapes">
            <ShapesTab q={q} />
          </Tabs.Content>
          <Tabs.Content value="icons">
            <IconsTab q={q} />
          </Tabs.Content>
          <Tabs.Content value="svg">
            <SvgTab />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </aside>
  );
}
