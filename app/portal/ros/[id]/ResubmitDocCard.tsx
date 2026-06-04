'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Upload, FileText } from 'lucide-react';

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

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedFile(f: File) {
  return ALLOWED_TYPES.has(f.type) || ALLOWED_EXT.test(f.name);
}

export function ResubmitDocCard({ rosId, docReqId, index, nombre, adjunto, readOnly = false }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function validate(f: File): string | null {
    if (!isAllowedFile(f)) return 'Solo se permiten archivos PDF, JPG o PNG.';
    if (f.size > MAX_BYTES) return 'El archivo supera el límite de 10 MB.';
    return null;
  }

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
        setPendingFile(null);
        return;
      }
      setPendingFile(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleFile(f: File) {
    const validErr = validate(f);
    if (validErr) { setFileError(validErr); return; }
    setFileError(null);
    setPendingFile(f);
    onUpload(f);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const estado = adjunto?.estado ?? 'pendiente';

  const cardClass =
    estado === 'cargado'   ? 'doc-card uploaded'
  : estado === 'validado'  ? 'doc-card validated'
  : estado === 'observado' ? 'doc-card observed'
  : 'doc-card';

  const badgeClass =
    estado === 'cargado'   ? 'badge green'
  : estado === 'validado'  ? 'badge teal'
  : estado === 'observado' ? 'badge red'
  : 'badge amber';

  const badgeLabel =
    estado === 'cargado'   ? 'Cargado'
  : estado === 'validado'  ? 'Validado'
  : estado === 'observado' ? 'Observado'
  : 'Pendiente';

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
                onClick={(e) => e.stopPropagation()}
              >
                {adjunto.nombre_archivo}
              </a>
              <div className="upload-zone-size">
                {adjunto.observacion
                  ? <span style={{ color: 'var(--red, #dc2626)' }}>Observado — {adjunto.observacion}</span>
                  : (readOnly ? 'Documento adjunto' : 'Clic para descargar · Sube uno nuevo para reemplazar')}
              </div>
            </div>
          </div>
        </div>
      )}

      {!readOnly && !adjunto && (
        <>
          <div
            className={`upload-zone${uploading ? ' has-file' : ''}${dragging ? ' dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            {uploading && pendingFile ? (
              <div className="upload-zone-content">
                <CheckCircle size={18} className="upload-zone-icon uploaded" />
                <div>
                  <div className="upload-zone-filename">{pendingFile.name}</div>
                  <div className="upload-zone-size">Subiendo…</div>
                </div>
              </div>
            ) : (
              <div className="upload-zone-content">
                <Upload size={16} className="upload-zone-icon" />
                <div className="upload-zone-empty">
                  <div className="upload-zone-hint">
                    {adjunto ? 'Arrastra o haz clic para reemplazar' : 'Arrastra o haz clic para subir'}
                  </div>
                  <div className="upload-zone-types">PDF, JPG, PNG — máx. 10 MB</div>
                </div>
              </div>
            )}
          </div>
          {fileError && (
            <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.75rem', marginTop: 4 }}>{fileError}</div>
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
