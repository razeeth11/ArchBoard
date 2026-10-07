import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { findFreeSpot, viewportCenter } from "@/library/insert";
import { materialize, type Materialized } from "./materialize";
import { metaOf, reconcile, rebindExternal, type El } from "./reconcile";
import {
  META_KEY,
  normalizeProps,
  type Port,
  type Props,
  type SmartDef,
  type SmartMeta,
} from "./types";

const asEl = (e: ExcalidrawElement) => e as unknown as El;
const asEx = (e: El) => e as unknown as ExcalidrawElement;
export const newInstanceId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

export function instanceMembers(
  all: readonly ExcalidrawElement[],
  instance: string,
): ExcalidrawElement[] {
  return all.filter((e) => metaOf(asEl(e))?.instance === instance);
}

/** The smart component that the current selection belongs to, if any. */
export function instanceOfSelection(
  all: readonly ExcalidrawElement[],
  selectedIds: Readonly<Record<string, unknown>>,
): SmartMeta | null {
  for (const e of all) {
    if (e.isDeleted || !selectedIds[e.id]) continue;
    const m = metaOf(asEl(e));
    if (m) return m;
  }
  return null;
}

/** Meta of the instance's root (carries the embedded definition for custom components). */
export function rootMeta(members: readonly ExcalidrawElement[]): SmartMeta | undefined {
  const live = members.filter((e) => !e.isDeleted);
  const root = live.find((e) => metaOf(asEl(e))?.role === "root") ?? live[0];
  return root ? metaOf(asEl(root)) : undefined;
}

export function propsOfInstance(def: SmartDef, members: readonly ExcalidrawElement[]): Props {
  const withProps = members.find((e) => !e.isDeleted && metaOf(asEl(e))?.props);
  return normalizeProps(def.schema, withProps ? metaOf(asEl(withProps))!.props : {});
}

async function captureAction() {
  return (await import("@excalidraw/excalidraw")).CaptureUpdateAction.IMMEDIATELY;
}

function addFilesOnce(api: ExcalidrawImperativeAPI, m: Materialized) {
  const have = api.getFiles();
  const fresh = m.files.filter((f) => !have[f.id]);
  if (fresh.length) api.addFiles(fresh);
}

/** Insert a new instance (default props unless given) and select it as one group. */
export async function insertSmart(
  api: ExcalidrawImperativeAPI,
  def: SmartDef,
  rawProps: Props = {},
  at?: { x: number; y: number },
): Promise<string> {
  const { getCommonBounds } = await import("@excalidraw/excalidraw");
  const props = normalizeProps(def.schema, rawProps);
  const instance = newInstanceId();
  const gen = await def.generate(props);
  const mat = await materialize(gen, {
    id: def.id,
    version: def.version,
    instance,
    props,
    def: def.custom,
  });
  const [x1, y1, x2, y2] = getCommonBounds(mat.elements);
  let center = at;
  if (!center) {
    const c = viewportCenter(api);
    const taken = api.getSceneElements().map((e) => {
      const [a, b, cc, d] = getCommonBounds([e]);
      return { x1: a, y1: b, x2: cc, y2: d };
    });
    center = findFreeSpot(taken, c, x2 - x1, y2 - y1) ?? c;
  }
  const dx = center.x - (x1 + x2) / 2;
  const dy = center.y - (y1 + y2) / 2;
  const groupId = crypto.randomUUID();
  const placed = mat.elements.map((e) => ({
    ...e,
    x: e.x + dx,
    y: e.y + dy,
    groupIds: [...e.groupIds, groupId],
  }));
  addFilesOnce(api, mat);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...placed],
    appState: {
      selectedElementIds: Object.fromEntries(placed.map((e) => [e.id, true])),
      selectedGroupIds: { [groupId]: true },
    },
    captureUpdate: await captureAction(),
  });
  return instance;
}

export interface RegenerateResult {
  added: number;
  removed: number;
  kept: number;
}

/**
 * Re-run the generator with new props and merge the result into the scene in place: same position,
 * user style/label edits kept, outside arrows stay attached.
 */
