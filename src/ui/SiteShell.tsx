import Link from "next/link";
import { CREATOR, NAV, SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-[80%] items-center justify-between gap-4 py-3"
      >
        <Link href="/" className="text-lg font-semibold">
          {SITE.name}
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-muted hover:text-fg">
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/app"
              className="bg-accent text-accent-fg rounded-md px-3 py-1.5 font-medium"
            >
              Start drawing
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-border text-muted border-t py-6 text-sm">
      <div className="mx-auto flex w-[80%] flex-wrap gap-4">
        <Link href="/privacy">Privacy</Link>
        <Link href="/credits">Credits</Link>
        <Link href="/changelog">Changelog</Link>
        <span>MIT licensed. Your data stays on your device.</span>
        <a
          href={CREATOR.url}
          rel="me noopener"
          data-testid="creator-credit"
          className="hover:text-fg underline"
        >
          {`Built by ${CREATOR.name}`}
        </a>
        {CREATOR.storeUrl && (
          <a href={CREATOR.storeUrl} rel="noopener" className="hover:text-fg underline">
            Microsoft Store
          </a>
        )}
      </div>
    </footer>
  );
}

export function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-[80%] py-10">
        <h1 className="mb-4 text-3xl font-bold">{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
