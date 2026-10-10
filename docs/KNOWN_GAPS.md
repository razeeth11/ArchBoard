# Known gaps

Status: Phase 5 of 8 complete (foundation, persistence, export, system-design toolkit, Smart Components). Not yet built:, Smart Components,
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

Phase 4 (system-design toolkit) specifics:

- **Icons are logos/glyphs, not vendor architecture icons.** AWS/GCP/Azure/Kubernetes/Docker/Terraform appear as technology logos (SVG Logos CC0, Devicon MIT, Simple Icons CC0) plus generic Carbon/MDI/Lucide infrastructure glyphs. Proprietary cloud architecture icon packs are deliberately not used. Logos are trademarks of their owners (credits page says so).
- The per-set license files are generated from the SPDX id with the standard text; the "Copyright (c)" line uses the set's author name from Iconify metadata. Verify against each upstream repository before a public release.
- Online icon search (Iconify API) is opt-in, restricted to 18 permissively licensed sets, and not exhaustive. It needs the Phase 8 CSP to allow `connect-src https://api.iconify.design`.
- "Editable shapes" SVG import approximates curves as polylines (≤1,500 shapes, gradients become flat fills, text/clip/mask/filters are dropped). The default "Vector image" mode keeps full fidelity.
- Pasting an SVG _file_ from the clipboard and dropping SVG files are intercepted and sanitized; images dragged from other web pages (URLs) still go through Excalidraw's own image path.
- Kits are static starting shapes, not parametric: arrows are not bound to boxes and connection ports arrive with Smart Components (Phase 5). Class/entity boxes are grouped text, not a table widget.
- Block/kit previews in the panel are icons or labels, not rendered thumbnails.
- No keyboard-only alternative to drag-and-drop is needed (click inserts), but there is no "insert at selection" yet.
- Catalog pages (`/components/[slug]`) and their SEO content are Phase 7; the data (`src/library/blocks.ts`, `kits.ts`) is already structured for them.

Phase 5 (Smart Components) specifics:

- **Layout is generator-driven.** Hand-moving an individual part of a component is lost on the next regeneration (colour, label and style edits and moving the whole component are kept). A removed-then-regenerated part returns if you deleted it by hand.
- Regeneration re-routes outside arrows as straight lines to the part's new edge. Elbow/curved arrow shapes are not preserved on those ends.
- Ports are named connection targets exposed in the panel ("Connect" creates a bound arrow); there is no on-canvas port dot or drag-to-port snapping beyond Excalidraw's normal binding to the port's shape.
- The Connect action needs the component and one other shape selected together (shift-click); there is no pick-a-shape mode.
- Custom components support rectangles, ellipses, diamonds, text, lines, arrows and **SVG** images. Raster images, groups/frames as parameters, and arithmetic or conditionals beyond `visibleIf`/repeat are not supported (by design: definitions are data, not code).
- "Create from selection" repeats one part in a straight line (right or down) and parameterizes text labels; it does not infer layout rules, and it does not replace the selection with an instance.
- Version upgrades (`Update to vN`) treat the current look as the baseline, so a structural change in a new definition version may not carry hand edits across.
- Smart component SVG `<symbol>` images are inlined for PDF export; visual baselines are Linux/Chromium only.
- The properties panel is not yet laid out for narrow phone screens (it overlays the canvas); desktop and tablet widths are tested.

Phase 6 (productivity) specifics:

- Multi-page PDF: the export dialog's "Include every page of this scene" option writes every page (empty pages are skipped); frames still become PDF pages with "One page per frame". Other formats export the open page only.
- Version history compares element counts/ids (added, removed, changed); there is no per-property visual diff overlay. Previews are side by side.
- Comments are single local notes (no replies, authors or notifications). They are included in backups but not in share links or single-scene exports.
- Pins are drawn over the canvas and follow scroll/zoom; they are not announced to screen readers beyond the panel list.
- Presenting needs at least one frame. Laser uses Excalidraw's laser tool; there is no timer or presenter window, and exiting fullscreen with Esc ends the presentation.
- Auto-layout moves whole groups as units and ignores unconnected shapes' relationships; frames and containers are not laid out as ELK hierarchies.
- Flowchart quick-create is Excalidraw's own Ctrl/Cmd+Arrow (verified by a test); the palette shortcut Ctrl/Cmd+K shadows Excalidraw's link editor.
- Mermaid import: flowchart, sequence and class diagrams become shapes; other types arrive as images (library behaviour). Mermaid export covers rectangles, ellipses, diamonds and bound arrows only. The importer needs a strict-CSP review in Phase 8.
- DSL: no editor autocomplete or syntax colours (errors only); kinds and techs are the built-in catalogue.
- Share links: a view link is not access control (anyone with the whole link can read it); images make links long and are optional; the link is limited to what a URL can carry.
- Style presets also set the look (roughness, stroke colour, font) of newly inserted library items, kits, smart components and DSL diagrams. Fill colours of generated content stay category-coloured.

