import { describe, expect, it } from "vitest";
import {
  MAX_SVG_BYTES,
  SvgImportError,
  importSvgText,
  normalizeSvg,
  sanitizeCss,
  sanitizeFragmentBody,
  sanitizeSvg,
  svgToDataURL,
} from "@/library/svg";

const wrap = (inner: string, attrs = 'viewBox="0 0 10 10"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe("sanitizeSvg: attack corpus", () => {
  const attacks: [string, string][] = [
    ["script element", wrap('<script>alert(1)</script><rect width="5" height="5"/>')],
    [
      "onload handler",
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 1 1"><rect/></svg>`,
    ],
    ["onclick handler", wrap('<rect width="5" height="5" onclick="alert(1)"/>')],
    [
      "foreignObject html",
      wrap(
        '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject>',
      ),
    ],
    ["javascript: href", wrap('<a href="javascript:alert(1)"><rect width="5" height="5"/></a>')],
    [
      "javascript: xlink:href",
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1"><a xlink:href="javascript:alert(1)"><rect/></a></svg>`,
    ],
    ["external image", wrap('<image href="https://evil.example/track.png" width="5" height="5"/>')],
    ["external use", wrap('<use href="https://evil.example/x.svg#a"/>')],
    [
      "data: svg image (could nest scripts)",
      wrap('<image href="data:image/svg+xml;base64,PHN2Zy8+" width="5" height="5"/>'),
    ],
    [
      "animate rewriting href",
      wrap(
        '<a href="#x"><animate attributeName="href" values="javascript:alert(1)"/><rect width="5" height="5"/></a>',
      ),
    ],
    [
      "set rewriting href",
      wrap('<a href="#x"><set attributeName="href" to="javascript:alert(1)"/><rect/></a>'),
    ],
    [
      "css @import",
      wrap(
        '<style>@import url("https://evil.example/x.css"); rect{fill:red}</style><rect width="5" height="5"/>',
      ),
    ],
    [
      "css external url()",
      wrap('<rect width="5" height="5" style="fill:url(https://evil.example/p.png)"/>'),
    ],
    [
      "fill external url()",
      wrap('<rect width="5" height="5" fill="url(https://evil.example/p.svg#a)"/>'),
    ],
    ["css expression()", wrap('<rect width="5" height="5" style="width:expression(alert(1))"/>')],
    ["iframe", wrap('<iframe src="https://evil.example"></iframe><rect/>')],
    [
      "entity/doctype tricks",
      `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>${wrap("<text>&x;</text>")}`,
    ],
  ];
  for (const [name, input] of attacks) {
    it(`neutralizes: ${name}`, () => {
      let out: string;
      try {
        out = sanitizeSvg(input);
      } catch (e) {
        // Refusing to import is also a safe outcome (e.g. DOCTYPE/entity payloads).
        expect(e).toBeInstanceOf(SvgImportError);
        return;
      }
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/\son\w+\s*=/i);
      expect(out).not.toMatch(/foreignObject|<iframe|<animate|<set\b/i);
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(
        /https?:\/\//i.source === "" ? /$^/ : /(?:href|src)\s*=\s*["']https?:/i,
      );
      expect(out).not.toMatch(/@import|expression\(/i);
      expect(out).not.toMatch(/url\(\s*["']?https?:/i);
      expect(out).not.toMatch(/file:\/\//i);
      expect(out).not.toContain("data:image/svg+xml");
    });
  }
});

describe("sanitizeSvg: legitimate content survives", () => {
  it("keeps shapes, groups, gradients, in-document references and embedded PNGs", () => {
    const out = sanitizeSvg(
      wrap(
        `<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient><clipPath id="c"><rect width="8" height="8"/></clipPath></defs>
         <g transform="translate(1 1)" clip-path="url(#c)"><rect width="5" height="5" fill="url(#g)" stroke="#000" stroke-width="1"/><circle cx="5" cy="5" r="2"/><path d="M0 0L5 5"/><text x="1" y="9">Hi</text></g>
         <use href="#c"/><image href="data:image/png;base64,iVBORw0KGgo=" width="2" height="2"/>`,
      ),
    );
    for (const frag of [
      "<rect",
      "<circle",
      "<path",
      "<text",
      "linearGradient",
      'fill="url(#g)"',
      'clip-path="url(#c)"',
      'href="#c"',
      "data:image/png;base64",
    ]) {
      expect(out).toContain(frag);
    }
  });

  it("keeps harmless <style> rules and strips only the dangerous parts", () => {
    const out = sanitizeSvg(
      wrap(
        '<style>.a{fill:#123456} @import url(http://x.test/a.css);</style><rect class="a" width="5" height="5"/>',
      ),
    );
    expect(out).toContain("#123456");
    expect(out).not.toContain("@import");
  });

  it("adds the SVG namespace when missing and always produces well-formed XML", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(
      new DOMParser().parseFromString(out, "image/svg+xml").querySelector("parsererror"),
    ).toBeNull();
  });
});

describe("sanitizeSvg: rejects what it cannot make safe", () => {
  it("rejects non-SVG and oversized input", () => {
    expect(() => sanitizeSvg("<html><body>hi</body></html>")).toThrow(SvgImportError);
    expect(() => sanitizeSvg("just text")).toThrow(SvgImportError);
    expect(() => sanitizeSvg(wrap("<!--" + "x".repeat(MAX_SVG_BYTES) + "-->"))).toThrow(/larger/);
  });
  it("rejects absurdly many nodes", () => {
    expect(() => sanitizeSvg(wrap("<rect/>".repeat(21_000)))).toThrow(/too complex/);
  });
});

describe("sanitizeCss", () => {
  it("removes imports, expressions and external urls but keeps fragments", () => {
    expect(sanitizeCss("fill:url(#a);stroke:url(http://x/y)")).toBe("fill:url(#a);stroke:none");
    expect(sanitizeCss("@import 'x'; a{b:c}")).not.toContain("@import");
  });
});

describe("normalizeSvg", () => {
  it("derives a viewBox from width/height and sets intrinsic size", () => {
    const n = normalizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="48px" height="24"><rect/></svg>',
    );
    expect(n.width).toBe(48);
    expect(n.height).toBe(24);
    expect(n.svg).toContain('viewBox="0 0 48 24"');
  });
  it("prefers an existing viewBox and drops percentage sizes and offsets", () => {
    const n = normalizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 5 200 100" width="100%" height="100%" x="3" y="3"><rect/></svg>',
    );
    expect([n.width, n.height]).toEqual([200, 100]);
    expect(n.svg).toContain('viewBox="5 5 200 100"');
    expect(n.svg).not.toMatch(/\sx="3"/);
  });
  it("falls back to a default size when nothing is declared", () => {
    expect(normalizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')).toMatchObject({
      width: 100,
      height: 100,
    });
  });
});

describe("helpers", () => {
  it("importSvgText runs the whole pipeline", () => {
    const r = importSvgText(
      '<svg width="10" height="20"><script>1</script><rect width="1" height="1"/></svg>',
    );
    expect(r.svg).not.toContain("script");
    expect([r.width, r.height]).toEqual([10, 20]);
  });
  it("encodes data URLs including non-ASCII text", () => {
    const url = svgToDataURL('<svg xmlns="http://www.w3.org/2000/svg"><text>héllo ✓</text></svg>');
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(url.split(",")[1]!), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toContain("héllo ✓");
  });
  it("sanitizes icon fragments from remote APIs", () => {
    const out = sanitizeFragmentBody('<path d="M0 0h5"/><script>alert(1)</script>', 24, 24);
    expect(out).toContain("<path");
    expect(out).not.toContain("script");
  });
});
