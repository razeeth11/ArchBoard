import { create } from "zustand";
import { getSetting, setSetting } from "@/persistence/repo";
import type { SvgMode } from "@/library/svgImport";

interface UiState {
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  componentsOpen: boolean;
  setComponentsOpen: (v: boolean) => void;
  /** Opt-in: queries go to the public Iconify API. Off by default. */
  iconifyOnline: boolean;
  setIconifyOnline: (v: boolean) => void;
  /** Phase 6 dialogs (one at a time). */
  dialog: null | "history" | "slides" | "mermaid" | "dsl" | "share" | "styles";
  setDialog: (d: UiState["dialog"]) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  commentsOpen: boolean;
  setCommentsOpen: (v: boolean) => void;
  /** Which smart-component authoring dialog is open. `json` with an id edits that definition. */
  smartDialog: null | { mode: "create" } | { mode: "json"; id?: string };
  setSmartDialog: (d: UiState["smartDialog"]) => void;
  svgMode: SvgMode;
  setSvgMode: (m: SvgMode) => void;
  hydrate: () => Promise<void>;
}

export const useUi = create<UiState>((set) => ({
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  componentsOpen: false,
  setComponentsOpen: (componentsOpen) => {
    set({ componentsOpen });
    void setSetting("componentsOpen", componentsOpen);
  },
  iconifyOnline: false,
  setIconifyOnline: (iconifyOnline) => {
    set({ iconifyOnline });
    void setSetting("iconifyOnline", iconifyOnline);
  },
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  commentsOpen: false,
  setCommentsOpen: (commentsOpen) => set({ commentsOpen }),
  smartDialog: null,
  setSmartDialog: (smartDialog) => set({ smartDialog }),
  svgMode: "image",
  setSvgMode: (svgMode) => {
    set({ svgMode });
    void setSetting("svgMode", svgMode);
  },
  hydrate: async () => {
    const [componentsOpen, iconifyOnline, svgMode] = await Promise.all([
      getSetting("componentsOpen", false),
      getSetting("iconifyOnline", false),
      getSetting<SvgMode>("svgMode", "image"),
    ]);
    set({
      componentsOpen: componentsOpen === true,
      iconifyOnline: iconifyOnline === true,
      svgMode: svgMode === "shapes" ? "shapes" : "image",
    });
  },
}));
