import { useCallback, useRef } from 'react';
import { useResourceStore } from '../store/resourceStore';
import { fetchResources } from '../utils/api';
import { useGanttStore } from '../store/ganttStore';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useResources() {
  const store = useResourceStore;
  const cacheTimestamps = useRef<Map<string, number>>(new Map());

  const fetchProjectResources = useCallback(async () => {
    const urls = store.getState().projectResourceUrls;
    if (urls.length === 0) return;

    store.getState().setLoadingProject(true);
    store.getState().setError(null);
    try {
      const result = await fetchResources({ urls, source_type: 'mock' });
      store.getState().setProjectResources(result.resources);
      const errs = Object.values(result.errors);
      if (errs.length > 0) {
        store.getState().setError(`Failed to fetch ${errs.length} resource(s)`);
      }
    } catch (err) {
      store.getState().setError(err instanceof Error ? err.message : 'Failed to fetch resources');
    } finally {
      store.getState().setLoadingProject(false);
    }
  }, []);

  const fetchTicketResources = useCallback(async (ticketId: string) => {
    // Check cache
    const cacheKey = `ticket:${ticketId}`;
    const lastFetched = cacheTimestamps.current.get(cacheKey);
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return;

    // Get resource URLs from the ticket's provider_meta
    const task = useGanttStore.getState().getTask(ticketId);
    if (!task) return;

    const meta = task.provider_meta as Record<string, unknown> | null;
    const resourceUrls = (meta?.resource_urls ?? []) as string[];
    if (resourceUrls.length === 0) {
      store.getState().setTicketResources(ticketId, []);
      return;
    }

    store.getState().setLoadingTicket(ticketId);
    try {
      const result = await fetchResources({ urls: resourceUrls, source_type: 'mock' });
      store.getState().setTicketResources(ticketId, result.resources);
      cacheTimestamps.current.set(cacheKey, Date.now());
    } catch {
      // Silent fail for ticket resources
    } finally {
      store.getState().setLoadingTicket(null);
    }
  }, []);

  return { fetchProjectResources, fetchTicketResources };
}
