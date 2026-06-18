'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Upload, FileText, Ban } from 'lucide-react';
import { FileDropZone } from '@/components/FileDropZone';

interface Adjunto {
  id: string;
  nombre_archivo: string;
  estado: string;
  observacion: string | null;
  fecha_carga: string;
}

interface Props {
  rosId: string;
  docReqId: string;
  index: number;
  nombre: string;
  adjunto: Adjunto | null;
  readOnly?: boolean;
  solicitudMotivo?: string | null;
  tipoRequerimiento?: string;
}

const CARD_CLASS: Record<string, string> = {
  cargado:   'doc-card uploaded',
  validado:  'doc-card validated',
  observado: 'doc-card observed',
  no_aplica: 'doc-card',
};

const BADGE_CLASS: Record<string, string> = {
  cargado:   'badge green',
  validado:  'badge teal',
  observado: 'badge red',
  no_aplica: 'badge gray',
};

const BADGE_LABEL: Record<string, string> = {
  cargado:   'Cargado',
  validado:  'Validado',
  observado: 'Observado',
  no_aplica: 'No aplica',
};

export function ResubmitDocCard({ rosId, docReqId, index, nombre, adjunto, readOnly = false, solicitudMotivo, tipoRequerimiento = 'requerido' }: Readonly<Props>) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showNoAplicaForm, setShowNoAplicaForm] = useState(false);
  const [noAplicaText, setNoAplicaText] = useState('');
  const [noAplicaBusy, setNoAplicaBusy] = useState(false);
  const [noAplicaErr, setNoAplicaErr] = useState<string | null>(null);

  async function onUpload(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ros_id', rosId);
      fd.append('documento_requerido_id', docReqId);
      const res = await fetch('/api/documentos/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? 'Error al subir el documento.');
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function onNoAplica() {
    if (noAplicaText.trim().length < 10) return;
    setNoAplicaErr(null);
    setNoAplicaBusy(true);
    try {
      const res = await fetch('/api/documentos/no-aplica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ros_id: rosId, documento_requerido_id: docReqId, justificacion: noAplicaText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNoAplicaErr(data.error ?? 'Error al procesar la solicitud.');
        return;
      }
      router.refresh();
    } finally {
      setNoAplicaBusy(false);
    }
  }

  const estado = adjunto?.estado ?? 'pendiente';
  const cardClass = `${CARD_CLASS[estado] ?? 'doc-card'} ${tipoRequerimiento === 'requerido' ? 'req-card' : tipoRequerimiento === 'condicional' ? 'cond-card' : 'opt-card'}`;
  const badgeClass = BADGE_CLASS[estado] ?? 'badge amber';
  const badgeLabel = BADGE_LABEL[estado] ?? 'Pendiente';

  // Habilitar carga cuando hay solicitud pendiente de la UAF y no existe adjunto aún
  const hasSolicitud = !!solicitudMotivo && !adjunto;
  const canInteract = (!readOnly || hasSolicitud) && (!adjunto || adjunto?.estado === 'observado');

  const isNoAplica = adjunto?.estado === 'no_aplica';
  const hasFile    = !!adjunto && !isNoAplica;
  const showBadge  = estado !== 'pendiente' || tipoRequerimiento === 'requerido';

  let adjuntoSubtitle: React.ReactNode = readOnly ? 'Documento adjunto' : 'Clic para descargar · Sube uno nuevo para reemplazar';
  if (adjunto?.observacion && adjunto?.estado === 'observado') {
    adjuntoSubtitle = <span style={{ color: 'var(--red, #dc2626)' }}>Observado — {adjunto.observacion}</span>;
  }

  return (
    <div className={cardClass}>
      <div className="doc-top">
        <div className="doc-title">
          <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, opacity: 0.6 }} />
          {index}. {nombre}
        </div>
        {showBadge && <span className={badgeClass}>{badgeLabel}</span>}
      </div>

      {isNoAplica && (
        <div className="client-status info" style={{ marginBottom: 0 }}>
          <Ban size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          <strong>No aplica</strong> — {adjunto?.observacion ?? 'Declarado como no aplicable.'}
        </div>
      )}

      {hasFile && (
        <div className="upload-zone has-file" style={{ marginBottom: 0 }}>
          <div className="upload-zone-content">
            <CheckCircle size={18} className="upload-zone-icon uploaded" />
            <div>
              <a
                href={`/documentos/${adjunto!.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="upload-zone-filename"
                style={{ color: 'var(--primary)', textDecoration: 'none' }}
              >
                {adjunto!.nombre_archivo}
              </a>
              <div className="upload-zone-size">{adjuntoSubtitle}</div>
            </div>
          </div>
        </div>
      )}

      {hasSolicitud && (
        <div className="client-status warning" style={{ marginBottom: 4 }}>
          <strong>La UAF solicitó este documento:</strong> {solicitudMotivo}
        </div>
      )}

      {canInteract && !showNoAplicaForm && (
        <>
          <FileDropZone file={null} onChange={(f) => { if (f) onUpload(f); }} />
          {uploading && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>Subiendo…</div>
          )}
          {err && (
            <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.75rem', marginTop: 4 }}>{err}</div>
          )}
          <button
            type="button"
            className="btn ghost"
            style={{ marginTop: 6, fontSize: '0.75rem' }}
            onClick={() => { setShowNoAplicaForm(true); setNoAplicaErr(null); setNoAplicaText(''); }}
          >
            Este documento no aplica
          </button>
        </>
      )}

      {canInteract && showNoAplicaForm && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>
            Justificación (mín. 10 caracteres · {noAplicaText.trim().length}/10)
          </label>
          <textarea
            value={noAplicaText}
            onChange={(e) => setNoAplicaText(e.target.value)}
            placeholder="Explique por qué este documento no aplica a su caso…"
            rows={3}
            style={{ fontSize: '0.8rem' }}
          />
          {noAplicaErr && (
            <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.75rem' }}>{noAplicaErr}</div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn primary"
              disabled={noAplicaBusy || noAplicaText.trim().length < 10}
              onClick={onNoAplica}
              style={{ fontSize: '0.8rem' }}
            >
              {noAplicaBusy ? 'Enviando…' : 'Confirmar no aplica'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowNoAplicaForm(false)}
              style={{ fontSize: '0.8rem' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {readOnly && !hasSolicitud && !adjunto && (
        <div style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.85rem', opacity: 0.8, background: '#f8fafc', borderRadius: 8, marginTop: 8, border: '1px solid #e2e8f0' }}>
          Sin documento adjunto
        </div>
      )}
    </div>
  );
}
