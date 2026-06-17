'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export function DiscardDraftButton({ rosId, numeroRos }: Readonly<{ rosId: string; numeroRos: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discard() {
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'No se pudo descartar el borrador.');
        setOpen(false);
        return;
      }
      router.push('/portal/ros');
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)} disabled={busy}
        style={{ color: 'var(--red)', fontSize: 13 }}>
        <Trash2 size={15} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Descartar borrador
      </button>
      {error && <div className="client-status error" style={{ marginTop: 8 }}>{error}</div>}
      <ConfirmModal
        isOpen={open}
        variant="danger"
        title="¿Descartar este borrador?"
        message={`El borrador ${numeroRos} y sus archivos se eliminarán de forma permanente. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, descartar"
        cancelLabel="Cancelar"
        onConfirm={discard}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
