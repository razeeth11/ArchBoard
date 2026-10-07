export type TabMessage =
  | { kind: "page-saved"; sceneId: string; pageId: string; rev: number; from: string }
  | { kind: "workspace-changed"; from: string };

export const TAB_ID = typeof crypto !== "undefined" ? crypto.randomUUID() : "ssr";

let channel: BroadcastChannel | null = null;
function ch(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return (channel ??= new BroadcastChannel("archboard"));
}

type Outgoing = TabMessage extends infer M
  ? M extends { from: string }
    ? Omit<M, "from">
    : never
  : never;

export function postTab(msg: Outgoing) {
  ch()?.postMessage({ ...msg, from: TAB_ID });
}

export function onTabMessage(cb: (m: TabMessage) => void): () => void {
  const c = ch();
  if (!c) return () => {};
  const handler = (e: MessageEvent<TabMessage>) => {
    if (e.data.from !== TAB_ID) cb(e.data);
  };
  c.addEventListener("message", handler);
  return () => c.removeEventListener("message", handler);
}
