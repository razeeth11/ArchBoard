import type { IconData } from "./icons";
import { sanitizeFragmentBody } from "./svg";

/**
 * Optional online icon search through the public Iconify API. It is OFF by default (queries leave the
 * browser) and restricted to icon sets with permissive licenses so any inserted icon can be
 * redistributed in exports. Failures never throw into the UI: callers get a friendly message.
 */
export const ICONIFY_API = "https://api.iconify.design";

/** Permissively licensed sets (MIT / Apache-2.0 / ISC / CC0). No CC-BY, NC or SA sets. */
export const ALLOWED_PREFIXES = [
  "logos",
  "devicon",
  "simple-icons",
  "mdi",
  "carbon",
  "lucide",
  "tabler",
  "ph",
  "bi",
  "ri",
  "material-symbols",
  "heroicons",
  "octicon",
  "ion",
  "feather",
  "fluent",
  "eos-icons",
  "skill-icons",
] as const;

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BODY = 100_000;

export class OnlineError extends Error {
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message);
    this.name = "OnlineError";
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new OnlineError(
      "Online icon search is unavailable (are you offline?). Bundled icons still work.",
      true,
    );
  }
  if (!res.ok) throw new OnlineError(`Icon service returned ${res.status}.`, false);
  return res.json();
}

export function parseOnlineRef(ref: string): { prefix: string; name: string } | null {
  const i = ref.indexOf(":");
  if (i < 1) return null;
  const prefix = ref.slice(0, i);
  const name = ref.slice(i + 1);
  if (!(ALLOWED_PREFIXES as readonly string[]).includes(prefix) || !NAME_RE.test(name)) return null;
  return { prefix, name };
}

export async function searchOnlineIcons(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=48&prefixes=${ALLOWED_PREFIXES.join(",")}`;
  const data = (await getJson(url, signal)) as { icons?: unknown };
  if (!Array.isArray(data.icons)) return [];
  // Never trust the service: keep only well-formed refs from allowed sets.
  return data.icons.filter((x): x is string => typeof x === "string" && parseOnlineRef(x) !== null);
}

export interface OnlineLicense {
  name: string;
  license: string;
  author: string;
}

const licenseCache = new Map<string, Promise<OnlineLicense | null>>();

export function getOnlineLicense(
  prefix: string,
  signal?: AbortSignal,
): Promise<OnlineLicense | null> {
  let p = licenseCache.get(prefix);
  if (!p) {
    p = getJson(`${ICONIFY_API}/collections?prefixes=${encodeURIComponent(prefix)}`, signal)
      .then((d) => {
        const c = (
          d as Record<
            string,
            { name?: string; license?: { title?: string }; author?: { name?: string } }
          >
        )[prefix];
        return c
          ? {
              name: String(c.name ?? prefix),
              license: String(c.license?.title ?? "see source"),
              author: String(c.author?.name ?? ""),
            }
          : null;
      })
      .catch(() => null);
    licenseCache.set(prefix, p);
  }
  return p;
}

/** Fetch one icon, sanitize its markup like any other untrusted SVG, and return clean icon data. */
export async function fetchOnlineIcon(ref: string, signal?: AbortSignal): Promise<IconData> {
  const parsed = parseOnlineRef(ref);
  if (!parsed) throw new OnlineError("That icon is not available.", false);
  const url = `${ICONIFY_API}/${parsed.prefix}.json?icons=${encodeURIComponent(parsed.name)}`;
  const d = (await getJson(url, signal)) as {
    width?: number;
    height?: number;
    icons?: Record<string, { body?: string; width?: number; height?: number }>;
  };
  const icon = d.icons?.[parsed.name];
  if (!icon || typeof icon.body !== "string" || icon.body.length > MAX_BODY) {
    throw new OnlineError("That icon could not be loaded.", false);
  }
  const width = Number(icon.width ?? d.width ?? 24);
  const height = Number(icon.height ?? d.height ?? 24);
  if (!(width > 0 && height > 0 && width <= 4096 && height <= 4096)) {
    throw new OnlineError("That icon could not be loaded.", false);
  }
  const clean = sanitizeFragmentBody(icon.body, width, height);
  const inner = new DOMParser().parseFromString(clean, "image/svg+xml").documentElement;
  const body = new XMLSerializer()
    .serializeToString(inner)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  return { body, width, height };
}
