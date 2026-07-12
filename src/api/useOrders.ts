import { useCallback, useEffect, useState } from 'react';
import { api } from './client';
import { onLiveEvent } from './liveBus';
import type { Order } from '../data/mockData';

// Live-backed replacement for the old static `ordersData` import. Fetches once
// from the real API, then keeps itself in sync two ways:
//  - SSE pushes from server/index.js for changes made in THIS portal, and
//  - a 10s background poll, because orders and payments also change directly
//    in the shared MongoDB via the Garm App's own backend (new orders placed
//    by customers, customer payments) — those never pass through this
//    portal's server, so SSE alone would miss them.
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.getOrders().then(setOrders).finally(() => setLoading(false));
  }, []);

  // Background poll — silent (no loading flicker), tolerant of failures.
  const silentRefresh = useCallback(() => {
    api.getOrders().then(setOrders).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(silentRefresh, 10_000);
    return () => clearInterval(t);
  }, [silentRefresh]);

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
