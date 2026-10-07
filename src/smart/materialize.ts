import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { svgToDataURL } from "@/library/svg";
import type { El } from "./reconcile";
import { routeArrow } from "./reconcile";
import { META_KEY, type Generated, type Props, type SmartMeta } from "./types";

export const instancePrefix = (instance: string) => `sc_${instance}_`;
export const roleOfId = (instance: string, id: string) => id.slice(instancePrefix(instance).length);

/** Deterministic positive 31-bit hash: identical roles always draw identically (stable seeds). */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 1 || 1;
}

export interface MaterializeMeta {
  id: string;
  version: number;
  instance: string;
  props: Props;
  /** Embedded on the root element for custom components so files stay regenerable anywhere. */
  def?: unknown;
}

export interface Materialized {
  elements: OrderedExcalidrawElement[];
  files: BinaryFileData[];
  /** Id of the root element ("root" role, else the first part). */
  rootId: string;
}

/**
 * Run the skeletons through Excalidraw's converter (which binds arrows and sizes text), then give
 * every element a stable id derived from its role, a deterministic seed and smart-component metadata.
 */
export async function materialize(gen: Generated, meta: MaterializeMeta): Promise<Materialized> {
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const prefix = instancePrefix(meta.instance);
  const els = convertToExcalidrawElements(
    gen.parts.map((p) => p.skeleton),
    { regenerateIds: false },
  ) as OrderedExcalidrawElement[];

  const known = new Set(gen.parts.map((p) => p.role));
  const idMap = new Map<string, string>();
  const roleMap = new Map<string, string>();
  for (const e of els) {
    if (known.has(e.id)) {
      idMap.set(e.id, `${prefix}${e.id}`);
      roleMap.set(e.id, e.id);
    }
  }
  // Bound text (labels of shapes and arrows) is created by the converter with random ids.
  for (const e of els) {
    if (e.type === "text" && e.containerId && idMap.has(e.containerId)) {
      idMap.set(e.id, `${idMap.get(e.containerId)}:label`);
      roleMap.set(e.id, `${roleMap.get(e.containerId)}:label`);
    }
  }
  const remap = (id: string) => idMap.get(id) ?? id;

  const rootRole = known.has("root") ? "root" : gen.parts[0]!.role;
  const out = els.map((e) => {
    const role = roleMap.get(e.id) ?? e.id;
    const m: SmartMeta = {
      id: meta.id,
      version: meta.version,
      instance: meta.instance,
      role,
      props: meta.props,
      ...(role === rootRole && meta.def ? { def: meta.def } : {}),
    };
    const anyE = e as unknown as Record<string, unknown>;
    const next: Record<string, unknown> = {
      ...anyE,
      id: remap(e.id),
      seed: hashSeed(role),
      versionNonce: hashSeed(`${role}:n`),
      version: 1,
      updated: 1,
      customData: { ...(e.customData ?? {}), [META_KEY]: m },
    };
    if (e.type === "text" && e.containerId) next.containerId = remap(e.containerId);
    if (e.boundElements)
      next.boundElements = e.boundElements.map((b) => ({ ...b, id: remap(b.id) }));
    const sb = (e as unknown as { startBinding?: { elementId: string } | null }).startBinding;
    const eb = (e as unknown as { endBinding?: { elementId: string } | null }).endBinding;
    if (sb) next.startBinding = { ...sb, elementId: remap(sb.elementId) };
    if (eb) next.endBinding = { ...eb, elementId: remap(eb.elementId) };
    return next as unknown as OrderedExcalidrawElement;
  });

  // The converter binds arrows but leaves their geometry at the default: route them between shapes.
  const final = new Map(out.map((e) => [e.id, e as unknown as El]));
  for (let i = 0; i < out.length; i++) {
    const e = out[i]!;
    if (e.type !== "arrow") continue;
    const r = routeArrow(e as unknown as El, final);
    if (!r) continue;
    out[i] = { ...e, ...r } as unknown as OrderedExcalidrawElement;
    final.set(e.id, out[i] as unknown as El);
    // Keep the arrow's label centred on the new route.
    const li = out.findIndex((t) => t.type === "text" && t.containerId === e.id);
    if (li >= 0) {
      const label = out[li]!;
      out[li] = {
        ...label,
        x: r.x + r.points[1]![0] / 2 - label.width / 2,
        y: r.y + r.points[1]![1] / 2 - label.height / 2,
      } as OrderedExcalidrawElement;
    }
  }

  const files: BinaryFileData[] = gen.files.map((f) => ({
    id: f.id as BinaryFileData["id"],
    mimeType: "image/svg+xml",
    dataURL: svgToDataURL(f.svg) as BinaryFileData["dataURL"],
    created: 1,
  }));
  return { elements: out, files, rootId: remap(rootRole) };
}

export const asEl = (e: unknown) => e as El;
