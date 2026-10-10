import { getSetting, setSetting } from "@/persistence/repo";

/**
 * Excalidraw's default is to fall back to the selection tool after every shape. Designers expect the
 * tool they picked to stay active until they pick another, so the padlock starts engaged. The user's
 * own choice (clicking the padlock) is remembered.
 */
let keep = true;
export const getKeepTool = () => keep;
export function setKeepTool(v: boolean) {
  keep = v;
  void setSetting("keepToolActive", v);
}
export async function hydrateKeepTool() {
  keep = (await getSetting<boolean>("keepToolActive", true)) !== false;
}
