import { create } from 'zustand';
import { startOfDay, addDays } from 'date-fns';
import type { GanttTask } from '../types/gantt';
import { EXTEND_DAYS } from '../utils/dateUtils';

interface GanttState {
  tasks: GanttTask[];
  loading: boolean;
  error: string | null;
  expandedIds: Set<string>;
  selectedTaskId: string | null;

  // Timeline range (Feature 1)
  timelineStart: Date;
  timelineEnd: Date;

  // Project filter (Feature 2)
  activeProject: string | null;

  // Actions
  setTasks: (tasks: GanttTask[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  setSelectedTaskId: (id: string | null) => void;
  extendTimeline: (direction: 'past' | 'future') => void;
  setActiveProject: (project: string | null) => void;

  // Optimistic updates
  updateTaskOptimistic: (taskId: string, updates: Partial<GanttTask>) => void;
  getTask: (taskId: string) => GanttTask | undefined;

  // Merge external updates
  mergeExternalTasks: (tasks: GanttTask[], pendingIds: Set<string>) => void;
}

const now = startOfDay(new Date());

export const useGanttStore = create<GanttState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  expandedIds: new Set<string>(),
  selectedTaskId: null,
  timelineStart: addDays(now, -7),
  timelineEnd: addDays(now, 30),
  activeProject: null,

  setTasks: (tasks) => {
    const epicIds = new Set(
      tasks.filter((t) => t.ticket_type === 'epic').map((t) => t.id)
    );
    set({ tasks, expandedIds: epicIds });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  toggleExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    }),

  expandAll: () =>
    set((state) => ({
      expandedIds: new Set(
        state.tasks
          .filter((t) => t.ticket_type !== 'task' && t.ticket_type !== 'subtask')
          .map((t) => t.id)
      ),
    })),

  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  extendTimeline: (direction) =>
    set((state) => {
      if (direction === 'past') {
        return { timelineStart: addDays(state.timelineStart, -EXTEND_DAYS) };
      }
      return { timelineEnd: addDays(state.timelineEnd, EXTEND_DAYS) };
    }),

  setActiveProject: (project) => set({ activeProject: project }),

  updateTaskOptimistic: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const merged = { ...t, ...updates };
        if (updates.provider_meta && t.provider_meta) {
          merged.provider_meta = { ...t.provider_meta, ...(updates.provider_meta as Record<string, unknown>) };
        }
        return merged;
      }),
    })),

  getTask: (taskId) => get().tasks.find((t) => t.id === taskId),

  mergeExternalTasks: (freshTasks, pendingIds) =>
    set((state) => {
      const freshMap = new Map(freshTasks.map((t) => [t.id, t]));
      const merged = state.tasks.map((existing) => {
        if (pendingIds.has(existing.id)) return existing;
        return freshMap.get(existing.id) || existing;
      });
      for (const t of freshTasks) {
        if (!state.tasks.find((e) => e.id === t.id)) {
          merged.push(t);
        }
      }
      return { tasks: merged };
    }),
}));
