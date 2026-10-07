import Link from "next/link";
import { GUIDES } from "@/content/guides";
import { itemList } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/ui/JsonLd";
import { Page } from "@/ui/SiteShell";

export const metadata = pageMetadata({
  title: "Architecture Diagram Guides | ArchBoard",
  description: `${GUIDES.length} practical guides on drawing system design and architecture diagrams: interviews, microservices, events, estimation, sharing and presenting.`,
  path: "/guides",
});

export default function Route() {
  return (
    <Page title="Guides">
      <p className="text-muted">
        Short, practical writing on drawing architecture clearly, and on getting the most out of
        ArchBoard.
      </p>
      <ul className="mt-6 space-y-5">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <h2 className="text-lg font-semibold">
              <Link href={`/guides/${g.slug}`} className="underline">
                {g.title}
              </Link>
            </h2>
            <p className="text-muted mt-1">{g.description}</p>
          </li>
        ))}
      </ul>
      <JsonLd
        data={itemList(
          "ArchBoard guides",
          GUIDES.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })),
        )}
      />
    </Page>
  );
}
