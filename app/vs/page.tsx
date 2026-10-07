import Link from "next/link";
import { COMPARISONS } from "@/content/compare";
import { pageMetadata } from "@/lib/metadata";
import { Page } from "@/ui/SiteShell";

export const metadata = pageMetadata({
  title: "Compare ArchBoard | Whiteboard Alternatives",
  description:
    "Honest comparisons of ArchBoard with Excalidraw, draw.io, Lucidchart, Miro and Mermaid: what each does well and when ArchBoard is the better fit for you.",
  path: "/vs",
});

export default function Route() {
  return (
    <Page title="Comparisons">
      <p className="text-muted">
        We say where the other tool is the better choice as well as where ArchBoard is. We compare
        how the products are built rather than prices or limits, which change often.
      </p>
      <ul className="mt-6 space-y-5">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <h2 className="text-lg font-semibold">
              <Link href={`/vs/${c.slug}`} className="underline">
                {c.title}
              </Link>
            </h2>
            <p className="text-muted mt-1">{c.description}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
