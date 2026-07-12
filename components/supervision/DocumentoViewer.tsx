'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Loader2, ScanText } from 'lucide-react';

type Tab = 'documento' | 'texto';

interface Props {
  /** URL del documento (API, blob o ruta pública) */
  src: string;
  mime?: string | null;
  title?: string;
  ocrText?: string | null;
  ocrFuente?: string | null;
  downloadHref?: string;
  height?: number;
}

function guessMime(blob: Blob, src: string, hint?: string | null): string {
  if (hint && hint !== 'application/octet-stream') return hint;
  if (blob.type && blob.type !== 'application/octet-stream') return blob.type;
  if (/\.pdf(\?|$)/i.test(src) || src.startsWith('blob:')) return 'application/pdf';
  if (/\.(png|jpe?g)(\?|$)/i.test(src)) return 'image/jpeg';
  return blob.type || 'application/pdf';
}

function isPdfType(mime: string): boolean {
  return mime.includes('pdf');
}

function isImageType(mime: string): boolean {
  return mime.startsWith('image/');
}

export function DocumentoViewer({
  src,
  mime: mimeHint,
  title = 'Documento del oficio',
  ocrText,
  ocrFuente,
  downloadHref,
  height = 620,
}: Props) {
  const [tab, setTab] = useState<Tab>('documento');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>('application/pdf');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab('documento');
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        if (src.startsWith('blob:') || src.startsWith('data:')) {
          if (!cancelled) {
            setBlobUrl(src);
            setMime(guessMime(new Blob(), src, mimeHint));
          }
          return;
        }

        const res = await fetch(src, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          let msg = `No se pudo cargar el documento (${res.status})`;
          try {
            const j = await res.json() as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* binario */
          }
          throw new Error(msg);
        }

        const blob = await res.blob();
        if (cancelled) return;

        const detected = guessMime(blob, src, mimeHint ?? res.headers.get('content-type'));
        const url = URL.createObjectURL(blob);
        revoked = url;
        setMime(detected);
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar la vista previa');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src, mimeHint]);

  const pdf = isPdfType(mime);
  const image = isImageType(mime);
  const openHref = downloadHref ?? src;

  return (
    <div className="doc-viewer">
      <div className="doc-viewer-toolbar">
        <div className="doc-viewer-tabs">
          <button
            type="button"
            className={tab === 'documento' ? 'active' : ''}
            onClick={() => setTab('documento')}
          >
            <FileText size={15} aria-hidden />
            Documento original
          </button>
          {ocrText && (
            <button
              type="button"
              className={tab === 'texto' ? 'active' : ''}
              onClick={() => setTab('texto')}
            >
              <ScanText size={15} aria-hidden />
              Texto extraído
            </button>
          )}
        </div>
        {openHref && !loading && (
          <a
            href={blobUrl ?? openHref}
            className="btn ghost"
            style={{ fontSize: 12, padding: '6px 12px', minHeight: 34 }}
            target="_blank"
            rel="noopener noreferrer"
            download={pdf ? undefined : true}
          >
            <ExternalLink size={14} aria-hidden />
            Abrir en pestaña
          </a>
        )}
      </div>

      {tab === 'documento' && (
        <div className="doc-viewer-frame" style={{ height }}>
          {loading && (
            <div className="doc-viewer-fallback">
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              <p>Cargando documento…</p>
            </div>
          )}
          {!loading && error && (
            <div className="doc-viewer-fallback doc-viewer-error">
              <AlertCircle size={28} />
              <p>{error}</p>
              {openHref && (
                <a href={openHref} className="btn ghost" target="_blank" rel="noopener noreferrer">
                  Intentar abrir directamente
                </a>
              )}
            </div>
          )}
          {!loading && !error && blobUrl && pdf && (
            <embed
              src={`${blobUrl}#toolbar=1&navpanes=0`}
              type="application/pdf"
              title={title}
              className="doc-viewer-embed"
            />
          )}
          {!loading && !error && blobUrl && image && !pdf && (
            <div className="doc-viewer-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blobUrl} alt={title} className="doc-viewer-image" />
            </div>
          )}
          {!loading && !error && blobUrl && !pdf && !image && (
            <div className="doc-viewer-fallback">
              <p>Vista previa no disponible para este formato.</p>
              <a href={blobUrl} download>Descargar archivo</a>
            </div>
          )}
        </div>
      )}

      {tab === 'texto' && ocrText && (
        <div className="doc-viewer-ocr" style={{ maxHeight: height }}>
          {ocrFuente && (
            <p className="small" style={{ margin: '0 0 8px', color: 'var(--muted)' }}>
              Fuente: {ocrFuente === 'text-layer' ? 'Capa de texto del PDF' : 'OCR (Tesseract)'}
            </p>
          )}
          <pre>{ocrText}</pre>
        </div>
      )}
    </div>
  );
}
