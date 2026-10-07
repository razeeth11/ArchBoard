# Architecture

See the approved plan for the full design. Layers under `src/`: `engine` (Excalidraw wrapper), `store` (Zustand), `persistence` (Dexie), `export`, `smart`, `library`, `dsl`, `share`, `content`, `pwa`, `ui`.
Routes live in `app/` and are statically generated; `/app` renders a server intro + `<noscript>` and lazily loads the client-only editor.
