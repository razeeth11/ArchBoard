import { getDb } from "./db";
import { newId } from "./repo";
import { SCHEMA_VERSION, type Page } from "./types";

/** Pages of a scene, in display order. */
export async function listPages(sceneId: string): Promise<Page[]> {
  const scene = await getDb().scenes.get(sceneId);
  if (!scene) return [];
  const rows = await getDb().pages.where("sceneId").equals(sceneId).toArray();
  const byId = new Map(rows.map((p) => [p.id, p]));
  return scene.pageIds.map((id) => byId.get(id)).filter((p): p is Page => !!p);
}

export async function addPage(
  sceneId: string,
  title?: string,
  afterPageId?: string,
): Promise<Page> {
  const db = getDb();
  return db.transaction("rw", db.scenes, db.pages, async () => {
    const scene = await db.scenes.get(sceneId);
    if (!scene) throw new Error("Scene not found");
    const page: Page = {
      id: newId(),
      sceneId,
      order: scene.pageIds.length,
      title: title?.trim() || `Page ${scene.pageIds.length + 1}`,
      elements: [],
      appState: {},
      fileRefs: {},
      rev: 1,
      schemaVersion: SCHEMA_VERSION,
    };
    const ids = [...scene.pageIds];
    const at = afterPageId ? ids.indexOf(afterPageId) + 1 : ids.length;
    ids.splice(at, 0, page.id);
    await db.pages.add(page);
    await db.scenes.update(sceneId, { pageIds: ids, updatedAt: Date.now() });
    await renumber(sceneId, ids);
    return page;
  });
}

async function renumber(sceneId: string, ids: string[]) {
  const db = getDb();
  await Promise.all(ids.map((id, i) => db.pages.where({ id, sceneId }).modify({ order: i })));
}

export async function renamePage(pageId: string, title: string) {
  await getDb().pages.update(pageId, { title: title.trim() || "Untitled page" });
}

export async function deletePage(sceneId: string, pageId: string) {
  const db = getDb();
  await db.transaction("rw", db.scenes, db.pages, async () => {
    const scene = await db.scenes.get(sceneId);
    if (!scene || scene.pageIds.length <= 1) throw new Error("A scene needs at least one page.");
    const ids = scene.pageIds.filter((p) => p !== pageId);
    await db.pages.delete(pageId);
    await db.scenes.update(sceneId, { pageIds: ids, updatedAt: Date.now() });
    await renumber(sceneId, ids);
  });
}

export async function movePage(sceneId: string, pageId: string, delta: -1 | 1) {
  const db = getDb();
  await db.transaction("rw", db.scenes, db.pages, async () => {
    const scene = await db.scenes.get(sceneId);
    if (!scene) return;
    const ids = [...scene.pageIds];
    const i = ids.indexOf(pageId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await db.scenes.update(sceneId, { pageIds: ids });
    await renumber(sceneId, ids);
  });
}

export async function duplicatePage(sceneId: string, pageId: string): Promise<Page> {
  const db = getDb();
  return db.transaction("rw", db.scenes, db.pages, async () => {
    const [scene, src] = await Promise.all([db.scenes.get(sceneId), db.pages.get(pageId)]);
    if (!scene || !src) throw new Error("Page not found");
    const copy: Page = { ...src, id: newId(), title: `${src.title} (copy)`, rev: 1 };
    const ids = [...scene.pageIds];
    ids.splice(ids.indexOf(pageId) + 1, 0, copy.id);
    await db.pages.add(copy); // blobs are content-addressed, so the copy shares image bytes
    await db.scenes.update(sceneId, { pageIds: ids, updatedAt: Date.now() });
    await renumber(sceneId, ids);
    return copy;
  });
}
