import { useState, type ReactNode } from 'react';
import Icon from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  // Return false (or a Promise resolving to false) to KEEP the modal open —
  // used by forms to stay open on validation/network errors instead of
  // silently closing and losing the user's input.
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}

export default function Modal({ open, title, children, confirmLabel, onConfirm, onClose }: ModalProps) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result !== false) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Saving…' : (confirmLabel || 'Save')}</button>
        </div>
      </div>
    </div>
  );
}
