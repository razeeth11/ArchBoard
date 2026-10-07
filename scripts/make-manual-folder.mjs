// Assembles ./manual-test: the production static build plus a zero-dependency server and a checklist,
// so the app can be tried by hand with just Node (`node serve.mjs`) and no pnpm install.
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "manual-test");
if (!existsSync(join(root, "out", "index.html")))
  throw new Error("Run `pnpm build` first (no out/ folder)");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "out"), join(out, "site"), { recursive: true });
cpSync(join(root, "scripts", "manual-serve.mjs"), join(out, "serve.mjs"));
cpSync(join(root, "docs", "MANUAL_TESTING.md"), join(out, "README.md"));
console.log("manual-test/ ready");
