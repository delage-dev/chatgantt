import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useGanttStore } from '../store/ganttStore';
import { useBlockerStore } from '../store/blockerStore';
import { updateTask } from '../utils/api';
import type { GanttTask, TicketUpdate } from '../types/gantt';

const DEBOUNCE_MS = 1000;

/** Set of task IDs with pending writes (not yet confirmed by server) */
const pendingIds = new Set<string>();

export function getPendingIds(): Set<string> {
  return new Set(pendingIds);
}

export function addPendingIds(ids: string[]) {
  for (const id of ids) pendingIds.add(id);
}

export function removePendingIds(ids: string[]) {
  for (const id of ids) pendingIds.delete(id);
}

export function useOptimisticUpdate() {
  const snapshots = useRef<Map<string, GanttTask>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const store = useGanttStore;

  const beginDrag = useCallback((taskId: string) => {
    const task = store.getState().getTask(taskId);
    if (task) {
      snapshots.current.set(taskId, { ...task });
    }
  }, []);

  const applyUpdate = useCallback((taskId: string, updates: Partial<GanttTask>) => {
    // Optimistic: update store immediately
    store.getState().updateTaskOptimistic(taskId, updates);
    pendingIds.add(taskId);

    // Clear existing timer for this task
    const existing = timers.current.get(taskId);
    if (existing) clearTimeout(existing);

    // Debounce the actual API call
    const timer = setTimeout(async () => {
      const ticketUpdate: TicketUpdate = {};
      if (updates.start_date) ticketUpdate.start_date = updates.start_date;
      if (updates.end_date) ticketUpdate.end_date = updates.end_date;
      if (updates.parent_id !== undefined) ticketUpdate.parent_id = updates.parent_id ?? undefined;
      if (updates.description !== undefined) ticketUpdate.description = updates.description ?? undefined;
      if ((updates as any).qa_start_date) ticketUpdate.qa_start_date = (updates as any).qa_start_date;
      if ((updates as any).qa_end_date) ticketUpdate.qa_end_date = (updates as any).qa_end_date;
      if ((updates as any).dependencies !== undefined) ticketUpdate.dependencies = (updates as any).dependencies;
      if ((updates as any).sort_order !== undefined) ticketUpdate.sort_order = (updates as any).sort_order;
      if ((updates as any).provider_meta !== undefined) ticketUpdate.provider_meta = (updates as any).provider_meta;
      if ((updates as any).clear_qa) ticketUpdate.clear_qa = true;

      try {
        const response = await updateTask(taskId, ticketUpdate);
        snapshots.current.delete(taskId);

        // Handle auto-resolved blockers from this status change
        if (response.auto_resolved_blockers && response.auto_resolved_blockers.length > 0) {
          const blockerStore = useBlockerStore.getState();
          const allBlockers = blockerStore.blockers;
          const nowIso = new Date().toISOString();
          for (const id of response.auto_resolved_blockers) {
            const b = allBlockers.find((x) => x.id === id);
            blockerStore.updateBlocker(id, {
              status: 'resolved',
              auto_resolved: true,
              resolved_at: nowIso,
              resolved_by: 'system',
            });
            const blockedId = b?.blocked_task_id ?? 'task';
            const blockingLabel = b?.blocking_task_id ?? b?.external_blocker ?? taskId;
            toast.info(`Auto-resolved blocker: ${blockedId} was blocked by ${blockingLabel}`);
          }
        }
      } catch (err) {
        // Rollback on failure
        const snapshot = snapshots.current.get(taskId);
        if (snapshot) {
          store.getState().updateTaskOptimistic(taskId, snapshot);
          snapshots.current.delete(taskId);
        }
        console.error(`Failed to update ${taskId}:`, err);
      } finally {
        pendingIds.delete(taskId);
        timers.current.delete(taskId);
      }
    }, DEBOUNCE_MS);

    timers.current.set(taskId, timer);
  }, []);

  return { beginDrag, applyUpdate };
}
