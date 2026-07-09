// Live push from the backend, via Server-Sent Events (native browser EventSource —
// no socket.io-client needed). One shared connection; components subscribe to the
// event names they care about (order:created, product:updated, etc.) with useEffect.
import { API_BASE } from './config';

type Handler<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();
let source: EventSource | null = null;

function ensureConnected() {
  if (source) return;
  source = new EventSource(`${API_BASE}/api/events`);
  source.onerror = () => {
    // EventSource reconnects automatically; nothing to do here.
  };
}

export function onLiveEvent<T = unknown>(event: string, handler: Handler<T>): () => void {
  ensureConnected();
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
    source!.addEventListener(event, (e: MessageEvent) => {
      let payload: unknown = null;
      try { payload = JSON.parse(e.data); } catch { /* ignore malformed */ }
      listeners.get(event)!.forEach((h) => h(payload));
    });
  }
  listeners.get(event)!.add(handler as Handler);
  return () => listeners.get(event)?.delete(handler as Handler);
}
