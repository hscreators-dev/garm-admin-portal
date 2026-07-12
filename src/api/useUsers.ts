import { useCallback, useEffect, useState } from 'react';
import { api, type ApiUser } from './client';
import { onLiveEvent } from './liveBus';

export function useUsers() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.getUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => onLiveEvent<ApiUser>('user:created', (u) => {
    setUsers((prev) => [...prev, u]);
  }), []);

  useEffect(() => onLiveEvent<ApiUser>('user:updated', (u) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  }), []);

  useEffect(() => onLiveEvent<{ id: number }>('user:deleted', ({ id }) => {
    setUsers((prev) => prev.filter((x) => x.id !== id));
  }), []);

  return { users, loading, refresh };
}
