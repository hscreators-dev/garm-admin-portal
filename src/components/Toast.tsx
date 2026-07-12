import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';

// ─── Typed notifications — every action's outcome is unmistakable ────────────
// success (green): something was saved/changed, message says exactly what.
// error (red): nothing was saved — stays on screen twice as long.
// info (blue): neutral status information.
// Existing callers pass only a message; those are auto-classified by wording,
// so every page gets correct styling without touching 40 call sites.

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem { id: number; msg: string; type: ToastType; }

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ERROR_RE = /could not|couldn't|can't|cannot|failed|error|too large|required|already exists|blocked|isn't paid|hasn't|first —|denied/i;
const INFO_RE = /^loading|^waiting|^pending/i;

function classify(msg: string): ToastType {
  if (ERROR_RE.test(msg)) return 'error';
  if (INFO_RE.test(msg)) return 'info';
  return 'success';
}

const TOAST_META: Record<ToastType, { icon: string; title: string }> = {
  success: { icon: 'checkCircle', title: 'Done' },
  error: { icon: 'xCircle', title: 'Not saved' },
  info: { icon: 'bell', title: 'Info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((msg: string, type?: ToastType) => {
    const id = nextId.current++;
    const resolved = type ?? classify(msg);
    setToasts((t) => [...t.slice(-3), { id, msg, type: resolved }]);
    // Errors stay visibly longer — the admin must be able to read what failed.
    const ttl = resolved === 'error' ? 7000 : 4000;
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className={`toast toast-${t.type}`} key={t.id}>
            <Icon name={TOAST_META[t.type].icon} />
            <div className="toast-body">
              <div className="toast-title">{TOAST_META[t.type].title}</div>
              <span>{t.msg}</span>
            </div>
            <button className="toast-x" aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
