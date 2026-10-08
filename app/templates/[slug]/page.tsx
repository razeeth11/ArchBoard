import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "@/content/guides";
import { TEMPLATES, templateBySlug } from "@/content/templates";
import { breadcrumbs, template as templateLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/ui/Breadcrumbs";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";
import { TemplateCard } from "@/ui/TemplateCard";

export const dynamicParams = false;
export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

const descriptionOf = (summary: string) => `${summary} Free, private and editable in your browser.`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = templateBySlug((await params).slug);
  if (!t) return {};
  return pageMetadata({
    title: `${t.title} Diagram Template | ArchBoard`,
    description: descriptionOf(t.summary),
    path: `/templates/${t.slug}`,
    ownImage: true,
  });
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = templateBySlug((await params).slug);
  if (!t) notFound();
  const path = `/templates/${t.slug}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Templates", path: "/templates" },
    { name: t.title, path },
  ];
  const related = TEMPLATES.filter((x) => x.category === t.category && x.slug !== t.slug).slice(
    0,
    3,
  );
  const guides = GUIDES.filter((g) => g.templates.includes(t.slug)).slice(0, 3);
  return (
    <Page title={`${t.title} diagram template`} wide>
      <Breadcrumbs trail={trail} />
      <p className="text-muted text-lg">{t.summary}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/previews/${t.slug}.svg`}
            alt={`${t.title} architecture diagram`}
            width={960}
            height={540}
            className="border-border aspect-video w-full rounded-xl border bg-white object-contain"
          />
          <Link
            href={`/app?template=${t.slug}`}
            className="bg-accent text-accent-fg mt-4 inline-block rounded-md px-5 py-2.5 font-medium"
          >
            Open in ArchBoard
          </Link>
          <p className="text-muted mt-2 text-sm">
            Builds a new scene in your browser. Your existing scenes are not touched.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">About this design</h2>
          <p className="mt-2 leading-relaxed">{t.body}</p>
          <h2 className="mt-6 text-xl font-semibold">Diagram as text</h2>
          <p className="text-muted mt-1 text-sm">
            This is the source of the diagram, in the{" "}
            <Link href="/guides/diagram-dsl" className="underline">
              ArchBoard diagram DSL
            </Link>
            . Paste it into Tools, Diagram from text to rebuild or change it.
          </p>
          <pre className="border-border bg-surface mt-2 overflow-x-auto rounded-lg border p-3 text-sm">
            <code>{t.dsl}</code>
          </pre>
        </div>
      </div>
      {guides.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Related guides</h2>
          <ul className="mt-2 list-disc pl-5">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">More {t.category.toLowerCase()} templates</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <TemplateCard key={r.slug} t={r} />
            ))}
          </ul>
        </section>
      )}
      <JsonLd
        data={[
          breadcrumbs(trail),
          templateLd({
            name: `${t.title} diagram template`,
            description: descriptionOf(t.summary),
            path,
            keywords: t.keywords,
          }),
        ]}
      />
    </Page>
  );
}