Phase 7 (content and SEO) specifics:

- **Templates are original but unreviewed by domain experts.** The copy describes common textbook designs and trade-offs; it is not benchmarked advice. Have an engineer read any template you intend to rely on.
- Thumbnails use a system sans-serif for labels (the editor uses the hand-drawn font). Regenerate with `pnpm build && pnpm previews:build` after changing a template; stale thumbnails are not detected automatically.
- Only smart components get their own `/components/<id>` pages. Building blocks and technology logos are listed on `/components` but have no individual pages, to avoid thin content.
- Open Graph cards are text-only; they do not show the diagram. Generated card files have no extension and rely on a `Content-Type` header (`public/_headers` covers Netlify and Cloudflare Pages; other hosts need an equivalent in Phase 8).
- Lighthouse numbers were measured on the sandbox with simulated mobile throttling (performance 98-99, accessibility 100, best practices 96, SEO 100, CLS 0). Real-world field data does not exist yet.
- Structured data is limited to WebApplication, BreadcrumbList, ItemList, TechArticle and CreativeWork. FAQ, HowTo and review markup are intentionally not used.
- Comparison pages are written from public knowledge of each product at the review date; they are not endorsed by, or affiliated with, the other products.
- All content is English; i18n scaffolding is Phase 8.

Phase 8 (hardening) specifics:

- **BYO-key AI** is built (Tools, Draw with AI): text in, DSL out, opened in the editor for review. It is opt-in, calls api.anthropic.com straight from the browser with the user's key, and was tested against a mocked endpoint only (no real key was used). **WebRTC live collaboration is not built**: it needs a signalling relay, which conflicts with the no-backend rule; there is no code for it and the docs do not claim it.
- **The pre-editor JS budget is not met** (about 176 kB gzip against 120 kB): that is the Next.js and React runtime. See PERFORMANCE.md.
- **Excalidraw's third-party font fallback.** The engine lists an `esm.sh` URL after every local font URL. Under the shipped CSP the browser logs a blocked-font message for it; the local fonts load normally and an e2e test proves no request leaves the origin. The noise is filtered in the CSP test only.
- **Style CSP** needs `'unsafe-inline'` (engine limitation). **Hosting:** `_headers` is for Netlify and Cloudflare Pages; other hosts need the policy translated by hand, and the script hashes change with every build.
- **Service worker:** first-visit offline readiness takes a few seconds after load (the precache installs in the background); a hard refresh while offline before that finishes will not work. Updates are applied only when the user chooses Reload.
- Offline support was tested in Chromium. Firefox and WebKit run in CI only (not available in this sandbox).
- **Scale:** tested with 5,000 (automated) and 20,000 (one-off) plain rectangles. Scenes dominated by images, long text or many smart components were not benchmarked. Phones were not tested.
- **i18n** is a scaffold: only English strings exist and only the top toolbar and update prompt use the catalogue.
- **Accessibility:** automated axe checks cover the site pages and key dialogs. There has been no screen-reader walkthrough, and the canvas itself is not accessible beyond what Excalidraw provides.

Editing workflow (labels, tools, home, lists, design panel):

- Label fitting uses an average character width taken from the converter's own measurement; unusual fonts or mixed-width text can wrap one character early or late. Shapes you draw by hand still use Excalidraw's own behaviour (the shape grows taller as you type).
- The Design panel appears from 1024px wide, edits the selection's bounding box (rotated shapes use their unrotated frame), and does not offer corner radius or per-corner controls. Standalone text is moved, not resized.
- Lists: bullets, numbers and Enter-continuation work in the text editor. Indentation levels (Tab), nested lists and converting existing text from a menu are not built; Ctrl/Cmd+Shift+8 and 7 are the only toggles.
- "New editor on every visit" reuses an untouched empty scene; two tabs opened at the same moment may share it. Recent shows the 8 most recently edited scenes.
