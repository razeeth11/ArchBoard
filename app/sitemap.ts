import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/content/compare";
import { GUIDES } from "@/content/guides";
import { TEMPLATES } from "@/content/templates";
import { SITE } from "@/lib/site";
import { SMART_DEFS } from "@/smart/defs";

export const dynamic = "force-static";

const SITE_UPDATED = "2026-10-07";

export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (path: string, date = SITE_UPDATED, priority?: number) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    lastModified: new Date(date),
    ...(priority ? { priority } : {}),
  });
  return [
    entry("/", SITE_UPDATED, 1),
    entry("/app", SITE_UPDATED, 0.9),
    ...[
      "/templates",
      "/components",
      "/guides",
      "/vs",
      "/about",
      "/privacy",
      "/credits",
      "/changelog",
    ].map((p) => entry(p, SITE_UPDATED, 0.7)),
    ...TEMPLATES.map((t) => entry(`/templates/${t.slug}`, SITE_UPDATED, 0.6)),
    ...SMART_DEFS.map((d) => entry(`/components/${d.id}`, SITE_UPDATED, 0.5)),
    ...GUIDES.map((g) => entry(`/guides/${g.slug}`, g.updated, 0.6)),
    ...COMPARISONS.map((c) => entry(`/vs/${c.slug}`, c.reviewed, 0.5)),
  ];
}
