'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { NIVELES_CONTENIDO, labelTipoComunicacion } from '@/lib/supervision/constants';
import { sugerenciaPaquete } from '@/lib/supervision/catalogo';
import { EntregaForm } from './EntregaForm';

interface Comunicacion {
  id: string;
  numero_oficio: string | null;
  tipo_comunicacion: string;
  asunto: string | null;
  estado: string;
  fecha_limite_respuesta: string | null;
}

interface PaqueteRow {
  id: string;
  numero_solicitud: string;
  estado: string;
  fecha_creacion: string;
  paquete_id: string | null;
  entregas: number;
}

interface PreviewData {
  ros: number;
  numeros: string[];
  documentos: number;
  eventos_log: number;
  partes: number;
  con_riesgo: number;
  subsanaciones: number;
  indice_promedio_docs: number | null;
}

interface Props {
  comunicaciones: Comunicacion[];
  paquetesGenerados: PaqueteRow[];
  soTipo: string;
  responsableNombre: string;
}

function bodyFromForm(fd: FormData) {
  const lista = (fd.get('lista_ros') as string)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    comunicacion_id: (fd.get('comunicacion_id') as string) || undefined,
    titulo_respuesta: (fd.get('titulo_respuesta') as string) || undefined,
    items_solicitados_texto: (fd.get('items_solicitados') as string) || undefined,
    fundamento_alcance: (fd.get('fundamento_alcance') as string) || undefined,
    notas_regulatorio: (fd.get('notas_regulatorio') as string) || undefined,
    responsable_nombre: (fd.get('responsable_nombre') as string) || undefined,
    responsable_cargo: (fd.get('responsable_cargo') as string) || undefined,
    alcance_tipo: fd.get('alcance_tipo'),
    fecha_desde: (fd.get('fecha_desde') as string) || undefined,
    fecha_hasta: (fd.get('fecha_hasta') as string) || undefined,
    lista_ros: lista.length ? lista : undefined,
    tamano_muestra: fd.get('tamano_muestra') ? Number(fd.get('tamano_muestra')) : undefined,
    nivel_contenido: fd.get('nivel_contenido'),
    incluir_log: fd.get('incluir_log') === 'on',
    incluir_documentos: fd.get('incluir_documentos') === 'on',
    incluir_partes: fd.get('incluir_partes') === 'on',
    incluir_riesgo: fd.get('incluir_riesgo') === 'on',
    incluir_subsanaciones: fd.get('incluir_subsanaciones') === 'on',
    incluir_indice_cumplimiento: fd.get('incluir_indice_cumplimiento') === 'on',
  };
}

