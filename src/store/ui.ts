import { create } from "zustand";

interface UiState {
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
}));
