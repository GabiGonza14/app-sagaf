'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut, Info, CheckCircle, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  input?: {
    label: string;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    value: string;
    onChange: (v: string) => void;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

const config: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  btnClass: string;
}> = {
  danger: {
    icon: <LogOut size={22} />,
    iconBg: 'var(--red-soft)',
    iconColor: 'var(--red)',
    btnClass: 'btn red',
  },
  warning: {
    icon: <AlertTriangle size={22} />,
    iconBg: 'var(--amber-soft)',
    iconColor: 'var(--amber)',
    btnClass: 'btn amber',
  },
  info: {
    icon: <Info size={22} />,
    iconBg: 'var(--primary-soft)',
    iconColor: 'var(--primary)',
    btnClass: 'btn primary',
  },
  success: {
    icon: <CheckCircle size={22} />,
    iconBg: 'var(--green-soft)',
    iconColor: 'var(--green)',
    btnClass: 'btn green',
  },
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  variant = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  busy = false,
  input,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const { icon, iconBg, iconColor, btnClass } = config[variant];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-box">
        <button
          type="button"
          className="modal-close"
          onClick={onCancel}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>

        <div
          className="modal-icon"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>

        <h3 id="modal-title" className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>

        {input && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="modal-input">{input.label}</label>
            <textarea
              id="modal-input"
              value={input.value}
              onChange={(e) => input.onChange(e.target.value)}
              placeholder={input.placeholder}
              required={input.required}
              rows={3}
              style={{ marginTop: 4 }}
            />
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={btnClass}
            onClick={onConfirm}
            disabled={busy || (input?.required && !input.value.trim()) || (!!input?.minLength && input.value.trim().length < input.minLength)}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
