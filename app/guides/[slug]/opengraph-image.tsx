import { GUIDES, guideBySlug } from "@/content/guides";
import { OG_SIZE, ogCard } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  return ogCard({ kicker: "Guide", title: g?.title ?? "Guide" });
}
