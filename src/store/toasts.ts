import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  /** ms; 0 keeps it until dismissed. */
  ttl: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "ttl"> & { ttl?: number }) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    const ttl = t.ttl ?? 6000;
    set({ toasts: [...get().toasts, { ...t, id, ttl }] });
    if (ttl > 0) setTimeout(() => get().dismiss(id), ttl);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
