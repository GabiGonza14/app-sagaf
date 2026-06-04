'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Upload, FileText } from 'lucide-react';
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
}

const CARD_CLASS: Record<string, string> = {
  cargado:   'doc-card uploaded',
  validado:  'doc-card validated',
  observado: 'doc-card observed',
};

const BADGE_CLASS: Record<string, string> = {
  cargado:   'badge green',
  validado:  'badge teal',
  observado: 'badge red',
};

const BADGE_LABEL: Record<string, string> = {
  cargado:   'Cargado',
  validado:  'Validado',
  observado: 'Observado',
};

export function ResubmitDocCard({ rosId, docReqId, index, nombre, adjunto, readOnly = false }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const estado = adjunto?.estado ?? 'pendiente';
  const cardClass = CARD_CLASS[estado] ?? 'doc-card';
  const badgeClass = BADGE_CLASS[estado] ?? 'badge amber';
  const badgeLabel = BADGE_LABEL[estado] ?? 'Pendiente';

  let adjuntoSubtitle: React.ReactNode = readOnly ? 'Documento adjunto' : 'Clic para descargar · Sube uno nuevo para reemplazar';
  if (adjunto?.observacion) {
    adjuntoSubtitle = <span style={{ color: 'var(--red, #dc2626)' }}>Observado — {adjunto.observacion}</span>;
  }

  return (
    <div className={cardClass}>
      <div className="doc-top">
        <div className="doc-title">
          <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, opacity: 0.6 }} />
          {index}. {nombre}
        </div>
        <span className={badgeClass}>{badgeLabel}</span>
      </div>

      {adjunto && (
        <div className="upload-zone has-file" style={{ marginBottom: 0 }}>
          <div className="upload-zone-content">
            <CheckCircle size={18} className="upload-zone-icon uploaded" />
            <div>
              <a
                href={`/api/documentos/${adjunto.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="upload-zone-filename"
                style={{ color: 'var(--primary)', textDecoration: 'none' }}
              >
                {adjunto.nombre_archivo}
              </a>
              <div className="upload-zone-size">{adjuntoSubtitle}</div>
            </div>
          </div>
        </div>
      )}

      {!readOnly && !adjunto && (
        <>
          <FileDropZone file={null} onChange={(f) => { if (f) onUpload(f); }} />
          {uploading && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>Subiendo…</div>
          )}
          {err && (
            <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.75rem', marginTop: 4 }}>{err}</div>
          )}
        </>
      )}

      {readOnly && !adjunto && (
        <div className="upload-zone" style={{ pointerEvents: 'none', opacity: 0.6 }}>
          <div className="upload-zone-content">
            <Upload size={16} className="upload-zone-icon" />
            <div className="upload-zone-empty">
              <div className="upload-zone-hint">Sin documento adjunto</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
