import Link from "next/link";
import { BLOCKS, TECH } from "@/library/blocks";
import { SMART_DEFS } from "@/smart/defs";
import { itemList } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";

export const metadata = pageMetadata({
  title: "Architecture Component Library | ArchBoard",
  description: `${SMART_DEFS.length} smart components, ${BLOCKS.length} building blocks and ${TECH.length} technology logos for architecture diagrams: load balancers, caches, queues and more.`,
  path: "/components",
});

export default function Route() {
  const cats = [...new Set(BLOCKS.map((b) => b.category))];
  const groups = [...new Set(TECH.map((t) => t.group))];
  return (
    <Page title="Component library" wide>
      <p className="text-muted max-w-3xl">
        Everything in the Components panel of the editor. Drag or click to place it on the canvas.
        Smart components are parametric: change a property such as the replica count and the diagram
        regenerates in place, keeping your own edits.
      </p>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Smart components</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {SMART_DEFS.map((d) => (
            <li key={d.id} className="border-border rounded-xl border p-4">
              <h3 className="font-semibold">
                <Link href={`/components/${d.id}`} className="underline">
                  {d.name}
                </Link>
              </h3>
              <p className="text-muted mt-1 text-sm">{d.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Building blocks</h2>
        {cats.map((c) => (
          <div key={c} className="mt-4">
            <h3 className="font-semibold">{c}</h3>
            <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {BLOCKS.filter((b) => b.category === c).map((b) => (
                <li key={b.id}>
                  <strong>{b.name}</strong>
                  <span className="text-muted">: {b.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Technology logos</h2>
        <p className="text-muted mt-1 text-sm">
          Logos are trademarks of their owners; sources and licences are on the{" "}
          <Link href="/credits" className="underline">
            credits page
          </Link>
          .
        </p>
        {groups.map((g) => (
          <p key={g} className="mt-3 text-sm">
            <strong>{g}:</strong>{" "}
            {TECH.filter((t) => t.group === g)
              .map((t) => t.name)
              .join(", ")}
            .
          </p>
        ))}
      </section>
      <JsonLd
        data={itemList(
          "ArchBoard smart components",
          SMART_DEFS.map((d) => ({ name: d.name, path: `/components/${d.id}` })),
        )}
      />
    </Page>
  );
}
