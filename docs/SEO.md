# SEO and content workflow

- Content lives in `src/content/` (`templates/`, `guides.ts`, `compare.ts`). Pages, sitemap and JSON-LD are generated from it.
- Add a template: add an object to the right file in `src/content/templates/`, run `pnpm test` (copy length, DSL validity, originality), then `pnpm build && pnpm previews:build` and commit the new SVG in `public/previews/`.
- Add a guide: append to `GUIDES` (title <= 50 chars, description 130-160 chars, 250+ words).
- Validate the build: `pnpm build && pnpm seo:validate` (titles, descriptions, canonicals, h1, JSON-LD, links, images, sitemap).
- Performance gate: `pnpm lhci` (needs Chrome; set `CHROME_PATH` in the sandbox).
- Titles are written in full (brand included); `pageMetadata` marks them absolute.

## Creator branding and Search Console

The creator (`codebyrazeeth`) is a first-class brand of the site. The values live in `CREATOR` in `src/lib/site.ts`; nothing else is hard-coded.

- Visible: every content page footer shows "Built by codebyrazeeth" (links to the GitHub profile, `rel="me noopener"`); `/about` has an "About the creator" section; the homepage has a "Made by" section.
- Structured data: a schema.org `Person` (`@id` = `https://archboard.space/#creator`) is emitted on `/` and `/about` only. `WebApplication` and `Article` nodes reference it by `@id`. `sameAs` is the GitHub profile plus the Store URL when set.
- Microsoft Store: set `storeUrl` in `buildCreator(...)` / `CREATOR` (`src/lib/site.ts`). Until then nothing Store-related is rendered. Setting it adds the footer link, the About and home links and the `sameAs` entry.
- `pnpm seo:validate` fails if a page lacks the credit, `/` or `/about` lacks the Person node, a Person has the wrong name, `@id` or a non-https `sameAs`, or a `WebApplication`/`Article` author does not reference the creator `@id`.

Manual steps (cannot be done from the repo):

1. Google Search Console: add `archboard.space` as a "Domain" property and verify it with the DNS TXT record.
2. Submit `https://archboard.space/sitemap.xml`.
3. Use URL Inspection to request indexing for `/`, `/about` and `/templates`.
4. Bing Webmaster Tools: import the site from Search Console.
5. Put `https://archboard.space` in the website field of the GitHub profile and of the `razeeth11/ArchBoard` repository.
6. When the Microsoft Store listing exists, put the site URL in it and set `storeUrl`.
7. Use the same name, `codebyrazeeth`, everywhere.
