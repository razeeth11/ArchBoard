import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

const PATHS = [
  "/",
  "/app",
  "/templates",
  "/components",
  "/about",
  "/privacy",
  "/credits",
  "/changelog",
  "/vs",
  "/guides/system-design-diagram",
  "/guides/diagram-dsl",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-07");
  return PATHS.map((p) => ({ url: `${SITE.url}${p === "/" ? "" : p}`, lastModified }));
}
