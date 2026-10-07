import { step, throwIfAborted, type Hooks } from "./abort";
import { bindTextToFaces, extractEmbeddedFonts, loadFaces } from "./fonts";
import { pdfPageLayout, type PdfOptions } from "./options";

export interface PdfSheet {
  svg: SVGSVGElement;
}

const toNum = (v: string | null) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
};

function u8ToBinary(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000)
    s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return s;
}

/**
 * Vector PDF: each sheet's SVG is drawn with svg2pdf (paths stay paths, text stays selectable text
 * in the exact glyph subset Excalidraw embedded). Libraries load lazily, only when a PDF is exported.
 */
export async function buildPdf(
  sheets: PdfSheet[],
  pdfOpts: PdfOptions,
  meta: { title: string; description: string },
  hooks: Hooks,
): Promise<Blob> {
  await step(hooks, "Loading PDF engine", 0.1);
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);

  let pdf: InstanceType<typeof jsPDF> | null = null;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;";
  document.body.appendChild(host);
  try {
    for (const [i, sheet] of sheets.entries()) {
      await step(
        hooks,
        `Rendering page ${i + 1} of ${sheets.length}`,
        0.15 + (0.8 * i) / sheets.length,
      );
      const svg = sheet.svg;
      const w = toNum(svg.getAttribute("width"));
      const h = toNum(svg.getAttribute("height"));
      const layout = pdfPageLayout(w, h, pdfOpts);
      const orientation = layout.pageWidthMm >= layout.pageHeightMm ? "landscape" : "portrait";
      const format: [number, number] = [layout.pageWidthMm, layout.pageHeightMm];

      if (!pdf) {
        pdf = new jsPDF({ unit: "mm", format, orientation, compress: true });
        pdf.setProperties({ title: meta.title, subject: meta.description, creator: "ArchBoard" });
      } else {
        pdf.addPage(format, orientation);
      }

      // Register exactly the font subsets this sheet uses, then bind each text run to one.
      const faces = await loadFaces(extractEmbeddedFonts(svg));
      const used = bindTextToFaces(svg, faces);
      for (const face of used) {
        const file = `${face.id}.ttf`;
        pdf.addFileToVFS(file, btoa(u8ToBinary(face.ttf)));
        pdf.addFont(file, face.id, "normal");
      }
      throwIfAborted(hooks.signal);

      host.replaceChildren(svg);
      await svg2pdf(svg, pdf, {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      });
      host.replaceChildren();
    }
    await step(hooks, "Finalizing PDF", 0.97);
    return pdf!.output("blob");
  } finally {
    host.remove();
  }
}
