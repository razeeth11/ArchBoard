export const SITE = {
  name: "ArchBoard",
  url: "https://archboard.space",
  tagline: "Free whiteboard for system design and architecture diagrams",
  description:
    "ArchBoard is a free, private, offline-first whiteboard for architecture and system design diagrams. No sign-up. Your drawings never leave your device.",
} as const;

export interface Creator {
  name: string;
  url: string;
  repoUrl: string;
  /** Microsoft Store listing. Leave unset until it exists; every consumer renders nothing without it. */
  storeUrl?: string;
  sameAs: string[];
}

export function buildCreator(storeUrl?: string): Creator {
  const url = "https://github.com/razeeth11";
  return {
    name: "codebyrazeeth",
    url,
    repoUrl: "https://github.com/razeeth11/ArchBoard",
    storeUrl,
    sameAs: storeUrl ? [url, storeUrl] : [url],
  };
}

/** Set the Store URL here once the listing is live; the footer, About, home and JSON-LD pick it up. */
export const CREATOR: Creator = buildCreator(undefined);

export const NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/components", label: "Components" },
  { href: "/guides", label: "Guides" },
  { href: "/vs", label: "Compare" },
  { href: "/about", label: "About" },
] as const;
