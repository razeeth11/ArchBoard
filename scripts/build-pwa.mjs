// Post-build: writes out/sw.js (precache manifest), the CSP headers file and a report.
//   node scripts/build-pwa.mjs         (runs automatically via the "postbuild" script)
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(OUT);
const url = (f) => "/" + relative(OUT, f).split("\\").join("/");

// ── service worker ─────────────────────────────────────────────────────────────────────────────
// Everything under /_next/static (hashed, immutable) plus the editor font files the engine loads.
const assets = files
  .map(url)
  .filter((u) => u.startsWith("/_next/static/") && /\.(js|css|woff2?)$/.test(u))
  .sort();
const pages = ["/", "/app", "/templates", "/guides", "/icon.svg", "/manifest.webmanifest"];
const version = createHash("sha256")
  .update(JSON.stringify([assets, pages]))
  .digest("hex")
  .slice(0, 12);
const tpl = readFileSync("scripts/sw.template.js", "utf8")
  .replace("__VERSION__", version)
  .replace("__ASSETS__", JSON.stringify(assets))
  .replace("__PAGES__", JSON.stringify(pages));
writeFileSync(join(OUT, "sw.js"), tpl);

// ── CSP ──────────────────────────────────────────────────────────────────────────────────────────
// Static export cannot use per-request nonces, so every inline *executable* script is allowed by hash.
const hashes = new Set();
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/(ld\+)?json"/.test(m[1])) continue; // data blocks are not executed
    hashes.add(`'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`);
  }
}
const csp = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' ${[...hashes].sort().join(" ")}`,
  // Excalidraw and Radix set inline style attributes at runtime; there is no nonce-free alternative.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Both hosts are contacted only after an explicit opt-in: online icon search (iconify) and the
  // bring-your-own-key AI dialog (anthropic).
  "connect-src 'self' https://api.iconify.design https://api.anthropic.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const security = [
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy: same-origin",
];
// The page policy is attached to HTML routes only. A catch-all `/*` rule would also apply to the font
// decoder worker, and hosts combine matching policies (the stricter one wins), which would block it.
const htmlRoutes = [
  ...new Set(
    files
      .filter((f) => f.endsWith(".html") && !/(^|\/)(404|_not-found)\.html$/.test(f))
      .map(
        (f) =>
          url(f)
            .replace(/\.html$/, "")
            .replace(/\/index$/, "") || "/",
      )
      .map((r) => r.split("/").slice(0, 2).join("/") || "/"),
  ),
]
  .map((r) => (["/templates", "/guides", "/vs", "/components"].includes(r) ? [r, `${r}/*`] : [r]))
  .flat();
const pageCsp = htmlRoutes.map((r) => `${r}\n  Content-Security-Policy: ${csp}`).join("\n");
const existing = existsSync(join(OUT, "_headers"))
  ? readFileSync(join(OUT, "_headers"), "utf8")
  : "";
// The font decoder worker needs eval (emscripten embind). Its own, narrower policy applies to it only;
// the page policy stays free of unsafe-eval.
const workerCsp =
  "default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'";
const headers = `${pageCsp}\n/excalidraw-assets/woff2-worker.js\n  Content-Security-Policy: ${workerCsp}\n/*\n${security.map((h) => `  ${h}`).join("\n")}\n/sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: /\n/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n${existing}`;
writeFileSync(join(OUT, "_headers"), headers);
writeFileSync(join(OUT, "csp.txt"), csp + "\n");
console.log(
  `pwa: ${assets.length} precached assets (v${version}); csp: ${hashes.size} inline script hashes`,
);
