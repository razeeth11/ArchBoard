import { getDb } from "./db";
import { newId } from "./repo";
import type { Comment } from "./types";

export type Anchor = Comment["anchor"];

export async function listComments(sceneId: string, pageId: string): Promise<Comment[]> {
  const all = await getDb().comments.where("sceneId").equals(sceneId).toArray();
  return all.filter((c) => c.pageId === pageId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addComment(
  sceneId: string,
  pageId: string,
  text: string,
  anchor: Anchor,
): Promise<Comment> {
  const t = text.trim().slice(0, 2000);
  if (!t) throw new Error("Write something first.");
  const c: Comment = {
    id: newId(),
    sceneId,
    pageId,
    text: t,
    resolved: false,
    createdAt: Date.now(),
    anchor,
  };
  await getDb().comments.add(c);
  return c;
}

export async function setResolved(id: string, resolved: boolean) {
  await getDb().comments.update(id, { resolved });
}

export async function editComment(id: string, text: string) {
  const t = text.trim().slice(0, 2000);
  if (t) await getDb().comments.update(id, { text: t });
}

export async function deleteComment(id: string) {
  await getDb().comments.delete(id);
}

/** Where a comment points now: an element's top-right corner (if it still exists) or a fixed point. */
export function anchorPoint(
  a: Anchor,
  elements: readonly { id: string; x: number; y: number; width: number; isDeleted?: boolean }[],
): { x: number; y: number } | null {
  if ("elementId" in a) {
    const e = elements.find((x) => x.id === a.elementId && !x.isDeleted);
    return e ? { x: e.x + e.width, y: e.y } : null;
  }
  return a;
}
