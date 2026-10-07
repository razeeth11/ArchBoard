import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Compare ArchBoard | Whiteboard Alternatives",
  description:
    "Honest comparisons of ArchBoard with Excalidraw, draw.io, Lucidchart and Miro: what each does well and when ArchBoard is the better fit for you.",
  path: "/vs",
});

export default function Route() {
  return (
    <Page title="Comparisons">
      <p className="text-muted">Comparison pages arrive in a later phase.</p>
    </Page>
  );
}
