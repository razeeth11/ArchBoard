import { fromBase64Url, gunzip, gzip, toBase64Url } from "@/lib/compress";
import { sanitizeSvg, svgToDataURL } from "@/library/svg";

export const SHARE_VERSION = 1;
/** Browsers and chat apps cope with ~32k URLs; warn well before that. */
export const WARN_LENGTH = 8_000;
export const MAX_LENGTH = 32_000;
const MAX_UNZIPPED = 25 * 1024 * 1024;
const MAX_ELEMENTS = 5_000;
const RASTER = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

export interface ShareFile {
  mimeType: string;
  dataURL: string;
  created: number;
}

export interface SharePayload {
  v: number;
  title: string;
  elements: unknown[];
  viewBackgroundColor?: string;
  files: Record<string, ShareFile>;
}

export type ShareMode = "view" | "edit";

export class ShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareError";
  }
}

async function aesKey(raw: Uint8Array, usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, usage);
}

export interface EncodedShare {
  /** Fragment, starting with `#`. */
  fragment: string;
  length: number;
  /** Over the soft limit: it works but may be truncated by some apps. */
  warn: boolean;
  /** Over the hard limit: no link is produced; export a file instead. */
  tooLarge: boolean;
}

/**
 * Compress then encrypt (AES-256-GCM) a scene into a URL fragment. The fragment is never sent to a
 * server by the browser, and the key travels with it, so there is no account or backend involved.
 */
export async function encodeShare(payload: SharePayload, mode: ShareMode): Promise<EncodedShare> {
  const gz = await gzip(new TextEncoder().encode(JSON.stringify(payload)));
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(keyBytes, ["encrypt"]),
      gz as BufferSource,
    ),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv);
  blob.set(ct, iv.length);
  const fragment = `#share=${SHARE_VERSION}&mode=${mode}&key=${toBase64Url(keyBytes)}&data=${toBase64Url(blob)}`;
  return {
    fragment,
    length: fragment.length,
    warn: fragment.length > WARN_LENGTH,
    tooLarge: fragment.length > MAX_LENGTH,
  };
}

export function parseFragment(hash: string): { mode: ShareMode; key: string; data: string } | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.includes("share=")) return null;
  const q = new URLSearchParams(h);
  const mode = q.get("mode");
  const key = q.get("key");
  const data = q.get("data");
  if (
    q.get("share") !== String(SHARE_VERSION) ||
    (mode !== "view" && mode !== "edit") ||
    !key ||
    !data
  )
    return null;
  return { mode, key, data };
}

async function boundedGunzip(data: Uint8Array): Promise<Uint8Array> {
  const out = await gunzip(data);
  if (out.length > MAX_UNZIPPED)
    throw new ShareError("This shared diagram is too large to open safely.");
  return out;
}

/** Decode and *validate* a shared payload. Everything in a link is untrusted input. */
export async function decodeShare(
  hash: string,
): Promise<{ payload: SharePayload; mode: ShareMode }> {
  const f = parseFragment(hash);
  if (!f) throw new ShareError("This link is not a valid ArchBoard share link.");
  let plain: Uint8Array;
  try {
    const blob = fromBase64Url(f.data);
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await aesKey(fromBase64Url(f.key), ["decrypt"]),
      ct as BufferSource,
    );
    plain = await boundedGunzip(new Uint8Array(dec));
  } catch (e) {
    if (e instanceof ShareError) throw e;
    throw new ShareError(
      "The link is damaged or incomplete, so it could not be decrypted. Ask for it to be sent again.",
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new ShareError("The shared data is corrupted.");
  }
  return { payload: validatePayload(raw), mode: f.mode };
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function validatePayload(raw: unknown): SharePayload {
  if (!isRec(raw) || raw.v !== SHARE_VERSION)
    throw new ShareError("This link was made by a newer or unknown version.");
  if (!Array.isArray(raw.elements) || raw.elements.length > MAX_ELEMENTS)
    throw new ShareError("The shared diagram is empty or too large.");
  for (const e of raw.elements) {
    if (!isRec(e) || typeof e.id !== "string" || typeof e.type !== "string")
      throw new ShareError("The shared diagram contains invalid elements.");
  }
  const files: Record<string, ShareFile> = {};
  if (isRec(raw.files)) {
    for (const [id, f] of Object.entries(raw.files)) {
      if (!isRec(f) || typeof f.dataURL !== "string" || typeof f.mimeType !== "string") continue;
      if (f.mimeType === "image/svg+xml") {
        const m = /^data:image\/svg\+xml;base64,(.+)$/.exec(f.dataURL);
        if (!m) continue;
        try {
          const text = new TextDecoder().decode(
            Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0)),
          );
          files[id] = {
            mimeType: f.mimeType,
            dataURL: svgToDataURL(sanitizeSvg(text)),
            created: Number(f.created ?? 0),
          };
        } catch {
          /* unsafe or broken SVG: dropped */
        }
      } else if (RASTER.test(f.dataURL)) {
        files[id] = { mimeType: f.mimeType, dataURL: f.dataURL, created: Number(f.created ?? 0) };
      }
    }
  }
  return {
    v: SHARE_VERSION,
    title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "Shared diagram",
    elements: raw.elements,
    viewBackgroundColor:
      typeof raw.viewBackgroundColor === "string" ? raw.viewBackgroundColor : undefined,
    files,
  };
}
