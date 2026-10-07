# Known gaps

Status: Phase 2 of 8 complete (foundation + persistence). Not yet built: export suite, component library, Smart Components,
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
