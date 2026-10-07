import { create } from "zustand";

export type ThemePref = "system" | "light" | "dark";
const KEY = "archboard:prefs:v1";

interface PrefsState {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}

function load(): ThemePref {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { theme?: ThemePref };
    if (v.theme === "light" || v.theme === "dark" || v.theme === "system") return v.theme;
  } catch {
    /* storage unavailable: fall back to system */
  }
  return "system";
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const usePrefs = create<PrefsState>((set) => ({
  theme: typeof window === "undefined" ? "system" : load(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme }));
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = resolveTheme(theme);
    set({ theme });
  },
}));
