import { Page } from "@/ui/SiteShell";
import { Breadcrumbs } from "@/ui/Breadcrumbs";
import { JsonLd } from "@/ui/JsonLd";
import { breadcrumbs, creator } from "@/lib/jsonld";
import { CREATOR } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "About ArchBoard | Private Diagramming Tool",
  description:
    "ArchBoard is an open-source, offline-first whiteboard for architecture diagrams built on Excalidraw. Learn how it works and why your data stays local.",
  path: "/about",
});

const trail = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

export default function Route() {
  return (
    <Page title="About ArchBoard">
      <Breadcrumbs trail={trail} />
      <p className="text-muted">ArchBoard is built on the MIT-licensed Excalidraw engine.</p>
      <p className="mt-4">
        ArchBoard is a free whiteboard for system design and architecture diagrams. It runs in your
        browser, works offline, needs no account, and keeps every drawing on your device unless you
        choose to export or share it.
      </p>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">About the creator</h2>
        <p className="mt-2">
          ArchBoard is made by{" "}
          <a href={CREATOR.url} rel="me noopener" className="underline">
            {CREATOR.name}
          </a>
          .
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <a href={CREATOR.url} rel="me noopener" className="underline">
              {CREATOR.name} on GitHub
            </a>
          </li>
          <li>
            <a href={CREATOR.repoUrl} rel="noopener" className="underline">
              ArchBoard source code
            </a>
          </li>
          {CREATOR.storeUrl && (
            <li>
              <a href={CREATOR.storeUrl} rel="noopener" className="underline">
                ArchBoard in the Microsoft Store
              </a>
            </li>
          )}
        </ul>
      </section>
      <p className="text-muted mt-10 text-sm">
        Excalidraw is a trademark of its owners. ArchBoard is an independent project and is not
        affiliated with or endorsed by Excalidraw.
      </p>
      <JsonLd data={[breadcrumbs(trail), creator()]} />
    </Page>
  );
}
