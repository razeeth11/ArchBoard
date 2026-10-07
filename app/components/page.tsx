import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Architecture Component Library | ArchBoard",
  description:
    "Explore the ArchBoard library of architecture building blocks: load balancers, caches, queues, databases and parametric smart components for diagrams.",
  path: "/components",
});

export default function Route() {
  return (
    <Page title="Component library">
      <p className="text-muted">The component catalog arrives in a later phase.</p>
    </Page>
  );
}
