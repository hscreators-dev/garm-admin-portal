import type { ReactNode } from 'react';
import Icon from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function Modal({ open, title, children, confirmLabel, onConfirm, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel || 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
