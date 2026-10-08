import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/content/templates";
import { itemList } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";
import { TemplateCard } from "@/ui/TemplateCard";

export const metadata = pageMetadata({
  title: "System Design Diagram Templates | ArchBoard",
  description: `${TEMPLATES.length} free system design and architecture diagram templates, from a URL shortener to Kubernetes ingress. Open any one in ArchBoard and edit it locally.`,
  path: "/templates",
});

export default function Route() {
  return (
    <Page title="System design templates" wide>
      <p className="text-muted">
        Every template is a real, editable diagram with a short explanation of the design, its
        trade-offs and where it breaks. Open one and ArchBoard builds it as a new scene on your
        device. Nothing is uploaded and there is no account.
      </p>
      <nav aria-label="Template categories" className="mt-4 flex flex-wrap gap-2 text-sm">
        {TEMPLATE_CATEGORIES.map((c) => (
          <a
            key={c}
            href={`#${c.replace(/\s+/g, "-").toLowerCase()}`}
            className="border-border rounded-full border px-3 py-1"
          >
            {c}
          </a>
        ))}
      </nav>
      {TEMPLATE_CATEGORIES.map((c) => (
        <section key={c} id={c.replace(/\s+/g, "-").toLowerCase()} className="mt-10">
          <h2 className="text-2xl font-semibold">{c}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.filter((t) => t.category === c).map((t) => (
              <TemplateCard key={t.slug} t={t} />
            ))}
          </ul>
        </section>
      ))}
      <JsonLd
        data={itemList(
          "System design diagram templates",
          TEMPLATES.map((t) => ({ name: t.title, path: `/templates/${t.slug}` })),
        )}
      />
    </Page>
  );
}
