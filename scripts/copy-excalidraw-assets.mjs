// Self-host Excalidraw fonts/locales so the editor works offline and under a strict CSP.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const pkgDir = join(process.cwd(), "node_modules", "@excalidraw", "excalidraw");
const dest = join(process.cwd(), "public", "excalidraw-assets");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(pkgDir, "dist", "prod", "fonts"), join(dest, "fonts"), { recursive: true });
console.log("excalidraw assets copied to", dest);
