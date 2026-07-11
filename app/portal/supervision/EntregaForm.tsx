'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  paqueteId: string;
  numeroSolicitud: string;
}

const CANALES = [
  { id: 'correo', label: 'Correo institucional' },
  { id: 'portal_regulatorio', label: 'Portal del regulador' },
  { id: 'entrega_fisica', label: 'Entrega física / mensajería' },
  { id: 'otro', label: 'Otro canal' },
] as const;

export function EntregaForm({ paqueteId, numeroSolicitud }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch(`/api/supervision/paquetes/${paqueteId}/entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_entrega: fd.get('canal_entrega'),
          observacion: (fd.get('observacion') as string) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Error al registrar entrega');
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="client-status found" style={{ marginBottom: 12 }}>
        Entrega de <strong>{numeroSolicitud}</strong> registrada.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{numeroSolicitud}</p>
      <div className="form-grid">
        <div className="field">
          <label>Canal de entrega</label>
          <select name="canal_entrega" required defaultValue="correo">
            {CANALES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Observación (opcional)</label>
          <input name="observacion" placeholder="Referencia de envío, fecha de recepción confirmada…" />
        </div>
        {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="field">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Registrar entrega'}
          </button>
        </div>
      </div>
    </form>
  );
}
