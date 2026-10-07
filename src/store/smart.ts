import { create } from "zustand";
import { deleteSmartDef, listSmartDefs, saveSmartDef } from "@/persistence/repo";
import { parseTemplateDef, type TemplateDef } from "@/smart/template";

interface SmartState {
  customDefs: Record<string, TemplateDef>;
  loaded: boolean;
  /** The smart component instance the current selection belongs to. */
  selected: { instance: string; id: string } | null;
  /** Bumped after every regeneration so the inspector re-reads the scene. */
  rev: number;
  load: () => Promise<void>;
  saveDef: (def: TemplateDef) => Promise<void>;
  removeDef: (id: string) => Promise<void>;
  setSelected: (s: { instance: string; id: string } | null) => void;
  bump: () => void;
}

export const useSmart = create<SmartState>((set, get) => ({
  customDefs: {},
  loaded: false,
  selected: null,
  rev: 0,
  async load() {
    const rows = await listSmartDefs().catch(() => []);
    const defs: Record<string, TemplateDef> = {};
    for (const r of rows) {
      const parsed = parseTemplateDef(r.def); // stored data is validated like any import
      if (parsed.ok) defs[parsed.def.id] = parsed.def;
    }
    set({ customDefs: defs, loaded: true });
  },
  async saveDef(def) {
    await saveSmartDef(def.id, def.name, def);
    set({ customDefs: { ...get().customDefs, [def.id]: def } });
  },
  async removeDef(id) {
    await deleteSmartDef(id);
    const { [id]: _removed, ...rest } = get().customDefs;
    void _removed;
    set({ customDefs: rest });
  },
  setSelected(selected) {
    const cur = get().selected;
    if (cur?.instance === selected?.instance && cur?.id === selected?.id) return;
    set({ selected });
  },
  bump: () => set((s) => ({ rev: s.rev + 1 })),
}));
