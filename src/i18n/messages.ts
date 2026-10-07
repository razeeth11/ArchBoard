/**
 * Message catalogue scaffold. English is the only shipped locale; adding one means adding a file of
 * the same shape here and listing it in LOCALES (a unit test fails if any key is missing or empty).
 */
export const en = {
  "toolbar.tools": "Tools",
  "toolbar.export": "Export",
  "toolbar.components": "Components",
  "toolbar.scenes": "Scenes",
  "toolbar.addPage": "Add page",
  "palette.placeholder": "Type a command, scene, block…",
  "update.ready": "A new version of ArchBoard is ready.",
  "update.reload": "Reload",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const LOCALES: Record<string, Messages> = { en };
export const DEFAULT_LOCALE = "en";

export function translate(key: MessageKey, locale: string = DEFAULT_LOCALE): string {
  return (LOCALES[locale] ?? en)[key] ?? en[key];
}
export const t = (key: MessageKey) => translate(key);
