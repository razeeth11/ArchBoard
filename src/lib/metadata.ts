import type { Metadata } from "next";
import { SITE } from "./site";

interface PageMeta {
  title: string; // 50-60 chars ideally
  description: string; // 140-160 chars ideally
  path: string;
  noindex?: boolean;
  kind?: "website" | "article";
  /** The route has its own opengraph-image file: do not point at the shared default. */
  ownImage?: boolean;
}

export function pageMetadata({
  title,
  description,
  path,
  noindex,
  kind = "website",
  ownImage,
}: PageMeta): Metadata {
  return {
    // Titles are written in full (with the brand), so the layout's title template must not add it again.
    title: { absolute: title },
    description,
    alternates: { canonical: path, languages: { en: path, "x-default": path } },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE.name,
      type: kind,
      // Default card; routes with their own opengraph-image file override it.
      ...(ownImage
        ? {}
        : { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ownImage ? {} : { images: ["/opengraph-image"] }),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
