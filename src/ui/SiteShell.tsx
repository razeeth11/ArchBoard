import Link from "next/link";
import { CREATOR, NAV, SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-[92%] items-center justify-between gap-3 py-3 lg:w-[80%]"
      >
        <Link href="/" className="text-lg font-semibold">
          {SITE.name}
        </Link>
        {/* Wide screens: the full link row. */}
        <ul className="hidden items-center gap-4 text-sm md:flex">
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
        {/* Phones and small tablets: the main action stays visible, the rest sit in a menu. */}
        <div className="flex items-center gap-2 text-sm md:hidden">
          <Link
            href="/app"
            className="bg-accent text-accent-fg rounded-md px-3 py-1.5 font-medium whitespace-nowrap"
          >
            Start drawing
          </Link>
          <details className="group relative">
            <summary
              className="border-border bg-surface flex h-9 cursor-pointer list-none items-center rounded-md border px-3 select-none [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              Menu
            </summary>
            <ul className="border-border bg-bg absolute right-0 z-40 mt-2 w-48 rounded-lg border p-1 shadow-xl">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:bg-surface block rounded px-3 py-2">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-border text-muted border-t py-6 text-sm">
      <div className="mx-auto flex w-[92%] flex-wrap gap-x-4 gap-y-2 lg:w-[80%]">
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
