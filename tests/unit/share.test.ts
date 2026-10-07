import { describe, expect, it } from "vitest";
import {
  MAX_LENGTH,
  ShareError,
  SHARE_VERSION,
  decodeShare,
  encodeShare,
  parseFragment,
  validatePayload,
  type SharePayload,
} from "@/share/link";

const el = (i: number) => ({ id: `e${i}`, type: "rectangle", x: i, y: i, width: 10, height: 10 });
const payload = (n = 3, extra: Partial<SharePayload> = {}): SharePayload => ({
  v: SHARE_VERSION,
  title: "Orders",
  elements: Array.from({ length: n }, (_, i) => el(i)),
  viewBackgroundColor: "#fff",
  files: {},
  ...extra,
});
const hashOf = (f: string) => f;

describe("share links", () => {
  it("round-trips a scene through compression and encryption", async () => {
    const enc = await encodeShare(payload(5), "view");
    expect(enc.fragment.startsWith("#share=1&mode=view&key=")).toBe(true);
    expect(enc.tooLarge).toBe(false);
    const dec = await decodeShare(hashOf(enc.fragment));
    expect(dec.mode).toBe("view");
    expect(dec.payload.title).toBe("Orders");
    expect(dec.payload.elements).toHaveLength(5);
  });

  it("encrypts: the fragment never contains the content in clear", async () => {
    const enc = await encodeShare(payload(1, { title: "TOP-SECRET-ROADMAP" }), "edit");
    expect(enc.fragment).not.toContain("TOP-SECRET");
    expect(enc.fragment).not.toContain("ROADMAP");
    // …and a different key cannot open it
    const f = parseFragment(enc.fragment)!;
    const other = await encodeShare(payload(1), "edit");
    const wrongKey = enc.fragment.replace(f.key, parseFragment(other.fragment)!.key);
    await expect(decodeShare(wrongKey)).rejects.toThrow(/damaged|decrypted/);
  });

  it("produces a different link every time (fresh key and IV)", async () => {
    const a = await encodeShare(payload(2), "view");
    const b = await encodeShare(payload(2), "view");
    expect(a.fragment).not.toBe(b.fragment);
  });

  it("applies the size guard", async () => {
    const big = payload(3, {
      elements: Array.from({ length: 3000 }, (_, i) => ({
        ...el(i),
        seed: Math.floor(Math.random() * 1e9),
        versionNonce: Math.floor(Math.random() * 1e9),
        note: Math.random().toString(36),
      })),
    });
    const enc = await encodeShare(big, "view");
    expect(enc.length).toBeGreaterThan(MAX_LENGTH);
    expect(enc.tooLarge).toBe(true);
    const mid = await encodeShare(
      payload(200, {
        elements: Array.from({ length: 200 }, (_, i) => ({
          ...el(i),
          seed: i * 7919 + 13,
          a: Math.random(),
        })),
      }),
      "view",
    );
    expect(mid.warn || mid.length < 8000).toBe(true);
  });

  it("rejects tampered, truncated and malformed links with friendly errors", async () => {
    const enc = await encodeShare(payload(2), "view");
    await expect(decodeShare(enc.fragment.slice(0, -20))).rejects.toBeInstanceOf(ShareError);
    await expect(decodeShare(enc.fragment.slice(0, -3) + "AAA")).rejects.toBeInstanceOf(ShareError);
    await expect(decodeShare("#nothing")).rejects.toThrow(/not a valid/);
    await expect(decodeShare("#share=9&mode=view&key=a&data=b")).rejects.toThrow(/not a valid/);
    await expect(decodeShare("#share=1&mode=hax&key=a&data=b")).rejects.toThrow(/not a valid/);
    expect(parseFragment("#share=1&mode=view&key=k&data=d")).toEqual({
      mode: "view",
      key: "k",
      data: "d",
    });
    expect(parseFragment("#something=else")).toBeNull();
  });
});

describe("validatePayload treats links as untrusted", () => {
  it("rejects bad versions and shapes, and caps element counts", () => {
    expect(() => validatePayload(null)).toThrow(ShareError);
    expect(() => validatePayload({ v: 2, elements: [] })).toThrow(/newer/);
    expect(() => validatePayload({ v: 1, elements: "x" })).toThrow(/invalid|empty/);
    expect(() => validatePayload({ v: 1, elements: [{ id: 1 }] })).toThrow(/invalid/);
    expect(() =>
      validatePayload({ v: 1, elements: Array.from({ length: 6000 }, (_, i) => el(i)) }),
    ).toThrow(/too large/);
  });

  it("keeps harmless images, sanitizes SVG and drops anything else", () => {
    const svg = (s: string) => `data:image/svg+xml;base64,${btoa(s)}`;
    const p = validatePayload({
      v: 1,
      title: "x".repeat(500),
      elements: [el(1)],
      files: {
        good: { mimeType: "image/png", dataURL: "data:image/png;base64,iVBORw0KGgo=", created: 1 },
        svg: {
          mimeType: "image/svg+xml",
          dataURL: svg(
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="4" height="4"/></svg>',
          ),
          created: 1,
        },
        evilSvg: { mimeType: "image/svg+xml", dataURL: svg("<html>not svg</html>"), created: 1 },
        js: { mimeType: "image/png", dataURL: "javascript:alert(1)", created: 1 },
        html: { mimeType: "text/html", dataURL: "data:text/html;base64,PGI+", created: 1 },
        remote: { mimeType: "image/png", dataURL: "https://evil.example/x.png", created: 1 },
      },
    });
    expect(Object.keys(p.files).sort()).toEqual(["good", "svg"]);
    expect(atob(p.files.svg!.dataURL.split(",")[1]!)).not.toMatch(/script|onload/);
    expect(p.title).toHaveLength(120);
  });
});
