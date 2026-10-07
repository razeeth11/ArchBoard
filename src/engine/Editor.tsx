"use client";

import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { resolveTheme, usePrefs } from "@/store/prefs";

// Fonts and locales are served from our own origin so the editor works offline and under a strict CSP.
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
    "/excalidraw-assets/";
}

export default function Editor() {
  const pref = usePrefs((s) => s.theme);
  return (
    <div className="h-dvh w-full" data-testid="editor-root">
      <Excalidraw theme={resolveTheme(pref)} />
    </div>
  );
}
