import DOMPurify from "dompurify";

export const MAX_SVG_BYTES = 2 * 1024 * 1024;
export const MAX_SVG_NODES = 20_000;

export class SvgImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgImportError";
  }
}

/** Anything that could fetch or run something outside the document. */
const UNSAFE_CSS = /@import|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/gi;
/** `url(...)` is only allowed to point at an in-document fragment. */
const EXTERNAL_URL = /url\(\s*(?!["']?\s*#)[^)]*\)/gi;
const URL_ATTRS = [
  "fill",
  "stroke",
  "filter",
  "mask",
  "clip-path",
  "marker-start",
  "marker-mid",
  "marker-end",
  "style",
];
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

export function sanitizeCss(css: string): string {
  return css.replace(UNSAFE_CSS, "").replace(EXTERNAL_URL, "none");
}

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier() {
  if (purifier) return purifier;
  const p = DOMPurify(window);
  p.addHook("afterSanitizeAttributes", (node) => {
    for (const attr of ["href", "xlink:href"]) {
      const v = node.getAttribute?.(attr);
      if (v == null) continue;
      const t = v.trim();
      // Only same-document fragments and embedded raster images. No remote or script URLs.
      if (!(t.startsWith("#") || SAFE_DATA_IMAGE.test(t))) node.removeAttribute(attr);
    }
    for (const attr of URL_ATTRS) {
      const v = node.getAttribute?.(attr);
      if (v != null) node.setAttribute(attr, sanitizeCss(v));
    }
    if (node.tagName?.toLowerCase() === "style" && node.textContent) {
      node.textContent = sanitizeCss(node.textContent);
    }
  });
  purifier = p;
  return p;
}

const FORBIDDEN_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "canvas",
  // Animation elements can rewrite href/on* attributes after sanitization.
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "discard",
  "handler",
  "listener",
];

/** Parse + sanitize untrusted SVG markup, returning a well-formed standalone SVG string. */
export function sanitizeSvg(text: string): string {
  if (new Blob([text]).size > MAX_SVG_BYTES) {
    throw new SvgImportError(`SVG is larger than ${MAX_SVG_BYTES / 1024 / 1024} MB.`);
  }
  if (!/<svg[\s>]/i.test(text)) throw new SvgImportError("This does not look like an SVG file.");

  const clean = getPurifier().sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ["srcdoc", "formaction", "ping"],
    // `use` is safe here: the hook above only lets it reference in-document fragments.
    ADD_TAGS: ["style", "use"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  }) as string;

  // Re-parse as XML to guarantee well-formedness and a proper namespace.
  const withNs = /<svg[^>]*\sxmlns\s*=/i.test(clean)
    ? clean
    : clean.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const doc = new DOMParser().parseFromString(withNs, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg") {
    throw new SvgImportError("Could not parse this SVG.");
  }
  if (doc.getElementsByTagName("*").length > MAX_SVG_NODES) {
    throw new SvgImportError("This SVG is too complex to import safely.");
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}

const num = (v: string | null): number | null => {
  if (!v || v.includes("%")) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export interface NormalizedSvg {
  svg: string;
  width: number;
  height: number;
}

/** Guarantee a viewBox and intrinsic size so the image scales crisply at any zoom. */
export function normalizeSvg(sanitized: string): NormalizedSvg {
  const doc = new DOMParser().parseFromString(sanitized, "image/svg+xml");
  const root = doc.documentElement;
  const vb = root
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  let w: number;
  let h: number;
  if (vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0) {
    w = vb[2]!;
    h = vb[3]!;
  } else {
    w = num(root.getAttribute("width")) ?? 100;
    h = num(root.getAttribute("height")) ?? 100;
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  root.setAttribute("width", String(w));
  root.setAttribute("height", String(h));
  root.removeAttribute("x");
  root.removeAttribute("y");
  if (!root.getAttribute("preserveAspectRatio"))
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return { svg: new XMLSerializer().serializeToString(root), width: w, height: h };
}

export function importSvgText(text: string): NormalizedSvg {
  return normalizeSvg(sanitizeSvg(text));
}

export function svgToDataURL(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

/** Clean an icon fragment (e.g. from a remote API) the same way before it is shown or inserted. */
export function sanitizeFragmentBody(body: string, width: number, height: number): string {
  return sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
}
