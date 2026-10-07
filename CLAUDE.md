# ArchBoard — project rules

Browser-only, offline-first whiteboard for system design, built on `@excalidraw/excalidraw`.

## Hard constraints

- No auth/accounts/backend/cookies. All data client-side (IndexedDB via Dexie); localStorage only for tiny UI prefs.
- No third-party trackers; no data leaves the browser unless the user exports/shares. Optional network features (BYO-key AI, collab, Iconify search, embeds) must degrade gracefully and never block editing.
- Static export (`output: 'export'`), zero env vars. Every import (SVG, JSON, Mermaid) is untrusted: sanitize/validate.
- TypeScript strict; no `any` without a justified comment; zero ESLint errors; no console errors in e2e.
- Heavy libs (export/PDF, ELK, Mermaid, icon search, DSL, collab) are lazy-loaded. Editor JS before the editor chunk < 120 kB gz.
- Verify package APIs from installed `.d.ts`, not memory. Record reversible decisions in `docs/DECISIONS.md`; honest gaps in `docs/KNOWN_GAPS.md`.

## Workflow

- Phased delivery (see docs/ARCHITECTURE.md). A phase ends only with typecheck, lint, unit and e2e green; conventional commits.
- Commands: `pnpm typecheck | lint | test | build | test:e2e`. In the sandbox run e2e with `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
