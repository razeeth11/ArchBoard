// Validates the static export in out/: titles, descriptions, canonicals, headings, JSON-LD,
// internal links, images and sitemap coverage. Run after `pnpm build`:  pnpm seo:validate
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const SITE = "https://archboard.space";
const CREATOR_NAME = "codebyrazeeth";
const CREATOR_ID = `${SITE}/#creator`;
// The editor shell is not a content page and has no site footer.
const NO_FOOTER = new Set(["/app"]);
const problems = [];
const fail = (page, msg) => problems.push(`${page}: ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(OUT);
const pages = files.filter((f) => f.endsWith(".html") && !/(^|\/)(404|_not-found)\.html$/.test(f));
const routeOf = (f) => {
  const r =
    "/" +
    relative(OUT, f)
      .replace(/\.html$/, "")
      .replace(/\/index$/, "");
  return r === "/index" ? "/" : r;
};
const attr = (tag, name) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const titles = new Map();
const descs = new Map();
const known = new Set(files.map((f) => "/" + relative(OUT, f)));
const routeExists = (href) => {
  const p = decodeURI(href.split("#")[0].split("?")[0]).replace(/\/$/, "") || "/";
  return p === "/" || known.has(p) || known.has(p + ".html") || known.has(p + "/index.html");
};

for (const f of pages) {
  const route = routeOf(f);
  const html = readFileSync(f, "utf8");
  const titleM = [...html.matchAll(/<title>([^<]*)<\/title>/g)];
  if (titleM.length !== 1) fail(route, `expected one <title>, found ${titleM.length}`);
  const title = decode(titleM[0]?.[1] ?? "");
  if (title.length < 20 || title.length > 62)
    fail(route, `title length ${title.length}: "${title}"`);
  if ((title.match(/ArchBoard/g) ?? []).length > 1 && !title.startsWith("ArchBoard"))
    if (/\| ArchBoard \| ArchBoard/.test(title)) fail(route, "brand suffix duplicated in title");
  (titles.get(title) ?? titles.set(title, []).get(title)).push(route);

  const metas = [...html.matchAll(/<meta [^>]*>/g)].map((m) => m[0]);
  const meta = (key, val) => metas.find((m) => attr(m, key) === val);
  const desc = decode(attr(meta("name", "description") ?? "", "content") ?? "");
  if (desc.length < 100 || desc.length > 160) fail(route, `description length ${desc.length}`);
  (descs.get(desc) ?? descs.set(desc, []).get(desc)).push(route);
  for (const p of ["og:title", "og:description", "og:image", "og:url"])
    if (!meta("property", p)) fail(route, `missing ${p}`);
  if (!meta("name", "twitter:card")) fail(route, "missing twitter:card");

  const canon = [...html.matchAll(/<link [^>]*rel="canonical"[^>]*>/g)].map((m) =>
    attr(m[0], "href"),
  );
  if (canon.length !== 1) fail(route, `expected one canonical, found ${canon.length}`);
  else if (
    canon[0] !== `${SITE}${route === "/" ? "" : route}` &&
    canon[0] !== `${SITE}${route === "/" ? "/" : route}`
  )
    fail(route, `canonical ${canon[0]} does not match route`);
  if (!/<html[^>]*lang="en"/.test(html)) fail(route, "missing html lang");

  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(route, `expected one <h1>, found ${h1}`);

  if (
    !NO_FOOTER.has(route) &&
    !/<a [^>]*data-testid="creator-credit"[^>]*>\s*Built by codebyrazeeth\s*<\/a>/.test(html)
  )
    fail(route, 'missing "Built by codebyrazeeth" credit');
  let hasPerson = false;

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      fail(route, "invalid JSON-LD");
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      if (node["@context"] !== "https://schema.org" || !node["@type"])
        fail(route, "JSON-LD missing @context/@type");
      if (JSON.stringify(node).includes("undefined")) fail(route, "JSON-LD contains undefined");
      if (node["@type"] === "BreadcrumbList")
        node.itemListElement.forEach((it, i) => {
          if (it.position !== i + 1 || !it.name || !/^https:\/\//.test(it.item))
            fail(route, "bad breadcrumb item");
        });
      if (node["@type"] === "Person") {
        hasPerson = true;
        if (node.name !== CREATOR_NAME) fail(route, `Person name is "${node.name}"`);
        if (node["@id"] !== CREATOR_ID) fail(route, `Person @id is "${node["@id"]}"`);
        for (const u of node.sameAs ?? [])
          if (!/^https:\/\//.test(u)) fail(route, `Person sameAs is not https: ${u}`);
      }
      if (["Article", "TechArticle"].includes(node["@type"])) {
        for (const k of ["headline", "dateModified", "author", "publisher"])
          if (!node[k]) fail(route, `Article missing ${k}`);
        if (node.author?.["@id"] !== CREATOR_ID)
          fail(route, "Article author does not reference the creator @id");
      }
      if (node["@type"] === "WebApplication")
        for (const k of ["name", "applicationCategory", "offers"])
          if (!node[k]) fail(route, `WebApplication missing ${k}`);
      if (node["@type"] === "WebApplication")
        for (const k of ["author", "creator"])
          if (node[k]?.["@id"] !== CREATOR_ID)
            fail(route, `WebApplication ${k} does not reference the creator @id`);
    }
  }

  if ((route === "/" || route === "/about") && !hasPerson)
    fail(route, "missing Person (creator) JSON-LD node");

  for (const m of html.matchAll(/<img [^>]*>/g)) {
    if (attr(m[0], "alt") === undefined) fail(route, "<img> without alt");
    if (!attr(m[0], "width") || !attr(m[0], "height")) fail(route, "<img> without width/height");
    const src = attr(m[0], "src");
    if (src?.startsWith("/") && !routeExists(src)) fail(route, `missing image ${src}`);
  }
  for (const m of html.matchAll(/<a [^>]*href="(\/[^"#]*)[^"]*"/g)) {
    const href = decode(m[1]);
    if (href.startsWith("//") || href === "/app") continue;
    if (!routeExists(href)) fail(route, `broken link ${href}`);
  }
}
for (const [t, rs] of titles) if (rs.length > 1) fail(rs.join(", "), `duplicate title "${t}"`);
for (const [d, rs] of descs)
  if (rs.length > 1) fail(rs.join(", "), `duplicate description "${d.slice(0, 50)}…"`);

// Sitemap <-> pages.
const sitemap = readFileSync(join(OUT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const routes = new Set(pages.map(routeOf));
for (const r of routes)
  if (!locs.includes(`${SITE}${r === "/" ? "" : r}`) && !locs.includes(`${SITE}${r}`))
    fail(r, "not in sitemap.xml");
for (const l of locs) {
  const r = l.replace(SITE, "") || "/";
  if (!routes.has(r)) fail(l, "sitemap URL has no page");
}
if (
  !/Sitemap: https:\/\/archboard\.space\/sitemap\.xml/.test(
    readFileSync(join(OUT, "robots.txt"), "utf8"),
  )
)
  fail("robots.txt", "does not reference the sitemap");
if (!existsSync(join(OUT, "opengraph-image"))) {
  if (!files.some((f) => /opengraph-image/.test(f))) fail("site", "no opengraph image generated");
}

if (problems.length) {
  console.error(
    `SEO validation failed (${problems.length}):\n- ${problems.slice(0, 80).join("\n- ")}`,
  );
  process.exit(1);
}
console.log(`SEO validation passed: ${pages.length} pages, ${locs.length} sitemap URLs.`);
