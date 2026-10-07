import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Changelog | ArchBoard Release Notes",
  description:
    "Release notes for ArchBoard: new features, fixes and improvements to the offline-first system design whiteboard, listed newest first for every version.",
  path: "/changelog",
});

export default function Route() {
  return (
    <Page title="Changelog">
      <ul className="text-muted list-disc space-y-1 pl-5">
        <li>0.7.0: 47 templates, guides, comparisons and a component catalog.</li>
        <li>
          0.6.0: pages, version history, auto-layout, diagram DSL, Mermaid, share links, slides,
          comments, command palette and style presets.
        </li>
        <li>
          0.5.0: smart components. 0.4.0: building blocks, icons and kits. 0.3.0: export suite.
          0.2.0: local persistence. 0.1.0: foundation.
        </li>
      </ul>
    </Page>
  );
}
