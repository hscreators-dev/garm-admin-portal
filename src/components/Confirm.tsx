import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';

// ─── Styled confirmation popups — replaces raw window.confirm everywhere ─────
// Promise-based: `const ok = await confirm({ title, message, confirmLabel })`.
// `tone: 'danger'` renders the confirm button red for destructive actions.

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  function close(result: boolean) {
    resolver.current(result);
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`confirm-badge ${opts.tone === 'danger' ? 'danger' : ''}`}>
                  <Icon name={opts.tone === 'danger' ? 'xCircle' : 'shieldSm'} />
                </span>
                {opts.title}
              </h3>
              <button className="icon-btn" onClick={() => close(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{opts.message}</div>
            <div className="modal-foot">
              <button className="btn btn-outline" onClick={() => close(false)}>{opts.cancelLabel || 'Cancel'}</button>
              <button
                className="btn btn-primary"
                style={opts.tone === 'danger' ? { background: 'var(--danger, #dc2626)', borderColor: 'var(--danger, #dc2626)' } : undefined}
                onClick={() => close(true)}
              >
                {opts.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
