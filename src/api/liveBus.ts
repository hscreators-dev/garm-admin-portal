// Live push from the backend, via Server-Sent Events (native browser EventSource —
// no socket.io-client needed). One shared connection; components subscribe to the
// event names they care about (order:created, product:updated, etc.) with useEffect.
import { API_BASE } from './config';
import { adminToken } from './client';

type Handler<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();
// Events whose EventSource listener is attached to the CURRENT `source`. Kept
// separate from `listeners` so we never try to attach to a null source, and so
// pending subscriptions get wired the moment the stream actually connects.
const wired = new Set<string>();
let source: EventSource | null = null;

function wireEvent(event: string) {
  if (!source || wired.has(event)) return;
  wired.add(event);
  source.addEventListener(event, (e: MessageEvent) => {
    let payload: unknown = null;
    try { payload = JSON.parse(e.data); } catch { /* ignore malformed */ }
    listeners.get(event)?.forEach((h) => h(payload));
  });
}

function ensureConnected() {
  if (source) return;
  const token = adminToken.get();
  if (!token) return; // not signed in yet — retried on the next onLiveEvent() after sign-in
  // Native EventSource can't send an Authorization header, so the session
  // token travels as a query param instead — checked server-side before the
  // stream opens (this endpoint used to be wide open to anyone).
  source = new EventSource(`${API_BASE}/api/events?token=${encodeURIComponent(token)}`);
  source.onerror = () => {
    // EventSource reconnects automatically; nothing to do here.
  };
  // Attach listeners for any events subscribed to BEFORE the token existed.
  wired.clear();
  for (const event of listeners.keys()) wireEvent(event);
}

export function onLiveEvent<T = unknown>(event: string, handler: Handler<T>): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler as Handler);
  ensureConnected();
  // Only wires if a source exists; otherwise ensureConnected() will wire it
  // once sign-in provides a token and the stream opens.
  wireEvent(event);
  return () => listeners.get(event)?.delete(handler as Handler);
}
