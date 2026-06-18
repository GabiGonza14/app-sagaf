'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoDismissMs?: number;
}

export function SuccessModal({ isOpen, title, message, onClose, autoDismissMs = 3000 }: Props) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => onCloseRef.current(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [isOpen, autoDismissMs]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      aria-live="polite"
    >
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <button
          type="button"
          className="modal-close"
          onClick={() => onCloseRef.current()}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>

        <div
          className="modal-icon"
          style={{ background: 'var(--green-soft)', color: 'var(--green)' }}
        >
          <CheckCircle2 size={26} />
        </div>

        <h3 id="success-modal-title" className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>

        <div style={{
          height: 3,
          background: 'var(--line)',
          borderRadius: 99,
          margin: '18px 0 0',
          overflow: 'hidden',
        }}>
          <div
            key={String(isOpen)}
            style={{
              height: '100%',
              width: '100%',
              background: 'var(--green)',
              borderRadius: 99,
              animationName: 'progressShrink',
              animationDuration: `${autoDismissMs}ms`,
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',
            }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn green"
            style={{ flex: 'none', minWidth: 120 }}
            onClick={() => onCloseRef.current()}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
