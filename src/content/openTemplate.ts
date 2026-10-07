import { buildDsl } from "@/dsl/build";
import { svgToDataURL } from "@/library/svg";
import { importExcalidrawFile } from "@/persistence/backup";
import type { Scene } from "@/persistence/types";
import { templateBySlug } from "./templates";

/** Build a template's diagram and save it as a brand-new scene (never touches existing scenes). */
export async function createSceneFromTemplate(slug: string): Promise<Scene> {
  const t = templateBySlug(slug);
  if (!t) throw new Error("That template does not exist.");
  const built = await buildDsl(t.dsl);
  if (built.diagnostics.length || !built.elements.length)
    throw new Error("The template could not be built.");
  const files = Object.fromEntries(
    built.files.map((f) => [
      f.id,
      { id: f.id, mimeType: "image/svg+xml", dataURL: svgToDataURL(f.svg), created: Date.now() },
    ]),
  );
  return importExcalidrawFile(
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "archboard-template",
      elements: built.elements,
      appState: { viewBackgroundColor: "#ffffff" },
      files,
    }),
    t.title,
  );
}
