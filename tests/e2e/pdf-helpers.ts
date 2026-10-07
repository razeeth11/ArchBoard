import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfInfo {
  pages: {
    width: number;
    height: number;
    text: string;
    paintsImages: number;
    paintsPaths: number;
  }[];
  title: string | undefined;
}

/** Open a PDF the way a viewer would and report what is actually inside. */
export async function inspectPdf(buf: Buffer): Promise<PdfInfo> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const pages: PdfInfo["pages"] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const [x0, y0, x1, y1] = page.view;
    const content = await page.getTextContent();
    const ops = await page.getOperatorList();
    const OPS = pdfjs.OPS;
    pages.push({
      width: x1! - x0!,
      height: y1! - y0!,
      text: content.items.map((it) => ("str" in it ? it.str : "")).join(" "),
      paintsImages: ops.fnArray.filter(
        (f) => f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject,
      ).length,
      paintsPaths: ops.fnArray.filter((f) => f === OPS.constructPath).length,
    });
  }
  const meta = await doc.getMetadata();
  const title = (meta.info as { Title?: string }).Title;
  await task.destroy();
  return { pages, title };
}
