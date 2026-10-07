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
