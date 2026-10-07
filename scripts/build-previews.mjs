// Renders every template to a static, text-outlined SVG in public/previews/ using the real editor
// in headless Chromium. Run after `pnpm build`:  pnpm previews:build   (commits the output).
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const PORT = 3199;
const server = spawn("npx", ["serve", "out", "-l", String(PORT), "--no-clipboard"], {
  stdio: "ignore",
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/app`)).ok) break;
    } catch {}
    await wait(500);
  }
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/app`);
  await page.waitForFunction(() => !!window.__archboardTools, null, { timeout: 30000 });
  const svgs = await page.evaluate(() => window.__archboardTools.templateSvgs());
  await mkdir("public/previews", { recursive: true });
  // Thumbnails do not need sub-pixel precision: one decimal keeps them visually identical and ~60% smaller.
  const slim = (svg) =>
    svg
      .split(/(data:[^"')]+)/)
      .map((part) => (part.startsWith("data:") ? part : part.replace(/(-?\d+\.\d)\d+/g, "$1")))
      .join("");
  for (const { slug, svg } of svgs) await writeFile(`public/previews/${slug}.svg`, slim(svg));
  console.log(`wrote ${svgs.length} previews`);
  await browser.close();
} finally {
  server.kill();
}
