'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle } from 'lucide-react';

interface NavigationGuardContext {
  hasUnsavedChanges: boolean;
  setUnsavedChanges: (v: boolean) => void;
  requestNavigate: (href: string) => void;
  registerSaveDraft: (fn: (() => Promise<void>) | null) => void;
}

const NavigationGuardCtx = createContext<NavigationGuardContext>({
  hasUnsavedChanges: false,
  setUnsavedChanges: () => {},
  requestNavigate: () => {},
  registerSaveDraft: () => {},
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setUnsavedChanges] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);
  const saveDraftRef = useRef<(() => Promise<void>) | null>(null);
  const router = useRouter();

  const registerSaveDraft = useCallback((fn: (() => Promise<void>) | null) => {
    saveDraftRef.current = fn;
  }, []);

  const requestNavigate = useCallback((href: string) => {
    pendingHrefRef.current = href;
    setShowModal(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setUnsavedChanges(false);
    setShowModal(false);
    const h = pendingHrefRef.current;
    pendingHrefRef.current = null;
    if (h) router.push(h);
  }, [router]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    pendingHrefRef.current = null;
  }, []);

  const handleSaveAndStay = useCallback(async () => {
    const fn = saveDraftRef.current;
    if (!fn) { setShowModal(false); return; }
    setSaving(true);
    try {
      await fn();
    } catch { /* keep modal open on error */ }
    setSaving(false);
    setShowModal(false);
    pendingHrefRef.current = null;
  }, []);

  return (
    <NavigationGuardCtx.Provider value={{ hasUnsavedChanges, setUnsavedChanges, requestNavigate, registerSaveDraft }}>
      {children}

      {showModal && (
        <div className="modal-overlay" onClick={handleCancel} onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }} role="presentation">
          <div className="modal-box" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
            <button className="modal-close" onClick={handleCancel}><X size={16} /></button>
            <div className="modal-icon" style={{ background: '#fef3c7', color: '#d97706', margin: '0 0 16px' }}>
              <AlertTriangle size={22} />
            </div>
            <h3 className="modal-title" style={{ textAlign: 'left', fontSize: 16 }}>¿Salir sin guardar?</h3>
            <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 24, fontSize: 14 }}>
              Tienes datos sin guardar en el formulario. ¿Qué deseas hacer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }} onClick={handleSaveAndStay} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button className="btn secondary" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }} onClick={handleConfirm} disabled={saving}>
                Salir sin guardar
              </button>
              <button className="btn secondary" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginTop: 4 }} onClick={handleCancel} disabled={saving}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardCtx.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardCtx);
}
