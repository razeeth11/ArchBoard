import { expect, test as base } from "@playwright/test";

/** Every page opened in a test must finish without console errors or uncaught exceptions. */
export const test = base.extend<{ _noConsoleErrors: void }>({
  _noConsoleErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      const watch = (p: import("@playwright/test").Page) => {
        p.on("console", (m) => m.type() === "error" && errors.push(`${p.url()} ${m.text()}`));
        p.on("pageerror", (e) => errors.push(`${p.url()} ${String(e)}`));
      };
      context.pages().forEach(watch);
      context.on("page", watch);
      await use();
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
