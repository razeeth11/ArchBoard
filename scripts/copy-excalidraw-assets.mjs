// Self-host Excalidraw fonts/locales so the editor works offline and under a strict CSP.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const pkgDir = join(process.cwd(), "node_modules", "@excalidraw", "excalidraw");
const dest = join(process.cwd(), "public", "excalidraw-assets");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(pkgDir, "dist", "prod", "fonts"), join(dest, "fonts"), { recursive: true });
// The subsetting worker is loaded as an ES module from our own origin (see patches/), together
// with the sibling chunks it imports.
import { readdirSync } from "node:fs";
for (const f of readdirSync(join(pkgDir, "dist", "prod"))) {
  if (f.endsWith(".js") && (f.startsWith("chunk-") || f.startsWith("subset-"))) {
    cpSync(join(pkgDir, "dist", "prod", f), join(dest, f));
  }
}
// WOFF2 → TTF decoder (wasm embedded) used for vector PDF text and "text as outlines" SVG export.
cpSync(
  join(process.cwd(), "node_modules", "wawoff2", "build", "decompress_binding.js"),
  join(dest, "woff2-decompress.js"),
);
console.log("excalidraw assets copied to", dest);
