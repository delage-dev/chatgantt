import { useEffect, useMemo, useCallback } from 'react';
import { useBlockerStore } from '../store/blockerStore';
import {
  fetchBlockers,
  createBlocker as apiCreateBlocker,
  resolveBlocker as apiResolveBlocker,
  deleteBlocker as apiDeleteBlocker,
} from '../utils/api';
import type { Blocker, BlockerCreate } from '../types/blockers';

const POLL_INTERVAL_MS = 30_000;

// Module-level guard so polling only starts once even if hook mounts in multiple places
let pollingStarted = false;

export function useBlockers(autoStart: boolean = false) {
  const blockers = useBlockerStore((s) => s.blockers);
  const loading = useBlockerStore((s) => s.loading);
  const error = useBlockerStore((s) => s.error);
  const setBlockers = useBlockerStore((s) => s.setBlockers);
  const addBlocker = useBlockerStore((s) => s.addBlocker);
  const updateBlocker = useBlockerStore((s) => s.updateBlocker);
  const removeBlocker = useBlockerStore((s) => s.removeBlocker);
  const setLoading = useBlockerStore((s) => s.setLoading);
  const setError = useBlockerStore((s) => s.setError);

  useEffect(() => {
    if (!autoStart || pollingStarted) return;
    pollingStarted = true;

    const refresh = async () => {
      try {
        const data = await fetchBlockers();
        setBlockers(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch blockers');
      }
    };

    setLoading(true);
    refresh().finally(() => setLoading(false));

    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoStart, setBlockers, setError, setLoading]);

  const activeBlockers = useMemo(
    () => blockers.filter((b) => b.status === 'active'),
    [blockers]
  );
  const activeCount = activeBlockers.length;

  const blockersByTaskId = useMemo(() => {
    const map = new Map<string, { blockedSide: Blocker[]; blockingSide: Blocker[] }>();
    for (const b of blockers) {
      if (!map.has(b.blocked_task_id)) {
        map.set(b.blocked_task_id, { blockedSide: [], blockingSide: [] });
      }
      map.get(b.blocked_task_id)!.blockedSide.push(b);
      if (b.blocking_task_id) {
        if (!map.has(b.blocking_task_id)) {
          map.set(b.blocking_task_id, { blockedSide: [], blockingSide: [] });
        }
        map.get(b.blocking_task_id)!.blockingSide.push(b);
      }
    }
    return map;
  }, [blockers]);

  const createBlocker = useCallback(
    async (payload: BlockerCreate) => {
      // Optimistic temp entry
      const tempId = `temp-${Date.now()}`;
      const temp: Blocker = {
        id: tempId,
        blocked_task_id: payload.blocked_task_id,
        blocking_task_id: payload.blocking_task_id ?? null,
        external_blocker: payload.external_blocker ?? null,
        reason: payload.reason,
        severity: payload.severity ?? 'medium',
        status: 'active',
        created_by: 'me',
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
        auto_resolved: false,
      };
      addBlocker(temp);
      try {
        const created = await apiCreateBlocker(payload);
        // Replace temp with real
        removeBlocker(tempId);
        addBlocker(created);
        return created;
      } catch (e) {
        removeBlocker(tempId);
        setError(e instanceof Error ? e.message : 'Failed to create blocker');
        throw e;
      }
    },
    [addBlocker, removeBlocker, setError]
  );

  const resolveBlocker = useCallback(
    async (id: string) => {
      const original = blockers.find((b) => b.id === id);
      const nowIso = new Date().toISOString();
      updateBlocker(id, { status: 'resolved', resolved_at: nowIso, resolved_by: 'me' });
      try {
        const updated = await apiResolveBlocker(id);
        updateBlocker(id, updated);
        return updated;
      } catch (e) {
        if (original) {
          updateBlocker(id, original);
        }
        setError(e instanceof Error ? e.message : 'Failed to resolve blocker');
        throw e;
      }
    },
    [blockers, updateBlocker, setError]
  );

  const deleteBlocker = useCallback(
    async (id: string) => {
      const original = blockers.find((b) => b.id === id);
      removeBlocker(id);
      try {
        await apiDeleteBlocker(id);
      } catch (e) {
        if (original) addBlocker(original);
        setError(e instanceof Error ? e.message : 'Failed to delete blocker');
        throw e;
      }
    },
    [blockers, removeBlocker, addBlocker, setError]
  );

  return {
    blockers,
    activeBlockers,
    activeCount,
    blockersByTaskId,
    createBlocker,
    resolveBlocker,
    deleteBlocker,
    loading,
    error,
  };
}
