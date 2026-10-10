import { create } from "zustand";
import { getSetting, setSetting } from "@/persistence/repo";
import { hydrateKeepTool } from "@/engine/toolLock";
import { setInsertStyle } from "@/library/builder";
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
  dialog: null | "history" | "slides" | "mermaid" | "dsl" | "share" | "styles" | "ai";
  setDialog: (d: UiState["dialog"]) => void;
  /** Figma-style numeric panel for the selection (large screens). */
  designOpen: boolean;
  setDesignOpen: (v: boolean) => void;
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
  designOpen: true,
  setDesignOpen: (designOpen) => {
    set({ designOpen });
    void setSetting("designOpen", designOpen);
  },
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
    await hydrateKeepTool();
    const [componentsOpen, iconifyOnline, svgMode, insertStyle, designOpen] = await Promise.all([
      getSetting("componentsOpen", false),
      getSetting("iconifyOnline", false),
      getSetting<SvgMode>("svgMode", "image"),
      getSetting<unknown>("insertStyle", null),
      getSetting("designOpen", true),
    ]);
    if (insertStyle && typeof insertStyle === "object") setInsertStyle(insertStyle as never);
    set({
      designOpen: designOpen !== false,
      componentsOpen: componentsOpen === true,
      iconifyOnline: iconifyOnline === true,
      svgMode: svgMode === "shapes" ? "shapes" : "image",
    });
  },
}));
