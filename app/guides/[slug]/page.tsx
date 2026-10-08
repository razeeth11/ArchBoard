import Link from "next/link";
import { notFound } from "next/navigation";
import { DSL_EXAMPLES } from "@/dsl/examples";
import { KINDS } from "@/dsl/kinds";
import { GUIDES, guideBySlug } from "@/content/guides";
import { templateBySlug } from "@/content/templates";
import { article, breadcrumbs } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/ui/Breadcrumbs";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return pageMetadata({
    title: `${g.title} | ArchBoard`,
    description: g.description,
    path: `/guides/${g.slug}`,
    kind: "article",
    ownImage: true,
  });
}

function DslReference() {
  const kinds = Object.keys(KINDS).sort();
  return (
    <>
      <section>
        <h2 className="mt-8 text-xl font-semibold">Grammar</h2>
        <p className="mt-2">
          One statement per line. A node is <code>kind [tech] [&quot;label&quot;]</code>. Give it an
          id with <code>kind id &quot;label&quot;</code> to refer to it later; a node without an id
          is referred to by its label in lower case with dashes. Edges join nodes:{" "}
          <code>a -&gt; b</code> (solid), <code>a --&gt; b</code> (dashed),{" "}
          <code>a &lt;-&gt; b</code> (two-way) and <code>a -[label]-&gt; b</code> (labelled). Chain
          edges on one line, and write <code>[api x3]</code> to draw three replicas. Directives:{" "}
          <code>direction LR</code> or <code>TB</code>, <code>layout tree</code>,{" "}
          <code>radial</code> or <code>layered</code>, and <code>title &quot;…&quot;</code>.
        </p>
        <p className="mt-2">
          Limits: 150 nodes and 12 replicas per diagram. Errors appear as wavy underlines in the
          editor (Tools, then Diagram from text) and nothing is inserted until the text is valid.
        </p>
      </section>
      <section>
        <h2 className="mt-8 text-xl font-semibold">Node kinds</h2>
        <p className="mt-2 text-sm">{kinds.join(", ")}.</p>
      </section>
      <section>
        <h2 className="mt-8 text-xl font-semibold">Examples</h2>
        {DSL_EXAMPLES.map((ex) => (
          <article key={ex.id} className="mt-4">
            <h3 className="font-medium">{ex.title}</h3>
            <p className="text-muted text-sm">{ex.description}</p>
            <pre
              tabIndex={0}
              className="border-border bg-surface mt-2 overflow-x-auto rounded-lg border p-3 text-sm"
            >
              <code>{ex.source}</code>
            </pre>
          </article>
        ))}
      </section>
    </>
  );
}

export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const path = `/guides/${g.slug}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: g.title, path },
  ];
  const templates = g.templates.map(templateBySlug).filter((t) => !!t);
  return (
    <Page title={g.title}>
      <Breadcrumbs trail={trail} />
      <p className="text-muted">{g.description}</p>
      {g.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mt-8 text-xl font-semibold">{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-2 leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
      {g.extra === "dsl" && <DslReference />}
      {templates.length > 0 && (
        <section>
          <h2 className="mt-8 text-xl font-semibold">Try it with a template</h2>
          <ul className="mt-2 list-disc pl-5">
            {templates.map((t) => (
              <li key={t!.slug}>
                <Link href={`/templates/${t!.slug}`} className="underline">
                  {t!.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-muted mt-8 text-sm">Last updated {g.updated}.</p>
      <JsonLd
        data={[
          breadcrumbs(trail),
          article({ headline: g.title, description: g.description, path, updated: g.updated }),
        ]}
      />
    </Page>
  );
}
