'use client';
import { useRef, useState } from 'react';
import { CheckCircle, Upload } from 'lucide-react';

export const MAX_BYTES = 10 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv:  'text/csv',
};

export const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;

export function isAllowedFile(f: File) {
  return ALLOWED_TYPES.has(f.type) || ALLOWED_EXT.test(f.name);
}

function buildFromFormatos(formatos: string): { accept: string; mimes: Set<string>; extRe: RegExp; label: string } {
  const exts = formatos.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const mimes = new Set(exts.flatMap(e => MIME_MAP[e] ? [MIME_MAP[e]] : []));
  const accept = exts.map(e => `.${e}`).join(',');
  const extRe = new RegExp(`\\.(${exts.join('|')})$`, 'i');
  const label = exts.map(e => e.toUpperCase()).join(', ');
  return { accept, mimes, extRe, label };
}

export function FileDropZone({
  file,
  onChange,
  formatos,
  maxMb,
  analyzing = false,
}: Readonly<{
  file: File | null;
  onChange: (f: File | null) => void;
  formatos?: string;
  maxMb?: number;
  analyzing?: boolean;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const maxBytes = (maxMb ?? 10) * 1024 * 1024;
  const fmt = formatos ? buildFromFormatos(formatos) : null;
  const acceptAttr = fmt ? fmt.accept : '.pdf,.jpg,.jpeg,.png';
  const formatLabel = fmt ? fmt.label : 'PDF, JPG, PNG';
  const maxLabel = `${maxMb ?? 10} MB`;

  function validate(f: File): string | null {
    const allowed = fmt
      ? fmt.mimes.has(f.type) || fmt.extRe.test(f.name)
      : isAllowedFile(f);
    if (!allowed) return `Solo se permiten: ${formatLabel}.`;
    if (f.size > maxBytes) return `El archivo supera el límite de ${maxLabel}.`;
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      const err = validate(f);
      if (err) { setFileError(err); e.target.value = ''; return; }
    }
    setFileError(null);
    onChange(f);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    const err = validate(dropped);
    if (err) { setFileError(err); return; }
    setFileError(null);
    onChange(dropped);
  };

  if (file) {
    function openFile() {
      const url = URL.createObjectURL(file!);
      window.open(url, '_blank');
    }
    return (
      <div className={`upload-zone has-file${analyzing ? ' analyzing' : ''}`}>
        <div className="upload-zone-content">
          {analyzing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-zone-icon" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          ) : (
            <CheckCircle size={18} className="upload-zone-icon uploaded" />
          )}
          <button
            type="button"
            className="upload-zone-file-info"
            onClick={openFile}
            title="Ver archivo"
          >
            <div className="upload-zone-filename">{file.name}</div>
            <div className="upload-zone-size">{analyzing ? 'Analizando contenido…' : `${(file.size / 1024).toFixed(1)} KB`}</div>
          </button>
          <button
            type="button"
            className="upload-zone-remove"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            aria-label="Quitar archivo"
          >×</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        type="button"
        className={`upload-zone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="upload-zone-content">
          <Upload size={16} className="upload-zone-icon" />
          <div className="upload-zone-empty">
            <div className="upload-zone-hint">Arrastra o haz clic para subir</div>
            <div className="upload-zone-types">{formatLabel} — máx. {maxLabel}</div>
          </div>
        </div>
        {fileError && (
          <div style={{ color: 'var(--red, #dc2626)', fontSize: '0.75rem', marginTop: 4, paddingLeft: 4 }}>
            {fileError}
          </div>
        )}
      </button>
    </>
  );
}
