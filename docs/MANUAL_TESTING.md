# ArchBoard — manual test pack

## Run it

```
node serve.mjs          # then open http://localhost:4173/   (or: node serve.mjs 8080)
```

Needs only Node 18+. This is the production static build (`site/`), served with clean URLs.
Use a Chromium-based browser first (Chrome/Edge); then try Firefox and Safari. Use a normal window,
not private mode, so storage persists across restarts.

To rebuild after code changes (from the repo root): `pnpm manual` — regenerates this folder.

## 1. First load and drawing

- [ ] Open `/`, click **Start drawing**. The editor opens with no sign-in of any kind.
- [ ] Draw a few shapes, an arrow and some text. The status says **Saved locally**.
- [ ] Hard-reload (Ctrl/Cmd+Shift+R), then close the tab and reopen `/app`: everything is exactly as left, including zoom and scroll.
- [ ] Toggle the theme button (system → light → dark). Reload: it sticks.

## 2. Scenes workspace and safety

- [ ] **Scenes** → **New**. Draw something different. Switch back and forth; each keeps its own content.
- [ ] Rename, duplicate, pin, move up/down (⋯ menu) and drag rows to reorder; make a folder and move a scene into it; search.
- [ ] Move a scene to trash → **Undo** in the toast. Trash tab: restore and delete forever.
- [ ] Open the same scene in two tabs. Draw in tab B; tab A shows _"updated in another tab"_ → try **Merge**, **Reload latest**, **Keep mine**.
- [ ] **Backup** downloads JSON; **Import** it again → copies appear (nothing is overwritten). Also try importing a `.excalidraw` file.
- [ ] DevTools → Application → IndexedDB → `archboard` → `pages`: edit a page's `elements` to a string, reload → recovery dialog offers raw-data download and another scene.

## 3. Export (Export button or Ctrl/Cmd+Shift+E)

- [ ] PNG at 1×–4×, transparent vs solid, dark mode, padding. Preview updates live. Open the files.
- [ ] **Embed scene data** in a PNG and an SVG, then **Scenes → Import** that file: it comes back as an editable scene.
- [ ] SVG: with and without **Convert text to outlines**; open in a browser/Inkscape. Add a title and description and check `<title>`/`<desc>`.
- [ ] PDF: fit-to-content, A4, A3, Letter, custom; text is selectable and fonts match the screen. Add frames and tick **One page per frame**.
- [ ] Copy PNG / Copy SVG, then paste into another app.
- [ ] Start a PDF of a big scene and press **Cancel export**.

## 4. Components and kits (Components button)

- [ ] **Blocks**: search "redis", "kafka", "load balancer"; click to insert; drag one onto the canvas. Inserts land in free space and are one group.
- [ ] **Tech**: AWS, Google Cloud, Azure, Kubernetes, Docker, Terraform logos insert as labelled cards.
- [ ] **Kits**: try each kit (UML, Sequence, ERD, C4, Flowchart/BPMN-lite, Network, Wireframe, Data flow). ERD relationships use crow's-foot ends.
- [ ] **Icons**: search "server" (works offline). Tick **Also search online** to query Iconify (off by default; sends your search text to api.iconify.design). Untick/offline: you get a friendly message.
- [ ] **SVG**: import a file of your own, paste markup, or drop an `.svg` on the canvas. Try one containing `<script>` or `onload=` — they are stripped. Compare **Vector image** and **Editable shapes**.
- [ ] Export a scene with icons to PDF and zoom in: icons are crisp vectors.
- [ ] `/credits`: every icon set, its license, and a working license link.

## 4b. Smart Components (Components → Smart)

- [ ] Insert **Load-balanced service**. It appears as one group with a properties panel (bottom-right).
- [ ] Change **Replicas** with +/−: the diagram redraws in place; Ctrl/Cmd+Z undoes each change. Try the other properties (select, checkbox, text).
- [ ] Drag the whole component somewhere else, recolour a replica and edit a replica's label, then change **Replicas** again: position, your colour and your label stay.
- [ ] Draw an arrow from a rectangle to the load balancer (drag its end onto it), then change **Replicas**: the arrow stays attached and follows. Reduce replicas below the one an arrow targets: that arrow detaches instead of dangling.
- [ ] Shift-click the component and another shape → **Connect** next to a port (e.g. `in`): a bound arrow appears.
- [ ] Try every built-in (17): Database with replicas, Queue with consumers, Cache-aside, API gateway fan-out, Kubernetes deployment, CQRS, Saga, Event sourcing, Circuit breaker, Three-tier, Multi-region, CDN + shield, ETL, Pub/sub, Worker pool, Service mesh. Export one as PNG/SVG/PDF.
- [ ] **Detach** turns a component into plain shapes. Export JSON, import it as a new scene: the component is still editable.
- [ ] Draw two boxes with labels and an arrow, select them, **Create from selection…**: make a label a property, mark one box **Repeat**, save. Insert it from _Your components_, change **Count**.
- [ ] **New from JSON** shows live validation (try breaking the JSON); save a definition, export it, delete it, re-import it.

## 5. Offline and privacy

- [ ] DevTools → Network: no requests leave `localhost` while drawing, saving or exporting (the only exception is the opt-in icon search).
- [ ] Application → Cookies: none are set.
- [ ] (Full offline/PWA install arrives in Phase 8.)

## Known limits

See `docs/KNOWN_GAPS.md` in the repo for the honest list of what is not built yet.

## 6. Productivity (Tools menu, Ctrl/Cmd+K)

1. **Pages**: bottom tab strip; add, rename (double-click), duplicate, move, delete; reload keeps the page.
2. **History**: Tools → Version history. Save a named checkpoint, change the drawing, pick it, check the side-by-side and diff, Restore. Open history again: a "before restore" copy exists.
3. **Palette**: Ctrl/Cmd+K, type a few letters (`vhist`), Enter. Try a scene name and a building block.
4. **Auto-layout**: DSL-insert a diagram, drag nodes around, Tools → Auto-layout → Left-to-right; Ctrl+Z undoes it.
5. **DSL**: Tools → Diagram from text; break the text and see the wavy underline; try the examples. Guide: `/guides/diagram-dsl`.
6. **Mermaid**: paste a flowchart, Insert; then the Export tab on a selection.
7. **Share**: Tools → Share via link; open the link in a private window (read-only + Save a copy); switch to "Editable copy".
8. **Slides**: draw frames (F), Tools → Slides and notes, add notes, Present: arrows/space/PageUp/PageDown, L laser, N notes, Esc exits.
9. **Comments**: select a shape, Tools → Comments, add; pin appears; Resolve hides it.
10. **Styles**: Tools → Style presets → Blueprint on a selection; save your own from a styled shape; click brand colours (Shift = fill).

## 7. Content and SEO

1. `/templates`: 47 cards in 7 categories; thumbnails load as you scroll; category chips jump to sections.
2. Open a template page, press **Open in ArchBoard**: a new scene appears with arrows attached; your other scenes are untouched.
3. Read two templates and two guides end to end: do the explanations match the picture?
4. `/guides`, `/vs`, `/components` and a `/components/<id>` page: links work, tables read well.
5. Paste a page URL into a link previewer (after deploying) to see the social card.
6. `pnpm build && pnpm seo:validate` and `pnpm lhci` should both pass.
