'use client';
import { useRef, useState } from 'react';
import { CheckCircle, Upload } from 'lucide-react';

export const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
export const MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedFile(f: File) {
  return ALLOWED_TYPES.has(f.type) || ALLOWED_EXT.test(f.name);
}

export function FileDropZone({
  file,
  onChange,
}: Readonly<{
  file: File | null;
  onChange: (f: File | null) => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function validate(f: File): string | null {
    if (!isAllowedFile(f)) return 'Solo se permiten archivos PDF, JPG o PNG.';
    if (f.size > MAX_BYTES) return 'El archivo supera el límite de 10 MB.';
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
    return (
      <div className="upload-zone has-file">
        <div className="upload-zone-content">
          <CheckCircle size={18} className="upload-zone-icon uploaded" />
          <div>
            <div className="upload-zone-filename">{file.name}</div>
            <div className="upload-zone-size">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
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
        accept=".pdf,.jpg,.jpeg,.png"
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
            <div className="upload-zone-types">PDF, JPG, PNG — máx. 10 MB</div>
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
