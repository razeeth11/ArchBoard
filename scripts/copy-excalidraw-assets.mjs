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
import { readdirSync, writeFileSync } from "node:fs";
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
// The decoder runs in this worker so its eval-using glue is confined to a script with its own CSP.
writeFileSync(
  join(dest, "woff2-worker.js"),
  `var ready = false;
var queue = [];
var Module = {
  onRuntimeInitialized: function () {
    ready = true;
    postMessage({ ready: true });
    queue.splice(0).forEach(archboardDecode);
  },
};
importScripts("woff2-decompress.js");
// Not named run: the emscripten glue defines its own global with that name.
function archboardDecode(m) {
  try {
    var out = Module.decompress(m.woff2);
    if (!out) throw new Error("Invalid WOFF2 font");
    var ttf = new Uint8Array(out);
    postMessage({ id: m.id, ttf: ttf }, [ttf.buffer]);
  } catch (e) {
    postMessage({ id: m.id, error: String(e && e.message || e) });
  }
}
onmessage = function (e) { ready ? archboardDecode(e.data) : queue.push(e.data); };
`,
);
// ELK layout engine worker (auto-layout, DSL and Mermaid import run layout off the main thread).
cpSync(
  join(process.cwd(), "node_modules", "elkjs", "lib", "elk-worker.min.js"),
  join(dest, "elk-worker.min.js"),
);
console.log("excalidraw assets copied to", dest);
