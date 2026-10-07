# Performance

Measured on the build in this repository (headless Chromium, software rendering, sandbox CPU), 2026-10-07. Treat these as relative numbers, not field data.

## JavaScript budget

| Measure                                                | Result      | Budget   | Status      |
| ------------------------------------------------------ | ----------- | -------- | ----------- |
| JS loaded before the editor chunk (`/app` shell), gzip | **~176 kB** | < 120 kB | **Not met** |
| Same on marketing pages (`/`, `/templates`, ...)       | ~174 kB     | n/a      | -           |
| All app chunks combined (lazy), gzip                   | ~3.5 MB     | n/a      | -           |

The 176 kB is the Next.js (App Router) and React 19 runtime. Our own code contributes almost nothing to it: every heavy dependency (Excalidraw, ELK, Mermaid, jsPDF, svg2pdf, opentype, DOMPurify, wawoff2) is imported lazily and does not appear in the pre-editor script tags. Getting under 120 kB would mean dropping the framework runtime (for example a Vite + Preact build), which is a different architecture; the decision is recorded in `DECISIONS.md`. The marketing pages still score 98-99 on Lighthouse because they have no client-side work to do after load.

## Lighthouse (static export, `pnpm lhci`, simulated mobile)

Performance 98-99, accessibility 100, best practices 96, SEO 100, CLS 0, TBT 32-85 ms on `/`, `/templates`, a template page, a guide, a comparison and `/components`. The editor route is intentionally not gated: it is an application, not a document.

## Scale

`tests/e2e/hardening.spec.ts` keeps 5,000 rectangles as a regression test (set, autosave, reload, restore all within a 20 s ceiling; about 0.9 s here). One-off run with 20,000 rectangles: set 0.13 s, autosave 0.7 s, reload and restore 1.0 s, panning stayed at one frame per animation frame (about 16 ms). Plain rectangles only; scenes with thousands of text elements, images or smart components were not measured.

## Storage and network

- First visit to the editor downloads the shell plus lazily loaded chunks as features are used; the service worker then precaches ~190 build files (a few MB) five seconds after load, in batches, so it does not compete with startup.
- Self-hosted fonts and the subsetting worker live in `/excalidraw-assets` (18 MB on disk, fetched per font as used). Icon sets (`/icons`, 0.7 MB) and template previews (`/previews`, 1.8 MB) load on demand.
- No request leaves the origin during normal use (enforced by an e2e test). The only optional third-party host is `api.iconify.design`, after the user turns on online icon search.
