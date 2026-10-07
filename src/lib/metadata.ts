import type { Metadata } from "next";
import { SITE } from "./site";

interface PageMeta {
  title: string; // 50-60 chars ideally
  description: string; // 140-160 chars ideally
  path: string;
  noindex?: boolean;
}

export function pageMetadata({ title, description, path, noindex }: PageMeta): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path, languages: { en: path, "x-default": path } },
    openGraph: { title, description, url: path, siteName: SITE.name, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
