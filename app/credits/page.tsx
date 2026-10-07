import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Credits and Licenses | ArchBoard",
  description:
    "Open-source credits for ArchBoard: Excalidraw (MIT) and every icon set, font and library we use, with their licenses and attribution requirements.",
  path: "/credits",
});

export default function Route() {
  return (
    <Page title="Credits">
      <p className="text-muted">
        ArchBoard is built on Excalidraw, MIT License, Copyright (c) 2020 Excalidraw. Full notice in
        the repository LICENSE-THIRD-PARTY file.
      </p>
    </Page>
  );
}
