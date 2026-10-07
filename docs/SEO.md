# SEO and content workflow

- Content lives in `src/content/` (`templates/`, `guides.ts`, `compare.ts`). Pages, sitemap and JSON-LD are generated from it.
- Add a template: add an object to the right file in `src/content/templates/`, run `pnpm test` (copy length, DSL validity, originality), then `pnpm build && pnpm previews:build` and commit the new SVG in `public/previews/`.
- Add a guide: append to `GUIDES` (title <= 50 chars, description 130-160 chars, 250+ words).
- Validate the build: `pnpm build && pnpm seo:validate` (titles, descriptions, canonicals, h1, JSON-LD, links, images, sitemap).
- Performance gate: `pnpm lhci` (needs Chrome; set `CHROME_PATH` in the sandbox).
- Titles are written in full (brand included); `pageMetadata` marks them absolute.
