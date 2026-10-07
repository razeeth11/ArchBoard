import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";
import { DSL_EXAMPLES } from "@/dsl/examples";
import { KINDS } from "@/dsl/kinds";

const GUIDES: Record<string, { title: string; description: string }> = {
  "system-design-diagram": {
    title: "How to Draw a System Design Diagram",
    description:
      "A practical walkthrough for drawing clear system design diagrams: choosing boundaries, labelling data flow, and showing scale and failure modes in ArchBoard.",
  },
  "diagram-dsl": {
    title: "Diagram DSL: Draw Architecture from Text",
    description:
      "The ArchBoard diagram DSL: nodes, edges, labels, replicas, layouts and a dozen copy-paste examples. Type text, get an editable, auto-laid-out diagram.",
  },
};

function DslGuide() {
  const kinds = Object.keys(KINDS).sort();
  return (
    <div className="mt-6 space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Grammar</h2>
        <p className="mt-2">
          One statement per line. A node is <code>kind [tech] [&quot;label&quot;]</code>; give it an
          id with <code>kind id &quot;label&quot;</code> to refer to it later. Edges join nodes:{" "}
          <code>a -&gt; b</code> (solid), <code>a --&gt; b</code> (dashed),{" "}
          <code>a &lt;-&gt; b</code> (two-way) and <code>a -[label]-&gt; b</code> (labelled).{" "}
          <code>[api x3]</code> draws three replicas. Directives: <code>direction LR|TB</code>,{" "}
          <code>layout tree|radial|layered</code>, <code>title &quot;…&quot;</code>. Lines starting
          with <code>#</code> are comments.
        </p>
        <p className="mt-2">
          Limits: 150 nodes and 12 replicas per diagram. Errors show as wavy underlines in the
          editor (Tools → Diagram from text) and nothing is inserted until the text is valid.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Node kinds</h2>
        <p className="mt-2 text-sm">{kinds.join(", ")}.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Examples</h2>
        {DSL_EXAMPLES.map((ex) => (
          <article key={ex.id} className="mt-4">
            <h3 className="font-medium">{ex.title}</h3>
            <p className="text-muted text-sm">{ex.description}</p>
            <pre className="border-border bg-surface mt-2 overflow-x-auto rounded-lg border p-3 text-sm">
              <code>{ex.source}</code>
            </pre>
          </article>
        ))}
      </section>
    </div>
  );
}

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
      {slug === "diagram-dsl" && <DslGuide />}
    </Page>
  );
}
