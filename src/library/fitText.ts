/**
 * Make labels fit their shapes. The converter measures each label on one line and leaves the shape
 * at its requested size, so a long label overflows (or is clipped). Like Excalidraw's own editor, we
 * keep the shape's width, wrap the text to it, and grow the shape's height when the wrapped text needs
 * more room. Short labels that already fit are left exactly as they were.
 */
type Rec = Record<string, unknown>;
type El = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  containerId?: string | null;
  text?: string;
  originalText?: string;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: string;
  verticalAlign?: string;
} & Rec;

const PAD = 8;
/** Vertical breathing room is smaller than horizontal: shapes are wider than they are tall. */
const PADV = 4;
/** Share of a shape's box that text can safely use. */
const INNER: Record<string, number> = { rectangle: 1, ellipse: Math.SQRT1_2, diamond: 0.5 };

export function wrapToWidth(text: string, charW: number, maxW: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxW / Math.max(charW, 0.1)));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > maxChars) {
        // A single word wider than the shape is broken rather than overflowing.
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      if (!line) line = w;
      else if ((line + " " + w).length <= maxChars) line += " " + w;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

export function fitBoundText<T extends { id: string; type: string }>(elements: T[]): T[] {
  const els = elements as unknown as El[];
  const byId = new Map(els.map((e) => [e.id, e]));
  const images = els.filter((e) => e.type === "image" && !e.isDeleted);
  for (const t of els) {
    if (t.type !== "text" || !t.containerId || t.isDeleted) continue;
    const c = byId.get(t.containerId);
    if (!c || !(c.type in INNER)) continue;
    const raw = t.originalText ?? t.text ?? "";
    if (!raw || !t.fontSize) continue;
    const factor = INNER[c.type]!;
    const lh = t.lineHeight ?? 1.25;
    // Character width comes from the text as it is laid out now (wrapped or not), so re-fitting after
    // the shape was resized stays accurate.
    const longest = Math.max(...(t.text ?? raw).split("\n").map((l) => l.length), 1);
    const charW = Math.max(t.width / longest, t.fontSize * 0.35);
    // An icon sitting in the top of the shape reserves that strip.
    const icon = images.find(
      (i) =>
        i.x >= c.x - 1 &&
        i.y >= c.y - 1 &&
        i.x + i.width <= c.x + c.width + 1 &&
        i.y + i.height <= c.y + c.height + 1,
    );
    const reserve = icon ? icon.y + icon.height - c.y : 0;
    const innerW = (c.width - 2 * PAD) * factor;
    const innerH = (c.height - 2 * PADV - reserve) * factor;
    const fitsWide = t.width <= innerW + 0.5;
    const fitsHigh = t.height <= innerH + 0.5;
    if (fitsWide && fitsHigh) continue; // already fine: leave the converter's result untouched

    const lines = wrapToWidth(raw, charW, innerW);
    const textH = Math.ceil(lines.length * t.fontSize * lh);
    const textW = Math.ceil(Math.max(...lines.map((l) => l.length)) * charW);
    const needH = Math.ceil(textH / factor + 2 * PADV + reserve);
    if (needH > c.height) c.height = needH;

    t.text = lines.join("\n");
    t.originalText = raw;
    t.width = Math.min(textW, c.width - 2 * PAD);
    t.height = textH;
    t.x = c.x + (c.width - t.width) / 2;
    if (reserve || t.verticalAlign === "bottom") t.y = c.y + c.height - PADV - textH;
    else if (t.verticalAlign === "top") t.y = c.y + PAD;
    else t.y = c.y + (c.height - textH) / 2;
    if (typeof t.autoResize === "boolean") t.autoResize = false;
    if (typeof t.version === "number") t.version += 1;
  }
  return elements;
}
