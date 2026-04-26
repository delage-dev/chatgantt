import { useEffect } from 'react';
import { useGanttStore } from '../store/ganttStore';
import { fetchTasks } from '../utils/api';
import { getPendingIds } from './useOptimisticUpdate';

const POLL_INTERVAL_MS = 30_000;

export function usePolling(project?: string) {
  const mergeExternalTasks = useGanttStore((s) => s.mergeExternalTasks);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const tree = await fetchTasks(project);
        mergeExternalTasks(tree.tickets, getPendingIds());
      } catch {
        // Silent fail on polling — don't disrupt the UI
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [project, mergeExternalTasks]);
}
