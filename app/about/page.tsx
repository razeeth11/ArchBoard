import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "About ArchBoard | Private Diagramming Tool",
  description:
    "ArchBoard is an open-source, offline-first whiteboard for architecture diagrams built on Excalidraw. Learn how it works and why your data stays local.",
  path: "/about",
});

export default function Route() {
  return (
    <Page title="About ArchBoard">
      <p className="text-muted">ArchBoard is built on the MIT-licensed Excalidraw engine.</p>
    </Page>
  );
}
