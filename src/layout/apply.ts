import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { El } from "@/smart/reconcile";
import { useToasts } from "@/store/toasts";
import { layoutElements, type LayoutKind } from "./elk";

/** Auto-layout the selection (or the whole page when nothing is selected) as one undoable step. */
export async function applyLayout(api: ExcalidrawImperativeAPI, kind: LayoutKind) {
  const { CaptureUpdateAction } = await import("@excalidraw/excalidraw");
  const all = api.getSceneElementsIncludingDeleted();
  const sel = api.getAppState().selectedElementIds;
  const picked = all.filter((e) => !e.isDeleted && (Object.keys(sel).length ? sel[e.id] : true));
  const ids = new Set(picked.map((e) => e.id));
  // Bound labels of selected shapes and frames' children ride along.
  const withLabels = all.filter(
    (e) =>
      !e.isDeleted &&
      (ids.has(e.id) || (e.type === "text" && e.containerId && ids.has(e.containerId))),
  );
  const outside = all.filter(
    (e) => !e.isDeleted && !ids.has(e.id) && e.type === "arrow" && !withLabels.includes(e),
  );
  // Inserted diagrams arrive wrapped in one group. When every picked element shares the same outermost
  // group, lay out what is inside it, then put the wrapper back.
  const outer = (e: { groupIds: readonly string[] }) => e.groupIds[e.groupIds.length - 1];
  const wrapper =
    withLabels.length && withLabels.every((e) => outer(e) && outer(e) === outer(withLabels[0]!))
      ? outer(withLabels[0]!)
      : undefined;
  const unwrapped = wrapper
    ? withLabels.map((e) => ({ ...e, groupIds: e.groupIds.slice(0, -1) }))
    : withLabels;
  const res = await layoutElements(unwrapped as unknown as El[], kind, outside as unknown as El[]);
  if (wrapper) {
    res.elements = res.elements.map((e) =>
      withLabels.some((w) => w.id === e.id)
        ? ({ ...e, groupIds: [...((e.groupIds as string[]) ?? []), wrapper] } as El)
        : e,
    );
  }
  if (res.nodeCount < 2) {
    useToasts.getState().push({ message: "Layout needs at least two connected shapes." });
    return res;
  }
  const changed = new Map(res.elements.map((e) => [e.id, e as unknown as ExcalidrawElement]));
  api.updateScene({
    elements: all.map((e) => changed.get(e.id) ?? e),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(withLabels as never, { fitToViewport: true, animate: false });
  useToasts.getState().push({ message: `Laid out ${res.nodeCount} shapes. Undo with Ctrl/Cmd+Z.` });
  return res;
}
