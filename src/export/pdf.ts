import { step, throwIfAborted, type Hooks } from "./abort";
import { bindTextToFaces, extractEmbeddedFonts, loadFaces } from "./fonts";
import { sanitizeSvg } from "@/library/svg";
import { pdfPageLayout, type PdfOptions } from "./options";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

function decodeDataUrl(href: string): { mime: string; text: string } | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(href.trim());
  if (!m) return null;
  try {
    const bin = atob(m[2]!);
    return {
      mime: m[1]!,
      text: new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))),
    };
  } catch {
    return null;
  }
}

/**
 * Excalidraw embeds images as `<symbol><image href=data:…></symbol>` + `<use>`. svg2pdf mis-sizes
 * that structure for SVG images, so inline each SVG image as a nested <svg> (true vector in the PDF).
 * The embedded SVG comes from the scene file, which is untrusted, so it is sanitized again here.
 */
export function inlineSvgImages(svg: SVGSVGElement) {
  const doc = svg.ownerDocument;
  const symbols = new Map<string, Element>();
  svg.querySelectorAll("symbol[id]").forEach((s) => symbols.set(s.id, s));
  const cache = new Map<string, Element | null>();

  for (const use of Array.from(svg.querySelectorAll("use"))) {
    const href = use.getAttribute("href") ?? use.getAttributeNS(XLINK_NS, "href") ?? "";
    const symbol = href.startsWith("#") ? symbols.get(href.slice(1)) : undefined;
    const image = symbol?.querySelector("image");
    const src = image?.getAttribute("href") ?? image?.getAttributeNS(XLINK_NS, "href");
    if (!symbol || !src) continue;

    let content = cache.get(src);
    if (content === undefined) {
      const data = decodeDataUrl(src);
      content = null;
      if (data?.mime === "image/svg+xml") {
        try {
          content = doc.importNode(
            new DOMParser().parseFromString(sanitizeSvg(data.text), "image/svg+xml")
              .documentElement,
            true,
          );
        } catch {
          content = null; // unsafe or unparsable: drop the image rather than risk it
        }
      }
      cache.set(src, content);
    }
    if (!content) continue;

    const g = doc.createElementNS(SVG_NS, "g");
    for (const a of Array.from(use.attributes)) {
      if (!["href", "width", "height", "x", "y"].includes(a.name) && a.name !== "xlink:href")
        g.setAttribute(a.name, a.value);
    }
    const nested = content.cloneNode(true) as Element;
    nested.setAttribute("x", use.getAttribute("x") ?? "0");
    nested.setAttribute("y", use.getAttribute("y") ?? "0");
    nested.setAttribute("width", use.getAttribute("width") ?? "100");
    nested.setAttribute("height", use.getAttribute("height") ?? "100");
    nested.setAttribute("preserveAspectRatio", "none");
    g.appendChild(nested);
    use.replaceWith(g);
  }
}

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
      inlineSvgImages(svg);
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
