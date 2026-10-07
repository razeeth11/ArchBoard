import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "System Design Templates | ArchBoard",
  description:
    "Browse ready-made system design and architecture diagram templates you can open in the ArchBoard editor and edit locally, with no sign-up needed.",
  path: "/templates",
});

export default function Route() {
  return (
    <Page title="Templates">
      <p className="text-muted">Templates arrive in a later phase.</p>
    </Page>
  );
}
