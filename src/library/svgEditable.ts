import type { Skeleton } from "./builder";

export interface EditableResult {
  skeleton: Skeleton[];
  width: number;
  height: number;
  /** Shapes beyond the cap were dropped. */
  truncated: boolean;
  count: number;
}

const MAX_SHAPES = 1500;
const SHAPE_SELECTOR = "path,rect,circle,ellipse,line,polyline,polygon";
const SKIP_PARENTS =
  "defs,clipPath,mask,symbol,pattern,marker,linearGradient,radialGradient,filter";

type Pt = [number, number];

function paint(v: string, fallback: string): string {
  if (!v || v === "none") return "transparent";
  if (v.startsWith("url(")) return fallback; // gradients/patterns: flat approximation
  return v;
}

/**
 * Convert a *sanitized* SVG into editable Excalidraw shapes. Rectangles and ellipses stay native;
 * everything else is sampled into polylines, so curves are approximations. Needs a real DOM
 * (geometry APIs), so it runs in the browser only.
 */
export function svgToEditable(svgText: string, maxSide = 320): EditableResult {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;";
  host.innerHTML = svgText;
  document.body.appendChild(host);
  try {
    const root = host.querySelector("svg");
    if (!root) throw new Error("No SVG found");
    const vb = (root.getAttribute("viewBox") ?? "0 0 100 100").split(/[\s,]+/).map(Number);
    const [vx = 0, vy = 0, vw = 100, vh = 100] = vb;
    const k = maxSide / Math.max(vw, vh);
    const tx = (x: number, y: number): Pt => [(x - vx) * k, (y - vy) * k];

    const out: Skeleton[] = [];
    let truncated = false;
    const nodes = Array.from(root.querySelectorAll<SVGGeometryElement>(SHAPE_SELECTOR)).filter(
      (el) => !el.closest(SKIP_PARENTS),
    );

    for (const el of nodes) {
      if (out.length >= MAX_SHAPES) {
        truncated = true;
        break;
      }
      const cs = getComputedStyle(el);
      const fill = paint(cs.fill, "#ced4da");
      const stroke = paint(cs.stroke, "#1e1e1e");
      const sw = Math.max(1, Math.round((parseFloat(cs.strokeWidth) || 1) * k));
      const opacity = Math.round(Math.min(1, Math.max(0, parseFloat(cs.opacity) || 1)) * 100);
      const style = {
        strokeColor: stroke === "transparent" && fill === "transparent" ? "#1e1e1e" : stroke,
        backgroundColor: fill,
        fillStyle: "solid" as const,
        strokeWidth: stroke === "transparent" ? 1 : sw,
        roughness: 0 as const,
        opacity,
      };
      const m = (el as SVGGraphicsElement).getCTM?.();
      const axisAligned = !m || (Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6);
      const apply = (x: number, y: number): Pt =>
        m ? tx(m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f) : tx(x, y);

      const tag = el.tagName.toLowerCase();
      if (axisAligned && tag === "rect" && !el.getAttribute("rx") && !el.getAttribute("ry")) {
        const r = el as unknown as SVGRectElement;
        const [x0, y0] = apply(r.x.baseVal.value, r.y.baseVal.value);
        const [x1, y1] = apply(
          r.x.baseVal.value + r.width.baseVal.value,
          r.y.baseVal.value + r.height.baseVal.value,
        );
        out.push({
          type: "rectangle",
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
          roundness: null,
          ...style,
        } as Skeleton);
        continue;
      }
      if (axisAligned && (tag === "circle" || tag === "ellipse")) {
        const cx = parseFloat(el.getAttribute("cx") ?? "0");
        const cy = parseFloat(el.getAttribute("cy") ?? "0");
        const rx = parseFloat(el.getAttribute(tag === "circle" ? "r" : "rx") ?? "0");
        const ry = parseFloat(el.getAttribute(tag === "circle" ? "r" : "ry") ?? "0");
        const [x0, y0] = apply(cx - rx, cy - ry);
        const [x1, y1] = apply(cx + rx, cy + ry);
        out.push({
          type: "ellipse",
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
          ...style,
        } as Skeleton);
        continue;
      }

      let len = 0;
      try {
        len = el.getTotalLength();
      } catch {
        continue;
      }
      if (!(len > 0)) continue;
      const n = Math.min(240, Math.max(8, Math.ceil((len * k) / 3)));
      const step = len / n;
      const closed =
        tag === "polygon" ||
        tag === "rect" ||
        tag === "circle" ||
        tag === "ellipse" ||
        /z\s*$/i.test(el.getAttribute("d") ?? "");
      let run: Pt[] = [];
      const flush = () => {
        if (run.length >= 2) {
          const [ox, oy] = run[0]!;
          const pts = run.map(([x, y]) => [x - ox, y - oy] as Pt);
          const isClosed = closed && run.length > 2;
          if (isClosed) pts.push([0, 0]);
          out.push({
            type: "line",
            x: ox,
            y: oy,
            points: pts as never,
            ...style,
            backgroundColor: isClosed ? style.backgroundColor : "transparent",
            roundness: null,
          } as Skeleton);
        }
        run = [];
      };
      let prev: Pt | null = null;
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength(Math.min(len, i * step));
        const pt = apply(p.x, p.y);
        // A jump larger than the sampling step means the path moved to another sub-path.
        if (prev && Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) > step * k * 2.5 + 1) flush();
        run.push(pt);
        prev = pt;
      }
      flush();
    }
    return { skeleton: out, width: vw * k, height: vh * k, truncated, count: out.length };
  } finally {
    host.remove();
  }
}
