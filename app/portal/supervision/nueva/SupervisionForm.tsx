'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TIPOS_COMUNICACION, ORGANISMOS_SUPERVISION } from '@/lib/supervision/constants';
import type { OficioParse } from '@/lib/supervision/parse-oficio';
import type { AlcanceFormSugerido } from '@/lib/supervision/aplicar-alcance';
import { DocumentoViewer } from '@/components/supervision/DocumentoViewer';

interface Props {
  soTipo: string;
}

function applyParse(
  parse: OficioParse,
  setters: {
    setOrganismo: (v: string) => void;
    setTipo: (v: string) => void;
    setNumero: (v: string) => void;
    setAsunto: (v: string) => void;
    setFechaOficio: (v: string) => void;
    setPlazo: (v: string) => void;
  },
) {
  if (parse.organismo) setters.setOrganismo(parse.organismo);
  if (parse.tipo_comunicacion) setters.setTipo(parse.tipo_comunicacion);
  if (parse.numero_oficio) setters.setNumero(parse.numero_oficio);
  if (parse.asunto) setters.setAsunto(parse.asunto);
  if (parse.fecha_oficio) setters.setFechaOficio(parse.fecha_oficio);
  if (parse.fecha_limite_respuesta) setters.setPlazo(parse.fecha_limite_respuesta);
}

export function SupervisionForm({ soTipo }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrFuente, setOcrFuente] = useState<string | null>(null);
  const [ocrNota, setOcrNota] = useState<string | null>(null);
  const [alcancePreview, setAlcancePreview] = useState<AlcanceFormSugerido | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);

  const [organismo, setOrganismo] = useState('sbp');
  const [tipo, setTipo] = useState('requerimiento_inicial');
  const [numero, setNumero] = useState('');
  const [asunto, setAsunto] = useState('');
  const [fechaOficio, setFechaOficio] = useState('');
  const [plazo, setPlazo] = useState('');

  const setters = { setOrganismo, setTipo, setNumero, setAsunto, setFechaOficio, setPlazo };

  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  function setFilePreview(file: File) {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setFilePreviewUrl(url);
    const ext = file.name.toLowerCase();
    const mime =
      file.type ||
      (ext.endsWith('.pdf') ? 'application/pdf' : ext.match(/\.(jpe?g|png)$/) ? `image/${ext.endsWith('.png') ? 'png' : 'jpeg'}` : null);
    setFileMime(mime);
  }

  async function runOcr(file: File) {
    setOcrBusy(true);
    setError(null);
    setOcrNota(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo_comunicacion', tipo);
      fd.append('so_tipo', soTipo);
      const res = await fetch('/api/supervision/comunicaciones/ocr-preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return;

      const parse = (data.parse ?? data.sugerencias ?? {}) as OficioParse;
      applyParse(parse, setters);
      setAlcancePreview((data.alcance_paquete as AlcanceFormSugerido) ?? null);

      if (data.texto_extraido) {
        setOcrPreview(String(data.texto_extraido).slice(0, 8000));
        setOcrFuente(data.fuente_ocr ?? 'ocr');
        const partes: string[] = [];
        if (data.alcance_paquete?.fecha_desde && data.alcance_paquete?.fecha_hasta) {
          partes.push(`Periodo para paquete: ${data.alcance_paquete.fecha_desde} → ${data.alcance_paquete.fecha_hasta}`);
        } else if (parse.periodo) {
          partes.push(`Periodo detectado: ${parse.periodo.desde} → ${parse.periodo.hasta}`);
        }
        if (data.alcance_paquete?.lista_ros?.length) {
          partes.push(`ROS: ${data.alcance_paquete.lista_ros.join(', ')}`);
        } else if (parse.lista_ros?.length) {
          partes.push(`ROS detectados: ${parse.lista_ros.join(', ')}`);
        }
        if (partes.length) setOcrNota(partes.join(' · '));
      } else {
        setOcrPreview(null);
        setOcrFuente(null);
        setAlcancePreview(null);
        setOcrNota(data.nota ?? 'Sin texto detectado — complete manualmente.');
      }
    } finally {
      setOcrBusy(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePreview(file);
    await runOcr(file);
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
      router.push(`/portal/supervision/${data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="supervision-doc-layout">
      <form ref={formRef} className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Organismo supervisor</label>
            <select name="organismo" required value={organismo} onChange={(e) => setOrganismo(e.target.value)}>
              {ORGANISMOS_SUPERVISION.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tipo de comunicación</label>
            <select name="tipo_comunicacion" required value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_COMUNICACION.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Número de oficio</label>
            <input name="numero_oficio" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="SBP-DSB-2026-001245" />
          </div>
          <div className="field">
            <label>Fecha del oficio</label>
            <input type="date" name="fecha_oficio" value={fechaOficio} onChange={(e) => setFechaOficio(e.target.value)} />
          </div>
          <div className="field">
            <label>Plazo de respuesta</label>
            <input type="date" name="fecha_limite_respuesta" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
          </div>
          <div className="field full">
            <label>Asunto</label>
            <input name="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Requerimiento inicial de información…" />
          </div>
          <div className="field full">
            <label>Documento PDF / imagen del oficio</label>
            <input type="file" name="file" accept=".pdf,image/png,image/jpeg" required onChange={onFileChange} />
            {ocrBusy && <p className="small" style={{ marginTop: 6 }}>Analizando documento y extrayendo campos…</p>}
          </div>
          {ocrNota && (
            <div className="notice" style={{ gridColumn: '1 / -1' }}>
              <p className="small" style={{ margin: 0 }}>{ocrNota}</p>
              {alcancePreview && (
                <p className="small" style={{ margin: '8px 0 0' }}>
                  Alcance sugerido: <strong>{alcancePreview.alcance_tipo.replace(/_/g, ' ')}</strong>
                  {alcancePreview.fecha_desde ? ` (${alcancePreview.fecha_desde} a ${alcancePreview.fecha_hasta})` : ''}
                  {alcancePreview.lista_ros?.length ? ` — ${alcancePreview.lista_ros.length} ROS` : ''}.
                </p>
              )}
            </div>
          )}
          {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
          <div className="field full">
            <button type="submit" className="btn primary" disabled={busy || ocrBusy || !filePreviewUrl}>
              {busy ? 'Registrando…' : 'Registrar comunicación'}
            </button>
          </div>
        </div>
      </form>

      <div className="card" style={{ position: 'sticky', top: 16 }}>
        <h3 style={{ marginTop: 0 }}>Vista del documento</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          {filePreviewUrl
            ? 'Valide que el oficio se vea correctamente antes de registrar.'
            : 'Seleccione un PDF o imagen para previsualizarlo aquí.'}
        </p>
        {filePreviewUrl ? (
          <DocumentoViewer
            src={filePreviewUrl}
            mime={fileMime}
            title="Vista previa del oficio"
            ocrText={ocrPreview}
            ocrFuente={ocrFuente}
            height={520}
          />
        ) : (
          <div
            style={{
              height: 320,
              borderRadius: 12,
              border: '2px dashed var(--line, #d0d7e2)',
              display: 'grid',
              placeContent: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              textAlign: 'center',
              padding: 24,
            }}
          >
            Sin documento cargado
          </div>
        )}
      </div>
    </div>
  );
}