export function PaqueteForm({ comunicaciones, paquetesGenerados, soTipo, responsableNombre }: Props) {
  const searchParams = useSearchParams();
  const defaultCom = searchParams.get('comunicacion') ?? '';

  const [comId, setComId] = useState(defaultCom);
  const [alcanceTipo, setAlcanceTipo] = useState('periodo');
  const [itemsText, setItemsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<{ numero: string; paqueteId?: string } | null>(null);

  const com = useMemo(
    () => comunicaciones.find((c) => c.id === comId),
    [comunicaciones, comId],
  );

  const sugerencia = useMemo(
    () => (com ? sugerenciaPaquete(com.tipo_comunicacion, soTipo) : null),
    [com, soTipo],
  );

  useEffect(() => {
    if (!sugerencia || !com) return;
    setAlcanceTipo(sugerencia.alcance_tipo);
    setItemsText(sugerencia.items.map((i) => `• ${i}`).join('\n'));
  }, [com?.id, sugerencia, com]);

  async function runPreview(fd: FormData) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/supervision/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyFromForm(fd), solo_preview: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo calcular el alcance');
        setPreview(null);
        return;
      }
      setPreview(data.preview);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch('/api/supervision/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyFromForm(fd), generar: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Error al generar paquete');
        return;
      }
      setResult({ numero: data.numero_solicitud, paqueteId: data.paquete?.paqueteId });
      setPreview(data.preview);
    } finally {
      setBusy(false);
    }
  }

  const pendientesEntrega = paquetesGenerados.filter(
    (p) => p.paquete_id && p.estado === 'generada' && (p.entregas ?? 0) === 0,
  );

  const tituloDefault = com
    ? `Respuesta a oficio ${com.numero_oficio ?? ''} — ${labelTipoComunicacion(com.tipo_comunicacion)}`.trim()
    : '';

  return (
    <>
      <div className="card" style={{ marginTop: 18 }} id="generar-paquete">
        <h3 style={{ marginTop: 0 }}>Armar paquete de respuesta a supervisión</h3>
        <p className="small">
          Documente qué ítems del oficio atiende, defina el alcance de expedientes y qué evidencia incluir.
          El JSON generado es el manifiesto formal; documentos fuera de SAGAF se anexan manualmente al envío.
        </p>

        <form onSubmit={onGenerate}>
          <div className="form-grid">
            {/* —— Oficio —— */}
            <div className="field full">
              <label>1. Oficio / comunicación vinculada</label>
              <select
                name="comunicacion_id"
                value={comId}
                onChange={(e) => setComId(e.target.value)}
              >
                <option value="">— Seleccione el oficio que está respondiendo —</option>
                {comunicaciones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_oficio ?? 'Sin número'} · {labelTipoComunicacion(c.tipo_comunicacion)}
                  </option>
                ))}
              </select>
            </div>

            {com && sugerencia && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <strong>Sugerencia según tipo de comunicación ({soTipo === 'bank' ? 'banco' : soTipo}):</strong>
                <p className="small" style={{ margin: '6px 0' }}>{sugerencia.resumen}</p>
                {sugerencia.fuera_de_sagaf && sugerencia.fuera_de_sagaf.length > 0 && (
                  <p className="small" style={{ margin: 0 }}>
                    <em>Anexar manualmente fuera del sistema:</em> {sugerencia.fuera_de_sagaf.join('; ')}
                  </p>
                )}
              </div>
            )}

            {com && (
              <div className="field full" style={{ gridColumn: '1 / -1' }}>
                <div className="small" style={{ display: 'grid', gap: 4, padding: 12, background: 'var(--bg-soft, #f8fafc)', borderRadius: 12 }}>
                  <span><strong>Asunto:</strong> {com.asunto ?? '—'}</span>
                  <span><strong>Plazo:</strong> {com.fecha_limite_respuesta?.slice(0, 10) ?? '—'}</span>
                  <span><strong>Estado:</strong> {com.estado}</span>
                </div>
              </div>
            )}

            {/* —— Identificación de la respuesta —— */}
            <div className="field full">
              <label>2. Título de la respuesta</label>
              <input
                name="titulo_respuesta"
                defaultValue={tituloDefault}
                placeholder="Respuesta a requerimiento inicial — inspección 2026"
              />
            </div>
            <div className="field">
              <label>Responsable (OC)</label>
              <input name="responsable_nombre" defaultValue={responsableNombre} />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input name="responsable_cargo" defaultValue="Oficial de Cumplimiento" />
            </div>

            <div className="field full">
              <label>3. Ítems del oficio que este paquete atiende</label>
              <textarea
                name="items_solicitados"
                rows={5}
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder="Un ítem por línea: p. ej. Listado de ROS del periodo enero–marzo 2026"
              />
            </div>

            {/* —— Alcance —— */}
            <div className="field">
              <label>4. Alcance de expedientes</label>
              <select
                name="alcance_tipo"
                value={alcanceTipo}
                onChange={(e) => setAlcanceTipo(e.target.value)}
              >
                <option value="periodo">Por periodo de recepción</option>
                <option value="lista_ros">Lista explícita de ROS</option>
                <option value="muestra">Muestra aleatoria</option>
              </select>
            </div>
            <div className="field">
              <label>Nivel de contenido</label>
              <select name="nivel_contenido" defaultValue={sugerencia?.nivel_contenido ?? 'resumido'}>
                {NIVELES_CONTENIDO.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>

            {(alcanceTipo === 'periodo') && (
              <>
                <div className="field">
                  <label>Recepción desde</label>
                  <input type="date" name="fecha_desde" required />
                </div>
                <div className="field">
                  <label>Recepción hasta</label>
                  <input type="date" name="fecha_hasta" />
                </div>
              </>
            )}

            {alcanceTipo === 'muestra' && (
              <div className="field">
                <label>Tamaño muestra (máx. 20)</label>
                <input
                  type="number"
                  name="tamano_muestra"
                  min={1}
                  max={20}
                  defaultValue={sugerencia?.tamano_muestra ?? 10}
                />
              </div>
            )}

            {alcanceTipo === 'lista_ros' && (
              <div className="field full">
                <label>Números de ROS citados en el oficio</label>
                <textarea name="lista_ros" rows={4} placeholder="ROS-2026-000001&#10;ROS-2026-000002" />
              </div>
            )}

            {/* —— Contenido —— */}
            <div className="field full">
              <label>5. Evidencia a incluir en el manifiesto</label>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                <label><input type="checkbox" name="incluir_indice_cumplimiento" defaultChecked /> Índice de cumplimiento documental (% docs obligatorios por ROS)</label>
                <label><input type="checkbox" name="incluir_documentos" defaultChecked={sugerencia?.incluir_documentos} /> Metadatos de documentos adjuntos (nombre, tipo, estado)</label>
                <label><input type="checkbox" name="incluir_partes" defaultChecked={sugerencia?.incluir_partes} /> Partes involucradas (identificadores enmascarados)</label>
                <label><input type="checkbox" name="incluir_riesgo" defaultChecked={sugerencia?.incluir_riesgo} /> Clasificación de riesgo UAF</label>
                <label><input type="checkbox" name="incluir_subsanaciones" defaultChecked={sugerencia?.incluir_subsanaciones} /> Historial de subsanaciones</label>
                <label><input type="checkbox" name="incluir_log" defaultChecked={sugerencia?.incluir_log} /> Trazabilidad de acciones sobre los ROS (solo los incluidos)</label>
              </div>
            </div>

            <div className="field full">
              <label>6. Fundamento del alcance</label>
              <textarea
                name="fundamento_alcance"
                rows={3}
                placeholder="Por qué este alcance responde al oficio: periodo citado, casos mencionados, criterio de muestra…"
              />
            </div>
            <div className="field full">
              <label>Notas para el regulador (opcional)</label>
              <textarea
                name="notas_regulatorio"
                rows={2}
                placeholder="Aclaraciones de entrega, referencia a anexos físicos, contacto…"
              />
            </div>

            {preview && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <strong>Vista previa del paquete</strong>
                <div className="small" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  <span>{preview.ros} expedientes ROS</span>
                  <span>{preview.documentos} documentos · {preview.partes} partes · {preview.con_riesgo} con riesgo · {preview.subsanaciones} subsanaciones</span>
                  <span>{preview.eventos_log} eventos de trazabilidad</span>
                  {preview.indice_promedio_docs !== null && (
                    <span>Índice promedio documentación obligatoria: {preview.indice_promedio_docs}%</span>
                  )}
                  {preview.numeros.length > 0 && (
                    <span>{preview.numeros.slice(0, 10).join(', ')}{preview.numeros.length > 10 ? ` … (+${preview.numeros.length - 10})` : ''}</span>
                  )}
                </div>
              </div>
            )}

            {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
            {result && (
              <div className="client-status found" style={{ gridColumn: '1 / -1' }}>
                Paquete <strong>{result.numero}</strong> generado.
                {result.paqueteId && (
                  <> <Link href={`/api/supervision/paquetes/${result.paqueteId}/descargar`}>Descargar manifiesto JSON</Link></>
                )}
              </div>
            )}

            <div className="field full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={(ev) => {
                  const form = (ev.currentTarget as HTMLButtonElement).form;
                  if (form) void runPreview(new FormData(form));
                }}
              >
                {busy ? 'Calculando…' : 'Vista previa del alcance'}
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Generando…' : 'Generar manifiesto del paquete'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {pendientesEntrega.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>7. Registrar entrega externa</h3>
          <p className="small">Indique cómo entregó el paquete al supervisor (SBP, ISRNNF, etc.).</p>
          {pendientesEntrega.map((p) => (
            <EntregaForm key={p.paquete_id!} paqueteId={p.paquete_id!} numeroSolicitud={p.numero_solicitud} />
          ))}
        </div>
      )}
    </>
  );
}
