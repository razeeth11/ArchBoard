import { CREATOR, SITE, type Creator } from "./site";

type Json = Record<string, unknown>;
const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

export const CREATOR_ID = `${SITE.url}/#creator`;
const creatorRef = { "@id": CREATOR_ID };

/** The creator as a schema.org Person. Emitted on the homepage and /about; other nodes reference its @id. */
export const creator = (c: Creator = CREATOR): Json => ({
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": CREATOR_ID,
  name: c.name,
  url: c.url,
  sameAs: [...new Set(c.sameAs.filter((u) => u.startsWith("https://")))],
});

export const breadcrumbs = (trail: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.name,
    item: abs(t.path),
  })),
});

export const webApplication = (c: Creator = CREATOR): Json => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a modern browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: creatorRef,
  creator: creatorRef,
  codeRepository: c.repoUrl,
});

export const article = (o: {
  headline: string;
  description: string;
  path: string;
  updated: string;
  kind?: "Article" | "TechArticle";
}): Json => ({
  "@context": "https://schema.org",
  "@type": o.kind ?? "TechArticle",
  headline: o.headline,
  description: o.description,
  mainEntityOfPage: abs(o.path),
  dateModified: o.updated,
  datePublished: o.updated,
  author: creatorRef,
  publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
});

/** A downloadable/openable diagram template. */
export const template = (o: {
  name: string;
  description: string;
  path: string;
  keywords: string[];
}): Json => ({
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  name: o.name,
  description: o.description,
  url: abs(o.path),
  keywords: o.keywords.join(", "),
  genre: "System design diagram template",
  isAccessibleForFree: true,
  license: "https://opensource.org/licenses/MIT",
  publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
});

export const itemList = (name: string, items: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: abs(it.path),
    name: it.name,
  })),
});
