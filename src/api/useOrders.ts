import { useCallback, useEffect, useState } from 'react';
import { api } from './client';
import { onLiveEvent } from './liveBus';
import type { Order } from '../data/mockData';

// Live-backed replacement for the old static `ordersData` import. Fetches once
// from the real API, then keeps itself in sync via Server-Sent Events pushed
// from server/index.js — no polling, no manual refresh needed.
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.getOrders().then(setOrders).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const offCreated = onLiveEvent<Order>('order:created', (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    });
    const offStatus = onLiveEvent<Order>('order:status_changed', (order) => {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    });
    return () => { offCreated(); offStatus(); };
  }, []);

  return { orders, loading, refresh };
}
