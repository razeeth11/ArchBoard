import { SMART_DEFS } from "./defs";
import { parseTemplateDef, templateToSmartDef, type TemplateDef } from "./template";
import type { SmartDef, SmartMeta } from "./types";

export function builtinDef(id: string): SmartDef | undefined {
  return SMART_DEFS.find((d) => d.id === id);
}

/**
 * Find the definition for an instance: built-ins first, then the user's installed definitions,
 * then the definition embedded in the scene (so shared files stay regenerable on other machines).
 */
export function resolveDef(meta: SmartMeta, custom: Record<string, TemplateDef>): SmartDef | null {
  const builtin = builtinDef(meta.id);
  if (builtin) return builtin;
  const installed = custom[meta.id];
  const embedded = meta.def ? parseTemplateDef(meta.def) : null;
  const best = installed ?? (embedded?.ok ? embedded.def : null);
  // Prefer whichever is newer, so a shared file can carry a newer version of the definition.
  if (installed && embedded?.ok && embedded.def.version > installed.version)
    return templateToSmartDef(embedded.def);
  return best ? templateToSmartDef(best) : null;
}
