import { create } from 'zustand';
import { api } from '@/lib/api';
import { closeSocket } from '@/lib/socket';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  admin: { email: string; name: string } | null;
  ready: boolean;
  adminReady: boolean;
  setUser: (u: User | null) => void;
  patchUser: (p: Partial<User>) => void;
  loadUser: () => Promise<void>;
  loadAdmin: () => Promise<void>;
  setAdmin: (a: AuthState['admin']) => void;
  logout: () => Promise<void>;
  adminLogout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null, admin: null, ready: false, adminReady: false,
  setUser: (user) => set({ user }),
  patchUser: (p) => set((s) => (s.user ? { user: { ...s.user, ...p } } : s)),
  setAdmin: (admin) => set({ admin }),
  loadUser: async () => {
    try { const { data } = await api.get('/auth/me'); set({ user: data.user, ready: true }); }
    catch { set({ user: null, ready: true }); }
  },
  loadAdmin: async () => {
    try { const { data } = await api.get('/admin/auth/me'); set({ admin: data.admin, adminReady: true }); }
    catch { set({ admin: null, adminReady: true }); }
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    closeSocket('user'); set({ user: null });
  },
  adminLogout: async () => {
    try { await api.post('/admin/auth/logout'); } catch { /* ignore */ }
    closeSocket('admin'); set({ admin: null });
  },
}));
