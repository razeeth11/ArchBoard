# Known gaps

Status: Phase 3 of 8 complete (foundation, persistence, export). Not yet built: component library, Smart Components,
premium features (version history UI, multi-page, presentation, comments, command palette, auto-layout, Mermaid/DSL, share links),
content (templates/guides/comparisons), PWA/offline, CSP headers, Lighthouse CI.

Phase 2 specifics:

- Snapshots table exists and is garbage-collection aware, but no snapshots are created yet (Phase 6).
- Multi-page UI is not built; the data model (`pages`, `pageIds`) supports it.
- Dedicated Web Locks are not used. Multi-tab safety relies on optimistic `rev` checks inside the write transaction plus a BroadcastChannel notice, which covers the "no silent overwrite" requirement without lock contention.
- Thumbnails are generated on the main thread (skipped above 3,000 elements); moving to a worker is a Phase 8 item.
- The autosave change signature walks all elements on each editor change; fine up to a few thousand elements, to be measured at 5k/20k in Phase 8.
- `navigator.storage.persist()` is denied in headless Chromium and often in Safari/Firefox without engagement; the UI shows a "Download backup" link in that case rather than blocking.
- Version-history, library and settings e2e coverage: library and theme are covered; version history arrives with Phase 6.
- Firefox/WebKit e2e not run in this sandbox (CI runs them with `ALL_BROWSERS=1`).
- `window.__archboard.api` exposes the editor handle for tests and debugging; it only exposes the user's own in-tab data.

Phase 3 (export) specifics:

- **No Web Worker for the render path.** `exportToSvg`, `svg2pdf` and canvas rendering need the DOM, so they cannot run in a worker. Instead the pipeline is staged with an `AbortSignal`, yields to the UI between stages, shows a progress bar, and is cancellable. Excalidraw's own font-subsetting _does_ run in a Web Worker (we repaired its worker URL, see DECISIONS #14). Cancelling is checked between stages/pages, not mid-stage, so a single enormous page can finish its current stage before stopping.
- **Text outlines skip right-to-left text and glyphs missing from the embedded font subset** (they stay as live `<text>`), because opentype.js does no bidi/shaping. PDF text uses the same subsets; RTL runs fall back to Helvetica in the PDF.
- Mixed-font lines are split into one text object per font run in the PDF (still selectable, but a selection may break at font boundaries).
- Emoji (Segoe UI Emoji fallback) are not embedded in PDFs/outlined SVGs.
- "Current page" export is the whole canvas until multi-page scenes exist (Phase 6); the PDF builder already accepts multiple sheets.
- PNG export is capped at 16,384 px per side / 200 MP; larger requests show an error recommending SVG/PDF.
- Visual-regression baselines are generated on Linux/Chromium; other platforms need their own baselines (Playwright suffixes them automatically).
- Copy PNG/SVG rely on the async Clipboard API (Chromium/Safari; Firefox supports text and, from recent versions, images).
- Importing Mermaid/DSL text is Phase 6; images-as-new-elements import is handled by Excalidraw's own paste/drop.
