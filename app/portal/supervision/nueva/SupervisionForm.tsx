'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { TIPOS_COMUNICACION, ORGANISMOS_SUPERVISION } from '@/lib/supervision/constants';

export function SupervisionForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrFuente, setOcrFuente] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !formRef.current) return;

    setOcrBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/supervision/comunicaciones/ocr-preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return;

      const form = formRef.current;
      const hints = data.sugerencias ?? {};
      if (hints.numero_oficio) {
        const el = form.elements.namedItem('numero_oficio') as HTMLInputElement;
        if (el && !el.value) el.value = hints.numero_oficio;
      }
      if (hints.asunto) {
        const el = form.elements.namedItem('asunto') as HTMLInputElement;
        if (el && !el.value) el.value = hints.asunto;
      }
      if (data.texto_extraido) {
        setOcrPreview(String(data.texto_extraido).slice(0, 1200));
        setOcrFuente(data.fuente_ocr ?? 'ocr');
      } else {
        setOcrPreview(data.nota ?? 'Sin texto detectado — complete manualmente.');
        setOcrFuente(null);
      }
    } finally {
      setOcrBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch('/api/supervision/comunicaciones', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Error al registrar oficio');
        return;
      }
      router.push('/portal/supervision');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="card" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label>Organismo supervisor</label>
          <select name="organismo" required defaultValue="sbp">
            {ORGANISMOS_SUPERVISION.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tipo de comunicación</label>
          <select name="tipo_comunicacion" required defaultValue="requerimiento_inicial">
            {TIPOS_COMUNICACION.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Número de oficio</label>
          <input name="numero_oficio" placeholder="SBP-DSB-2026-001245" />
        </div>
        <div className="field">
          <label>Fecha del oficio</label>
          <input type="date" name="fecha_oficio" />
        </div>
        <div className="field">
          <label>Plazo de respuesta</label>
          <input type="date" name="fecha_limite_respuesta" />
        </div>
        <div className="field full">
          <label>Asunto</label>
          <input name="asunto" placeholder="Notificación de inicio de inspección…" />
        </div>
        <div className="field full">
          <label>Documento PDF / imagen del oficio</label>
          <input
            type="file"
            name="file"
            accept=".pdf,image/png,image/jpeg"
            required
            onChange={onFileChange}
          />
          {ocrBusy && <p className="small" style={{ marginTop: 6 }}>Extrayendo texto (OCR / capa PDF)…</p>}
        </div>
        {ocrPreview && (
          <div className="notice" style={{ gridColumn: '1 / -1' }}>
            <strong>Vista previa OCR{ocrFuente ? ` (${ocrFuente === 'text-layer' ? 'texto PDF' : 'Tesseract'})` : ''}:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8, maxHeight: 200, overflow: 'auto' }}>{ocrPreview}</pre>
            <p className="small" style={{ margin: '8px 0 0' }}>Revise y corrija los campos antes de registrar.</p>
          </div>
        )}
        {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="field full">
          <button type="submit" className="btn primary" disabled={busy || ocrBusy}>
            {busy ? 'Registrando…' : 'Registrar comunicación'}
          </button>
        </div>
      </div>
    </form>
  );
}
