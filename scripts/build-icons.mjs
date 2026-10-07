// Build-time icon pipeline: extracts the curated icons from the @iconify-json/* devDependencies into
// small JSON files under public/icons, copies each set's license text, and writes the license manifest
// used by the /credits page and the unit tests. Run with `pnpm icons:build`; outputs are committed.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ICON_SETS } from "./icons.config.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const outIcons = join(root, "public", "icons");
const outLicenses = join(root, "public", "licenses");
rmSync(outIcons, { recursive: true, force: true });
rmSync(outLicenses, { recursive: true, force: true });
mkdirSync(outIcons, { recursive: true });
mkdirSync(outLicenses, { recursive: true });

/** Licenses we allow to be redistributed with attribution recorded. Anything else fails the build. */
const ALLOWED = new Set(["CC0-1.0", "MIT", "Apache-2.0", "ISC"]);

const index = {};
/**
 * The @iconify-json packages carry no license files, so we write the standard text for each SPDX id,
 * headed with the set, author and upstream link so the notice stays attributable.
 */
function licenseText(info, spdx) {
  const author = info.author?.name ?? "the authors";
  const head = [
    `${info.name} — ${author}`,
    info.author?.url ? `Upstream: ${info.author.url}` : "",
    info.license?.url ? `License source: ${info.license.url}` : "",
    `SPDX: ${spdx}`,
    "Redistributed in ArchBoard as a curated subset of icons; see https://iconify.design for the data packaging.",
    "",
    "",
  ]
    .filter((l, i, a) => l !== "" || i >= a.length - 2)
    .join("\n");
  if (spdx === "MIT") {
    return `${head}MIT License\n\nCopyright (c) ${author}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`;
  }
  if (spdx === "ISC") {
    return `${head}ISC License\n\nCopyright (c) ${author}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n`;
  }
  if (spdx === "Apache-2.0") {
    // Standard, unmodified Apache License 2.0 text (taken from an installed Apache-2.0 package).
    return `${head}${readFileSync(join(root, "node_modules", "dexie", "LICENSE"), "utf8")}`;
  }
  if (spdx === "CC0-1.0") {
    return `${head}CC0 1.0 Universal (Public Domain Dedication)\n\nTo the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this work to the public domain worldwide. This work is distributed without any warranty.\n\nYou should have received a copy of the CC0 legal code along with this work. If not, see https://creativecommons.org/publicdomain/zero/1.0/legalcode\n\nNote: CC0 covers the artwork's copyright only. Logos and brand marks remain trademarks of their owners.\n`;
  }
  throw new Error(`No license text template for ${spdx}`);
}

const manifest = { generatedBy: "scripts/build-icons.mjs", sets: [] };
let total = 0;

for (const cfg of ICON_SETS) {
  const pkgDir = join(root, "node_modules", "@iconify-json", cfg.prefix);
  const data = JSON.parse(readFileSync(join(pkgDir, "icons.json"), "utf8"));
  const info = JSON.parse(readFileSync(join(pkgDir, "info.json"), "utf8"));
  const spdx = info.license?.spdx;
  if (!ALLOWED.has(spdx))
    throw new Error(`${cfg.prefix}: license ${spdx} is not on the redistribution allowlist`);

  const icons = {};
  const missing = [];
  for (const name of cfg.icons) {
    let src = data.icons[name];
    let resolved = name;
    if (!src && data.aliases?.[name]) {
      resolved = data.aliases[name].parent;
      src = data.icons[resolved];
    }
    if (!src) {
      missing.push(name);
      continue;
    }
    const entry = { body: src.body };
    if (src.width && src.width !== data.width) entry.width = src.width;
    if (src.height && src.height !== data.height) entry.height = src.height;
    icons[name] = entry;
  }
  if (missing.length)
    console.warn(`[icons] ${cfg.prefix}: skipped missing icons: ${missing.join(", ")}`);

  const out = { prefix: cfg.prefix, width: data.width ?? 24, height: data.height ?? 24, icons };
  writeFileSync(join(outIcons, `${cfg.prefix}.json`), JSON.stringify(out));
  total += Object.keys(icons).length;
  index[cfg.prefix] = Object.keys(icons).sort();

  const licenseOut = `${cfg.prefix}-LICENSE.txt`;
  writeFileSync(join(outLicenses, licenseOut), licenseText(info, spdx));

  manifest.sets.push({
    prefix: cfg.prefix,
    name: info.name,
    author: info.author?.name ?? "",
    authorUrl: info.author?.url ?? "",
    license: { spdx, title: info.license?.title ?? spdx, url: info.license?.url ?? "" },
    licenseFile: `/licenses/${licenseOut}`,
    version: require(join(pkgDir, "package.json")).version,
    iconCount: Object.keys(icons).length,
    note: cfg.note,
    attribution: `${info.name} by ${info.author?.name ?? "its authors"} (${info.license?.title ?? spdx})`,
  });
}

// Name index so search never has to download whole sets.
writeFileSync(join(outIcons, "index.json"), JSON.stringify(index));
writeFileSync(join(outLicenses, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`[icons] ${manifest.sets.length} sets, ${total} icons`);
