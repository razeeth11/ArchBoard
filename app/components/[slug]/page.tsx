import Link from "next/link";
import { notFound } from "next/navigation";
import { TEMPLATES } from "@/content/templates";
import { fitDescription } from "@/content/seo";
import { SMART_DEFS } from "@/smart/defs";
import { breadcrumbs } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/ui/Breadcrumbs";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";

export const dynamicParams = false;
export function generateStaticParams() {
  return SMART_DEFS.map((d) => ({ slug: d.id }));
}

const SUFFIX = [
  "Configurable, regenerates in place and keeps your edits. Free in ArchBoard.",
  "A configurable smart component for ArchBoard. Free, private, works offline.",
  "Free in the ArchBoard editor, with editable properties.",
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = SMART_DEFS.find((x) => x.id === slug);
  if (!d) return {};
  return pageMetadata({
    title: `${d.name} Smart Component | ArchBoard`,
    description: fitDescription(d.description, SUFFIX),
    path: `/components/${d.id}`,
  });
}

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = SMART_DEFS.find((x) => x.id === slug);
  if (!d) notFound();
  const trail = [
    { name: "Home", path: "/" },
    { name: "Components", path: "/components" },
    { name: d.name, path: `/components/${d.id}` },
  ];
  const words = new Set(d.keywords.map((k) => k.toLowerCase()));
  const related = TEMPLATES.filter((t) =>
    t.keywords.some((k) => [...words].some((w) => k.includes(w) || w.includes(k))),
  ).slice(0, 3);
  return (
    <Page title={d.name}>
      <Breadcrumbs trail={trail} />
      <p className="text-muted">Smart component · {d.category}</p>
      <p className="mt-4 text-lg leading-relaxed">{d.description}</p>
      <h2 className="mt-8 text-xl font-semibold">Properties</h2>
      <p className="text-muted mt-1 text-sm">
        Change any of these in the properties panel and the component regenerates in place. Labels,
        colours and arrows you attached yourself are kept.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Properties of {d.name}</caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-2 pr-4">
                Property
              </th>
              <th scope="col" className="py-2 pr-4">
                Type
              </th>
              <th scope="col" className="py-2 pr-4">
                Values
              </th>
              <th scope="col" className="py-2">
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {d.schema.map((p) => (
              <tr key={p.key} className="border-border border-b align-top">
                <th scope="row" className="py-2 pr-4 font-medium">
                  {p.label}
                </th>
                <td className="py-2 pr-4">{p.type}</td>
                <td className="py-2 pr-4">
                  {p.type === "number"
                    ? `${p.min} to ${p.max}`
                    : p.type === "select"
                      ? p.options.join(", ")
                      : p.type === "boolean"
                        ? "on or off"
                        : "free text"}
                </td>
                <td className="py-2">{String(p.default)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 text-xl font-semibold">How to use it</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Open the editor and press Components, then choose the Smart tab.</li>
        <li>Click {d.name} to place it, or drag it to an exact spot.</li>
        <li>Adjust its properties, then connect your own shapes to its ports.</li>
      </ol>
      <p className="mt-4">
        <Link href="/app" className="bg-accent text-accent-fg rounded-md px-4 py-2 font-medium">
          Open the editor
        </Link>
      </p>
      {related.length > 0 && (
        <section>
          <h2 className="mt-8 text-xl font-semibold">Seen in these templates</h2>
          <ul className="mt-2 list-disc pl-5">
            {related.map((t) => (
              <li key={t.slug}>
                <Link href={`/templates/${t.slug}`} className="underline">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <JsonLd data={breadcrumbs(trail)} />
    </Page>
  );
}
