import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

const GUIDES: Record<string, { title: string; description: string }> = {
  "system-design-diagram": {
    title: "How to Draw a System Design Diagram",
    description:
      "A practical walkthrough for drawing clear system design diagrams: choosing boundaries, labelling data flow, and showing scale and failure modes in ArchBoard.",
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDES[slug]!;
  return pageMetadata({
    title: `${g.title} | ArchBoard`,
    description: g.description,
    path: `/guides/${slug}`,
  });
}

export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDES[slug]!;
  return (
    <Page title={g.title}>
      <p className="text-muted">{g.description}</p>
    </Page>
  );
}
