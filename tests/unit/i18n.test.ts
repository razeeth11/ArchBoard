import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, en, translate } from "@/i18n/messages";

describe("i18n catalogue", () => {
  it("every locale has exactly the English keys, all non-empty", () => {
    for (const [name, msgs] of Object.entries(LOCALES)) {
      expect(Object.keys(msgs).sort(), name).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(msgs))
        expect(v.trim().length, `${name}.${k}`).toBeGreaterThan(0);
    }
  });
  it("falls back to English for an unknown locale", () => {
    expect(translate("toolbar.tools", "xx")).toBe(en["toolbar.tools"]);
    expect(LOCALES[DEFAULT_LOCALE]).toBe(en);
  });
});
