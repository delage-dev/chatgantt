import { useCallback, useRef, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useGanttStore } from '../store/ganttStore';
import { batchUpdateTasks } from '../utils/api';
import { addPendingIds, removePendingIds } from './useOptimisticUpdate';

export function useReorder() {
  const [isDragging, setIsDragging] = useState(false);
  const dragParentId = useRef<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
    const tasks = useGanttStore.getState().tasks;
    const task = tasks.find((t) => t.id === event.active.id);
    dragParentId.current = task?.parent_id ?? null;
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const tasks = useGanttStore.getState().tasks;
    const activeTask = tasks.find((t) => t.id === active.id);
    let overTask = tasks.find((t) => t.id === over.id);

    if (!activeTask || !overTask) return;

    const parentId = activeTask.parent_id;

    // If over item isn't a direct sibling, walk up its ancestors to find one.
    // This handles dragging over children of an expanded sibling.
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    while (overTask && overTask.parent_id !== parentId) {
      overTask = overTask.parent_id ? taskMap.get(overTask.parent_id) : undefined;
    }
    if (!overTask || overTask.id === active.id) return;

    // Get siblings sorted by current sort_order
    const siblings = tasks
      .filter((t) => t.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const oldIndex = siblings.findIndex((t) => t.id === active.id);
    const newIndex = siblings.findIndex((t) => t.id === overTask.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Reorder: remove from old position, insert at new
    const reordered = [...siblings];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Compute which siblings actually changed sort_order
    const updates: { id: string; oldOrder: number; newOrder: number }[] = [];
    for (let i = 0; i < reordered.length; i++) {
      const current = reordered[i].sort_order ?? 0;
      if (current !== i) {
        updates.push({ id: reordered[i].id, oldOrder: current, newOrder: i });
      }
    }

    if (updates.length === 0) return;

    // Optimistic update
    const affectedIds = updates.map((u) => u.id);
    addPendingIds(affectedIds);
    for (const u of updates) {
      useGanttStore.getState().updateTaskOptimistic(u.id, { sort_order: u.newOrder });
    }

    // Persist via batch API
    const batchItems = updates.map((u) => ({
      ticket_id: u.id,
      updates: { sort_order: u.newOrder },
    }));

    batchUpdateTasks(batchItems)
      .catch(() => {
        // Rollback on failure
        for (const u of updates) {
          useGanttStore.getState().updateTaskOptimistic(u.id, { sort_order: u.oldOrder });
        }
      })
      .finally(() => {
        removePendingIds(affectedIds);
      });
  }, []);

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    dragParentId.current = null;
  }, []);

  return { isDragging, handleDragStart, handleDragEnd, handleDragCancel };
}
