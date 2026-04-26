import { create } from 'zustand';
import type { Blocker } from '../types/blockers';

interface DrawerPrefill {
  blocked_task_id?: string;
}

interface BlockerState {
  blockers: Blocker[];
  loading: boolean;
  error: string | null;

  // Drawer coordination
  drawerOpen: boolean;
  drawerPrefill: DrawerPrefill | null;

  setBlockers: (blockers: Blocker[]) => void;
  addBlocker: (b: Blocker) => void;
  updateBlocker: (id: string, updates: Partial<Blocker>) => void;
  removeBlocker: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  openDrawer: (prefill?: DrawerPrefill | null) => void;
  closeDrawer: () => void;
}

export const useBlockerStore = create<BlockerState>((set) => ({
  blockers: [],
  loading: false,
  error: null,
  drawerOpen: false,
  drawerPrefill: null,

  setBlockers: (blockers) => set({ blockers }),
  addBlocker: (b) => set((state) => ({ blockers: [...state.blockers, b] })),
  updateBlocker: (id, updates) =>
    set((state) => ({
      blockers: state.blockers.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),
  removeBlocker: (id) =>
    set((state) => ({ blockers: state.blockers.filter((b) => b.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  openDrawer: (prefill = null) => set({ drawerOpen: true, drawerPrefill: prefill }),
  closeDrawer: () => set({ drawerOpen: false, drawerPrefill: null }),
}));
