import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; title: string; body?: string }
interface UiState {
  collapsed: Record<'app' | 'admin', boolean>;
  toggleCollapsed: (area: 'app' | 'admin') => void;
  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}
let n = 0;
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      collapsed: { app: false, admin: false },
      toggleCollapsed: (area) => set((s) => ({ collapsed: { ...s.collapsed, [area]: !s.collapsed[area] } })),
      mobileNav: false,
      setMobileNav: (mobileNav) => set({ mobileNav }),
      toasts: [],
      toast: (t) => {
        const id = ++n;
        set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'error' ? 6500 : 4000);
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
    }),
    { name: 'nexora:ui', partialize: (s) => ({ collapsed: s.collapsed }) },
  ),
);

export const toast = {
  success: (title: string, body?: string) => useUi.getState().toast({ kind: 'success', title, body }),
  error: (title: string, body?: string) => useUi.getState().toast({ kind: 'error', title, body }),
  info: (title: string, body?: string) => useUi.getState().toast({ kind: 'info', title, body }),
};
