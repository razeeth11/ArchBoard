export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function dataURLToBytes(dataURL: string): { bytes: ArrayBuffer; mime: string } {
  const m = /^data:([^;,]*)((?:;[^;,]*)*?),(.*)$/s.exec(dataURL);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1] || "application/octet-stream";
  const isBase64 = (m[2] ?? "").includes(";base64");
  const body = m[3] ?? "";
  if (isBase64) return { bytes: base64ToBytes(body), mime };
  const raw = decodeURIComponent(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return { bytes: out.buffer, mime };
}

export function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function bytesToBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function bytesToDataURL(bytes: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
