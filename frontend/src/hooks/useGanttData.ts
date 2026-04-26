import { useEffect } from 'react';
import { useGanttStore } from '../store/ganttStore';
import { fetchTasks } from '../utils/api';

export function useGanttData(project?: string) {
  const setTasks = useGanttStore((s) => s.setTasks);
  const setLoading = useGanttStore((s) => s.setLoading);
  const setError = useGanttStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const tree = await fetchTasks(project);
        if (!cancelled) {
          setTasks(tree.tickets);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tasks');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [project, setTasks, setLoading, setError]);
}
