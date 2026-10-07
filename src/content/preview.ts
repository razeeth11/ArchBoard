import { buildDsl } from "@/dsl/build";
import { DEFAULT_EXPORT_OPTIONS } from "@/export/options";
import { renderExport } from "@/export/render";
import { svgToDataURL } from "@/library/svg";
import { TEMPLATES } from "./templates";

/** Self-contained SVG (text outlined, no fonts needed) of one DSL source, for static previews. */
export async function dslToSvg(source: string, title: string): Promise<string> {
  const b = await buildDsl(source);
  if (b.diagnostics.length) throw new Error(b.diagnostics.map((d) => d.message).join("; "));
  const files = Object.fromEntries(
    b.files.map((f) => [
      f.id,
      { id: f.id, mimeType: "image/svg+xml", dataURL: svgToDataURL(f.svg), created: 0 },
    ]),
  );
  const r = await renderExport(
    {
      elements: b.elements,
      appState: { selectedElementIds: {}, viewBackgroundColor: "#ffffff" },
      files: files as never,
      sceneTitle: title,
    },
    {
      ...DEFAULT_EXPORT_OPTIONS,
      format: "svg",
      scope: "scene",
      background: "solid",
      embedScene: false,
      svgTextAsPaths: false,
      padding: 20,
      title,
    },
  );
  // Thumbnails render inside <img>, where embedded web fonts are unavailable and outlining text is
  // ~10x bigger: drop the font payload and fall back to the system sans-serif.
  const doc = new DOMParser().parseFromString(await r.blob.text(), "image/svg+xml");
  doc.querySelectorAll("style").forEach((n) => n.remove());
  doc.querySelectorAll("text").forEach((n) => {
    n.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif");
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export async function allTemplateSvgs() {
  const out: { slug: string; svg: string }[] = [];
  for (const t of TEMPLATES) out.push({ slug: t.slug, svg: await dslToSvg(t.dsl, t.title) });
  return out;
}
