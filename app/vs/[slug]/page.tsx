import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPARISONS, comparisonBySlug } from "@/content/compare";
import { breadcrumbs } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/ui/Breadcrumbs";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";

export const dynamicParams = false;
export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = comparisonBySlug((await params).slug);
  if (!c) return {};
  return pageMetadata({
    title: `${c.title} | Comparison`,
    description: c.description,
    path: `/vs/${c.slug}`,
  });
}

export default async function Compare({ params }: { params: Promise<{ slug: string }> }) {
  const c = comparisonBySlug((await params).slug);
  if (!c) notFound();
  const trail = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/vs" },
    { name: c.title, path: `/vs/${c.slug}` },
  ];
  return (
    <Page title={c.title}>
      <Breadcrumbs trail={trail} />
      <p className="leading-relaxed">{c.summary}</p>
      <h2 className="mt-8 text-xl font-semibold">Choose {c.name} when</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {c.theyAreBetter.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl font-semibold">Choose ArchBoard when</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {c.weAreBetter.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/app" className="bg-accent text-accent-fg rounded-md px-4 py-2 font-medium">
          Try ArchBoard
        </Link>
      </p>
      <p className="text-muted mt-6 text-sm">
        Last reviewed {c.reviewed}. Products change; check {c.name}&apos;s own documentation for
        current details. {c.name} is a trademark of its owner and is not affiliated with ArchBoard.
      </p>
      <JsonLd data={breadcrumbs(trail)} />
    </Page>
  );
}
