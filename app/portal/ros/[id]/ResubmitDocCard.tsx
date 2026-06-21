'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, FileText, Ban, AlertTriangle } from 'lucide-react';
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
  const cardClass = `${CARD_CLASS[estado] ?? 'doc-card'} ${tipoRequerimiento === 'requerido' ? 'req-card' : tipoRequerimiento === 'condicional' ? 'cond-card' : 'opt-card'}`;
  const badgeClass = BADGE_CLASS[estado] ?? 'badge amber';
  const badgeLabel = BADGE_LABEL[estado] ?? 'Pendiente';

  const hasSolicitud = !!solicitudMotivo && !adjunto;
  const isObservado  = adjunto?.estado === 'observado';
  const canUpload    = (!readOnly || hasSolicitud) && (!adjunto || isObservado);

  const isNoAplica = adjunto?.estado === 'no_aplica';
  const hasFile    = !!adjunto && !isNoAplica;
  const showBadge  = estado !== 'pendiente' || tipoRequerimiento === 'requerido';

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

      {/* Diseño especial para documentos observados */}
      {isObservado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Aviso compacto de observación */}
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '8px 10px',
          }}>
            <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.4 }}>
              {adjunto?.observacion ?? 'La UAF observó este documento.'}
            </div>
          </div>

          {/* Archivo anterior — compacto */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 10px',
          }}>
            <FileText size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={`/documentos/${adjunto!.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {adjunto!.nombre_archivo}
              </a>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Documento anterior</div>
            </div>
          </div>

          {/* Dropzone directo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400e' }}>Sube el documento corregido</span>
            <FileDropZone file={null} onChange={(f) => { if (f) onUpload(f); }} />
            {uploading && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Subiendo…</div>}
            {err && <div style={{ color: 'var(--red,#dc2626)', fontSize: '0.75rem' }}>{err}</div>}
          </div>
        </div>
      ) : (
        <>
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
                  <div className="upload-zone-size">Documento adjunto</div>
                </div>
              </div>
            </div>
          )}

          {hasSolicitud && (
            <div className="client-status warning" style={{ marginBottom: 4 }}>
              <strong>La UAF solicitó este documento:</strong> {solicitudMotivo}
            </div>
          )}

          {canUpload && (
            <>
              <FileDropZone file={null} onChange={(f) => { if (f) onUpload(f); }} />
              {uploading && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>Subiendo…</div>}
              {err && <div style={{ color: 'var(--red,#dc2626)', fontSize: '0.75rem', marginTop: 4 }}>{err}</div>}
            </>
          )}
        </>
      )}

      {readOnly && !hasSolicitud && !adjunto && (
        <div style={{ padding: '6px 10px', color: 'var(--muted)', fontSize: '0.72rem', opacity: 0.65, marginTop: 6 }}>
          Sin documento adjunto
        </div>
      )}
    </div>
  );
}