export async function regenerate(
  api: ExcalidrawImperativeAPI,
  instance: string,
  def: SmartDef,
  nextRaw: Props,
): Promise<RegenerateResult> {
  const all = api.getSceneElementsIncludingDeleted();
  const members = instanceMembers(all, instance);
  const live = members.filter((e) => !e.isDeleted);
  if (!live.length) throw new Error("This component no longer exists on the canvas.");
  const oldProps = propsOfInstance(def, members);
  const newProps = normalizeProps(def.schema, nextRaw);
  const embedded = rootMeta(members)?.def ?? def.custom;

  const [oldGen, newGen] = await Promise.all([def.generate(oldProps), def.generate(newProps)]);
  const base = await materialize(oldGen, {
    id: def.id,
    version: def.version,
    instance,
    props: oldProps,
    def: embedded,
  });
  const next = await materialize(newGen, {
    id: def.id,
    version: def.version,
    instance,
    props: newProps,
    def: embedded,
  });

  const res = reconcile({
    current: live.map(asEl),
    baseline: base.elements as unknown as El[],
    next: next.elements as unknown as El[],
    rootId: next.rootId,
  });

  const groupIds = live[0]!.groupIds;
  const byId = new Map(res.elements.map((e) => [e.id, e]));
  for (const id of res.addedIds) {
    const e = byId.get(id)!;
    byId.set(id, {
      ...e,
      groupIds: [
        ...((e.groupIds as string[] | undefined) ?? []),
        ...groupIds.filter((g) => !((e.groupIds as string[] | undefined) ?? []).includes(g)),
      ],
    });
  }

  const instanceIds = new Set([...members.map((e) => e.id), ...res.addedIds]);
  const arrows = all
    .filter((e) => !instanceIds.has(e.id) && !e.isDeleted && e.type === "arrow")
    .map(asEl);
  const fixed = rebindExternal(arrows, byId, new Set(res.removedIds));
  for (const a of fixed) byId.set(a.id, a);

  // Rebuild the element list: replace in place, append genuinely new ones.
  const placed = new Set<string>();
  const merged: ExcalidrawElement[] = all.map((e) => {
    const r = byId.get(e.id);
    if (!r) return e;
    placed.add(e.id);
    return asEx(r);
  });
  for (const [id, e] of byId) if (!placed.has(id)) merged.push(asEx(e));

  addFilesOnce(api, next);
  const liveIds = [...byId.values()]
    .filter((e) => !e.isDeleted && instanceIds.has(e.id))
    .map((e) => e.id);
  api.updateScene({
    elements: merged,
    appState: {
      selectedElementIds: Object.fromEntries(liveIds.map((id) => [id, true])),
      selectedGroupIds: groupIds.length ? { [groupIds[groupIds.length - 1]!]: true } : {},
    },
    captureUpdate: await captureAction(),
  });
  return {
    added: res.addedIds.length,
    removed: res.removedIds.length,
    kept: live.length - res.removedIds.length,
  };
}

/** Remove the smart-component metadata: the shapes stay, as plain editable Excalidraw elements. */
export async function detach(api: ExcalidrawImperativeAPI, instance: string) {
  const all = api.getSceneElementsIncludingDeleted();
  const next = all.map((e) => {
    if (metaOf(asEl(e))?.instance !== instance) return e;
    const { [META_KEY]: _drop, ...rest } = (e.customData ?? {}) as Record<string, unknown>;
    void _drop;
    return {
      ...e,
      customData: Object.keys(rest).length ? rest : undefined,
      version: e.version + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
    } as ExcalidrawElement;
  });
  api.updateScene({ elements: next, captureUpdate: await captureAction() });
}

/** Ports of the current props, resolved to the live element ids. */
export async function portsOf(
  def: SmartDef,
  instance: string,
  props: Props,
): Promise<(Port & { elementId: string })[]> {
  const gen = await def.generate(props);
  return gen.ports.map((p) => ({ ...p, elementId: `sc_${instance}_${p.role}` }));
}

/** Draw an arrow from an outside element to a port, bound at both ends. */
export async function connectToPort(
  api: ExcalidrawImperativeAPI,
  fromId: string,
  portElementId: string,
) {
  const { convertToExcalidrawElements, CaptureUpdateAction } =
    await import("@excalidraw/excalidraw");
  const all = api.getSceneElementsIncludingDeleted();
  const from = all.find((e) => e.id === fromId);
  const to = all.find((e) => e.id === portElementId);
  if (!from || !to || from.isDeleted || to.isDeleted)
    throw new Error("Select a shape outside the component first.");
  const fc: [number, number] = [from.x + from.width / 2, from.y + from.height / 2];
  const tc: [number, number] = [to.x + to.width / 2, to.y + to.height / 2];
  const clip = (
    c: [number, number],
    other: [number, number],
    b: ExcalidrawElement,
  ): [number, number] => {
    const hw = b.width / 2 + 8;
    const hh = b.height / 2 + 8;
    const dx = other[0] - c[0];
    const dy = other[1] - c[1];
    const t = Math.min(
      dx !== 0 ? hw / Math.abs(dx) : Infinity,
      dy !== 0 ? hh / Math.abs(dy) : Infinity,
    );
    return [c[0] + dx * t, c[1] + dy * t];
  };
  const p1 = clip(fc, tc, from);
  const p2 = clip(tc, fc, to);
  const [arrow] = convertToExcalidrawElements([
    {
      type: "arrow",
      x: p1[0],
      y: p1[1],
      points: [
        [0, 0],
        [p2[0] - p1[0], p2[1] - p1[1]],
      ] as never,
    },
  ]);
  if (!arrow) return;
  const bound = {
    ...arrow,
    startBinding: { elementId: from.id, focus: 0, gap: 8 },
    endBinding: { elementId: to.id, focus: 0, gap: 8 },
  } as unknown as ExcalidrawElement;
  const link = (e: ExcalidrawElement) =>
    ({
      ...e,
      boundElements: [...(e.boundElements ?? []), { id: arrow.id, type: "arrow" }],
      version: e.version + 1,
    }) as ExcalidrawElement;
  api.updateScene({
    elements: [...all.map((e) => (e.id === from.id || e.id === to.id ? link(e) : e)), bound],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}
