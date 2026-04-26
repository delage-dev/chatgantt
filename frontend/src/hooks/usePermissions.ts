import { useEffect, useState } from 'react';
import { fetchMe } from '../utils/api';
import type { UserContext } from '../types/gantt';

let cached: Promise<UserContext> | null = null;

export function usePermissions() {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cached) cached = fetchMe();
    cached
      .then(setUser)
      .catch(() => setUser({ user_id: 'anonymous', display_name: 'Anonymous', role: 'editor' }))
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    canEdit: user?.role !== 'viewer',
    loading,
  };
}
