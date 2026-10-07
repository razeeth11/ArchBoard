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
      <p className="text-muted">0.1.0: project foundation.</p>
    </Page>
  );
}
