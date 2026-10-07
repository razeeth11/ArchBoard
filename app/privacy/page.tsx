import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Privacy Policy | ArchBoard",
  description:
    "ArchBoard stores everything on your device. No accounts, no trackers, no cookies required. Read exactly what is stored and how to delete it at any time.",
  path: "/privacy",
});

export default function Route() {
  return (
    <Page title="Privacy">
      <p className="text-muted">
        All data stays on your device. ArchBoard has no accounts and no analytics.
      </p>
    </Page>
  );
}
