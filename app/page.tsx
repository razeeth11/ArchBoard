import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/ui/SiteShell";
import { JsonLd } from "@/ui/JsonLd";
import { TemplateCard } from "@/ui/TemplateCard";
import { GUIDES } from "@/content/guides";
import { TEMPLATES } from "@/content/templates";
import { webApplication } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ArchBoard – Free Whiteboard for System Design Diagrams",
  description:
    "Draw architecture and system design diagrams in your browser. Free, private, works offline, no sign-up. Export to PNG, SVG and vector PDF.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-[80%] py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Whiteboard for system design and architecture
        </h1>
        <p className="text-muted mt-4 text-lg">
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
        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Start from a template</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["url-shortener", "chat-application", "microservices-gateway"].map((s) => (
              <TemplateCard key={s} t={TEMPLATES.find((t) => t.slug === s)!} />
            ))}
          </ul>
          <p className="mt-4">
            <Link href="/templates" className="underline">
              All {TEMPLATES.length} templates
            </Link>
          </p>
        </section>
        <section className="mt-16 grid gap-8 sm:grid-cols-3">
          <div>
            <h2 className="text-lg font-semibold">Private by design</h2>
            <p className="text-muted mt-1 text-sm">
              No account and no server. Scenes live in your browser and nothing leaves it unless you
              export or share.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Made for architecture</h2>
            <p className="text-muted mt-1 text-sm">
              Building blocks, technology logos, smart components and a text DSL with automatic
              layout.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ready to share</h2>
            <p className="text-muted mt-1 text-sm">
              Export PNG, SVG and vector PDF, present frames as slides, or send an encrypted link.
            </p>
          </div>
        </section>
        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Guides</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {GUIDES.slice(0, 5).map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={webApplication()} />
    </>
  );
}
