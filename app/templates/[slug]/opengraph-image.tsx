import { TEMPLATES, templateBySlug } from "@/content/templates";
import { OG_SIZE, ogCard } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = templateBySlug((await params).slug);
  return ogCard({
    kicker: `Template · ${t?.category ?? ""}`,
    title: `${t?.title ?? "Template"} diagram`,
  });
}
