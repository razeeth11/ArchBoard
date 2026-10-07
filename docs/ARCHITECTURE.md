# Architecture

See the approved plan for the full design. Layers under `src/`: `engine` (Excalidraw wrapper), `store` (Zustand), `persistence` (Dexie), `export`, `smart`, `library`, `dsl`, `share`, `content`, `pwa`, `ui`.
Routes live in `app/` and are statically generated; `/app` renders a server intro + `<noscript>` and lazily loads the client-only editor.

## Persistence (Phase 2)

- `src/persistence/db.ts` Dexie schema v1: scenes, pages, snapshots, folders, libraries, settings, blobs, comments, recovery.
- `repo.ts` is the only writer. `savePage` commits page + new blobs + scene timestamp in one transaction and fails with `ConflictError` if the stored `rev` differs from the session's.
- `session.ts` (`PageSession`) turns live Excalidraw state into a save: drops deleted elements, hashes images once per session (SHA-256), picks the persisted AppState subset, ignores the first onChange (baseline) so merely opening a scene never writes.
- `autosave.ts` debounces (500 ms), serializes saves, pauses on conflict. `SceneCanvas.tsx` flushes on `visibilitychange`, `pagehide`, `beforeunload`, and unmount.
- `channel.ts` BroadcastChannel notifies other tabs; `store/workspace.ts` drives the sidebar, scene switching, trash (30 days), recovery and conflict dialogs.
- `backup.ts` full JSON backup/import and `.excalidraw`-compatible per-scene import/export.

## Export (Phase 3)

- `src/export/options.ts` is pure and unit-tested: option schema + `sanitizeOptions`, element selection (`pickElements`: scene / selection incl. bound text and frame contents / frame), raster limits, PDF page layout, file names, SVG title/desc.
- `render.ts` (lazy) builds PNG (`exportToBlob` with `getDimensions` for 1–4×), SVG (`exportToSvg` + accessibility + optional outlines), JSON (`serializeAsJSON`), PDF (`pdf.ts`), previews and clipboard copies. Every stage calls `step()` (`abort.ts`) for progress, UI yielding and cancellation.
- `fonts.ts` extracts Excalidraw's embedded woff2 subsets, decodes them (wawoff2) and parses them (opentype.js) to (a) outline text and (b) bind PDF text runs to registered jsPDF fonts.
- `pdf.ts` loads jsPDF + svg2pdf only on demand, one SVG per page.
- `ui/export/ExportDialog.tsx`: live preview, remembered settings, progress + cancel. Opened by the toolbar button or Ctrl/Cmd+Shift+E.
- Import additionally accepts PNG/SVG with embedded scenes and `.excalidrawlib` files.
