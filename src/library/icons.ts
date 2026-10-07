export type IconRef = `${string}:${string}`;

export interface IconData {
  body: string;
  width: number;
  height: number;
}

interface IconSetFile {
  prefix: string;
  width: number;
  height: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
}

const sets = new Map<string, Promise<IconSetFile>>();
let indexPromise: Promise<Record<string, string[]>> | null = null;

/** Sets are static files under /icons, fetched on first use and cached for the session. */
export function loadIconSet(prefix: string): Promise<IconSetFile> {
  let p = sets.get(prefix);
  if (!p) {
    p = fetch(`/icons/${encodeURIComponent(prefix)}.json`).then((r) => {
      if (!r.ok) throw new Error(`Icon set ${prefix} unavailable (${r.status})`);
      return r.json() as Promise<IconSetFile>;
    });
    p.catch(() => sets.delete(prefix));
    sets.set(prefix, p);
  }
  return p;
}

/** prefix → icon names, for search without downloading whole sets. */
export function loadIconIndex(): Promise<Record<string, string[]>> {
  indexPromise ??= fetch("/icons/index.json")
    .then((r) => {
      if (!r.ok) throw new Error("Icon index unavailable");
      return r.json() as Promise<Record<string, string[]>>;
    })
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

export function parseIconRef(ref: string): { prefix: string; name: string } {
  const i = ref.indexOf(":");
  return { prefix: ref.slice(0, i), name: ref.slice(i + 1) };
}

export async function getIcon(ref: string): Promise<IconData | null> {
  const { prefix, name } = parseIconRef(ref);
  const set = await loadIconSet(prefix);
  const icon = set.icons[name];
  if (!icon) return null;
  return { body: icon.body, width: icon.width ?? set.width, height: icon.height ?? set.height };
}

/** Standalone SVG document for an icon. `currentColor` is resolved so it survives use as an image. */
export function iconToSvg(icon: IconData, opts: { color?: string } = {}): string {
  const body = icon.body.replaceAll("currentColor", opts.color ?? "#1e1e1e");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${icon.width} ${icon.height}" width="${icon.width}" height="${icon.height}">${body}</svg>`;
}

export interface IconHit {
  ref: IconRef;
  prefix: string;
  name: string;
}

const tokens = (q: string) =>
  q
    .toLowerCase()
    .split(/[\s:_-]+/)
    .filter(Boolean);

/** Offline search over the bundled curated sets. Every token must appear in the name or prefix. */
export async function searchLocalIcons(query: string, limit = 120): Promise<IconHit[]> {
  const t = tokens(query);
  if (!t.length) return [];
  const index = await loadIconIndex();
  const hits: IconHit[] = [];
  for (const [prefix, names] of Object.entries(index)) {
    for (const name of names) {
      const hay = `${prefix} ${name}`.toLowerCase();
      if (t.every((tok) => hay.includes(tok))) {
        hits.push({ ref: `${prefix}:${name}`, prefix, name });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

export interface LicenseManifest {
  sets: {
    prefix: string;
    name: string;
    author: string;
    authorUrl: string;
    license: { spdx: string; title: string; url: string };
    licenseFile: string;
    version: string;
    iconCount: number;
    note: string;
    attribution: string;
  }[];
}
