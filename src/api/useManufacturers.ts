import { useCallback, useEffect, useState } from 'react';
import { api } from './client';
import { onLiveEvent } from './liveBus';
import type { Manufacturer } from '../data/mockData';

export function useManufacturers() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.getManufacturers().then((data) => setManufacturers(data as Manufacturer[])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => onLiveEvent<Manufacturer>('manufacturer:updated', (m) => {
    setManufacturers((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }), []);

  return { manufacturers, loading, refresh };
}
