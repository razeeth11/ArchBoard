import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Page } from "@/ui/SiteShell";
import { pageMetadata } from "@/lib/metadata";
import type { LicenseManifest } from "@/library/icons";

export const metadata = pageMetadata({
  title: "Credits and Licenses | ArchBoard",
  description:
    "Open-source credits for ArchBoard: Excalidraw (MIT) and every icon set, font and library we use, with their licenses and attribution requirements.",
  path: "/credits",
});

function loadManifest(): LicenseManifest {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public", "licenses", "manifest.json"), "utf8"),
  ) as LicenseManifest;
}

const LIBS = [
  [
    "Excalidraw",
    "MIT",
    "https://github.com/excalidraw/excalidraw",
    "Drawing engine, hand-drawn rendering, fonts",
  ],
  ["Next.js / React", "MIT", "https://nextjs.org", "Application framework"],
  ["Dexie", "Apache-2.0", "https://dexie.org", "IndexedDB storage"],
  ["jsPDF + svg2pdf.js", "MIT", "https://github.com/parallax/jsPDF", "Vector PDF export"],
  ["opentype.js", "MIT", "https://opentype.js.org", "Text-to-outline conversion"],
  ["wawoff2", "MIT", "https://github.com/fontello/wawoff2", "WOFF2 decoding"],
  ["DOMPurify", "Apache-2.0 / MPL-2.0", "https://github.com/cure53/DOMPurify", "SVG sanitizing"],
  [
    "Radix UI, Zustand, Lucide",
    "MIT / ISC",
    "https://www.radix-ui.com",
    "Interface primitives and state",
  ],
] as const;

export default function Credits() {
  const manifest = loadManifest();
  return (
    <Page title="Credits">
      <p className="text-muted">
        ArchBoard is MIT licensed and built on open-source work. Everything runs in your browser.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-semibold">Excalidraw</h2>
      <p className="text-muted text-sm">
        MIT License. Copyright (c) 2020 Excalidraw. Permission is hereby granted, free of charge, to
        any person obtaining a copy of this software and associated documentation files, to deal in
        the Software without restriction, subject to the inclusion of this copyright notice and
        permission notice in all copies or substantial portions of the Software. The Software is
        provided &ldquo;as is&rdquo;, without warranty of any kind.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-semibold">Icon sets</h2>
      <p className="text-muted mb-3 text-sm">
        Only sets whose licenses permit redistribution are bundled, and each license text is
        included under <code>/licenses</code>. Brand and technology logos are trademarks of their
        respective owners and appear only to identify technologies in diagrams. ArchBoard does not
        use any vendor&rsquo;s proprietary architecture-icon pack.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Bundled icon sets and their licenses</caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-2 pr-3">
                Set
              </th>
              <th scope="col" className="py-2 pr-3">
                Author
              </th>
              <th scope="col" className="py-2 pr-3">
                License
              </th>
              <th scope="col" className="py-2">
                Icons used
              </th>
            </tr>
          </thead>
          <tbody>
            {manifest.sets.map((s) => (
              <tr key={s.prefix} className="border-border border-b align-top">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {s.name}
                  <span className="text-muted block text-xs font-normal">{s.note}</span>
                </th>
                <td className="py-2 pr-3">
                  {s.authorUrl ? (
                    <a className="underline" href={s.authorUrl} rel="noopener noreferrer">
                      {s.author}
                    </a>
                  ) : (
                    s.author
                  )}
                </td>
                <td className="py-2 pr-3">
                  <a className="underline" href={s.licenseFile}>
                    {s.license.title}
                  </a>
                  <span className="text-muted block text-xs">{s.license.spdx}</span>
                </td>
                <td className="py-2">{s.iconCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-3 text-xs">
        Machine-readable list:{" "}
        <a className="underline" href="/licenses/manifest.json">
          /licenses/manifest.json
        </a>
        . Optional online icon search is limited to permissively licensed sets.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-semibold">Software</h2>
      <ul className="space-y-1 text-sm">
        {LIBS.map(([name, lic, href, what]) => (
          <li key={name}>
            <a className="underline" href={href} rel="noopener noreferrer">
              {name}
            </a>{" "}
            <span className="text-muted">
              — {lic}. {what}.
            </span>
          </li>
        ))}
      </ul>
    </Page>
  );
}
