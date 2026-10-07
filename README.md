# ArchBoard

Free, private, offline-first whiteboard for system design and architecture diagrams, built on [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT). No accounts; data stays in your browser.

## Run

```
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # static export to ./out
pnpm typecheck && pnpm lint && pnpm test
CHROMIUM_PATH=/path/to/chromium pnpm test:e2e   # CHROMIUM_PATH optional
```

Deploy `out/` to any static host (Vercel, Netlify, Cloudflare Pages). No environment variables required.

Status: Phase 7 of 8 (content and SEO). See `docs/KNOWN_GAPS.md`.
