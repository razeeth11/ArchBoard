import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/ui/SiteShell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ArchBoard – Free Whiteboard for System Design Diagrams",
  description:
    "Draw architecture and system design diagrams in your browser. Free, private, works offline, no sign-up. Export to PNG, SVG and vector PDF.",
  path: "/",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Whiteboard for system design and architecture
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">
          A free, hand-drawn style canvas with reusable architecture components. Everything is
          stored on your device: no account, no server, works offline.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/app" className="bg-accent text-accent-fg rounded-md px-5 py-2.5 font-medium">
            Start drawing
          </Link>
          <Link href="/templates" className="border-border rounded-md border px-5 py-2.5">
            Browse templates
          </Link>
        </div>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
