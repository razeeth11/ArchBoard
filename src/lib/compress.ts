type Bytes = Uint8Array | ArrayBuffer;
/** gzip via the platform CompressionStream (Chromium, Firefox, Safari 16.4+, Node 18+). */
async function pipe(
  data: Bytes,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(data as unknown as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export const gzip = (data: Bytes) => pipe(data, new CompressionStream("gzip"));
export const gunzip = (data: Bytes) => pipe(data, new DecompressionStream("gzip"));

export async function gzipJson(value: unknown): Promise<Uint8Array> {
  return gzip(new TextEncoder().encode(JSON.stringify(value)));
}

export async function gunzipJson<T>(data: Bytes): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await gunzip(data))) as T;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
