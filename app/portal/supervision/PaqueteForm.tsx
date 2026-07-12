'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NIVELES_CONTENIDO, labelTipoComunicacion } from '@/lib/supervision/constants';
import { sugerenciaPaquete } from '@/lib/supervision/catalogo';
import type { AlcanceFormSugerido } from '@/lib/supervision/aplicar-alcance';
import { EntregaForm } from './EntregaForm';
import { PaqueteDownloadLinks } from './PaqueteDownloadLinks';

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

function itemsToText(items: string[]): string {
  return items.map((i) => (i.startsWith('•') ? i : `• ${i}`)).join('\n');
}

function applyAlcance(
  alcance: AlcanceFormSugerido,
  setters: {
    setAlcanceTipo: (v: string) => void;
    setFechaDesde: (v: string) => void;
    setFechaHasta: (v: string) => void;
    setListaRos: (v: string) => void;
    setTamanoMuestra: (v: number) => void;
    setNivelContenido: (v: string) => void;
    setItemsText: (v: string) => void;
    setFundamento: (v: string) => void;
    setNotas: (v: string) => void;
    setIncluirDocumentos: (v: boolean) => void;
    setIncluirLog: (v: boolean) => void;
    setIncluirPartes: (v: boolean) => void;
    setIncluirRiesgo: (v: boolean) => void;
    setIncluirSubsanaciones: (v: boolean) => void;
    setIncluirIndice: (v: boolean) => void;
  },
) {
  setters.setAlcanceTipo(alcance.alcance_tipo);
  if (alcance.fecha_desde) setters.setFechaDesde(alcance.fecha_desde);
  if (alcance.fecha_hasta) setters.setFechaHasta(alcance.fecha_hasta);
  if (alcance.lista_ros?.length) setters.setListaRos(alcance.lista_ros.join('\n'));
  if (alcance.tamano_muestra) setters.setTamanoMuestra(alcance.tamano_muestra);
  setters.setNivelContenido(alcance.nivel_contenido);
  if (alcance.items_solicitados.length) setters.setItemsText(itemsToText(alcance.items_solicitados));
  if (alcance.fundamento_alcance) setters.setFundamento(alcance.fundamento_alcance);
  if (alcance.notas_regulatorio) setters.setNotas(alcance.notas_regulatorio);
  setters.setIncluirDocumentos(alcance.incluir_documentos);
  setters.setIncluirLog(alcance.incluir_log);
  setters.setIncluirPartes(alcance.incluir_partes);
  setters.setIncluirRiesgo(alcance.incluir_riesgo);
  setters.setIncluirSubsanaciones(alcance.incluir_subsanaciones);
  setters.setIncluirIndice(alcance.incluir_indice_cumplimiento);
}

function bodyFromState(state: {
  comId: string;
  tituloRespuesta: string;
  responsableNombre: string;
  responsableCargo: string;
  itemsText: string;
  fundamento: string;
  notas: string;
  alcanceTipo: string;
  fechaDesde: string;
  fechaHasta: string;
  listaRos: string;
  tamanoMuestra: number;
  nivelContenido: string;
  incluirIndice: boolean;
  incluirDocumentos: boolean;
  incluirPartes: boolean;
  incluirRiesgo: boolean;
  incluirSubsanaciones: boolean;
  incluirLog: boolean;
}) {
  const lista = state.listaRos
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    comunicacion_id: state.comId || undefined,
    titulo_respuesta: state.tituloRespuesta || undefined,
    items_solicitados_texto: state.itemsText || undefined,
    fundamento_alcance: state.fundamento || undefined,
    notas_regulatorio: state.notas || undefined,
    responsable_nombre: state.responsableNombre || undefined,
    responsable_cargo: state.responsableCargo || undefined,
    alcance_tipo: state.alcanceTipo,
    fecha_desde: state.fechaDesde || undefined,
    fecha_hasta: state.fechaHasta || undefined,
    lista_ros: lista.length ? lista : undefined,
    tamano_muestra: state.alcanceTipo === 'muestra' ? state.tamanoMuestra : undefined,
    nivel_contenido: state.nivelContenido,
    incluir_log: state.incluirLog,
    incluir_documentos: state.incluirDocumentos,
    incluir_partes: state.incluirPartes,
    incluir_riesgo: state.incluirRiesgo,
    incluir_subsanaciones: state.incluirSubsanaciones,
    incluir_indice_cumplimiento: state.incluirIndice,
  };
}

export function PaqueteForm({ comunicaciones, paquetesGenerados, soTipo, responsableNombre }: Props) {
  const searchParams = useSearchParams();
  const defaultCom = searchParams.get('comunicacion') ?? '';

  const [comId, setComId] = useState(defaultCom);
  const [alcanceTipo, setAlcanceTipo] = useState('periodo');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [listaRos, setListaRos] = useState('');
  const [tamanoMuestra, setTamanoMuestra] = useState(10);
  const [nivelContenido, setNivelContenido] = useState('resumido');
  const [itemsText, setItemsText] = useState('');
  const [fundamento, setFundamento] = useState('');
  const [notas, setNotas] = useState('');
  const [tituloRespuesta, setTituloRespuesta] = useState('');
  const [responsableCargo, setResponsableCargo] = useState('Oficial de Cumplimiento');
  const [incluirIndice, setIncluirIndice] = useState(true);
  const [incluirDocumentos, setIncluirDocumentos] = useState(true);
  const [incluirPartes, setIncluirPartes] = useState(true);
  const [incluirRiesgo, setIncluirRiesgo] = useState(true);
  const [incluirSubsanaciones, setIncluirSubsanaciones] = useState(true);
  const [incluirLog, setIncluirLog] = useState(false);

  const [busy, setBusy] = useState(false);
  const [loadingAlcance, setLoadingAlcance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alcanceNota, setAlcanceNota] = useState<string | null>(null);
  const [alcanceSugerido, setAlcanceSugerido] = useState<AlcanceFormSugerido | null>(null);
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

  const alcanceSetters = {
    setAlcanceTipo,
    setFechaDesde,
    setFechaHasta,
    setListaRos,
    setTamanoMuestra,
    setNivelContenido,
    setItemsText,
    setFundamento,
    setNotas,
    setIncluirDocumentos,
    setIncluirLog,
    setIncluirPartes,
    setIncluirRiesgo,
    setIncluirSubsanaciones,
    setIncluirIndice,
  };

  useEffect(() => {
    if (!comId) {
      setAlcanceNota(null);
      return;
    }

    const comLocal = comunicaciones.find((c) => c.id === comId);
    if (comLocal) {
      setTituloRespuesta(
        `Respuesta a oficio ${comLocal.numero_oficio ?? ''} — ${labelTipoComunicacion(comLocal.tipo_comunicacion)}`.trim(),
      );
    }

    let cancelled = false;
    setLoadingAlcance(true);
    setAlcanceNota(null);

    void (async () => {
      try {
        const res = await fetch(`/api/supervision/comunicaciones/${comId}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;

        if (data.alcance_paquete) {
          const sugerido = data.alcance_paquete as AlcanceFormSugerido;
          setAlcanceSugerido(sugerido);
          applyAlcance(sugerido, alcanceSetters);
          const partes: string[] = [];
          const a = sugerido;
          if (a.fecha_desde && a.fecha_hasta) {
            partes.push(`Periodo: ${a.fecha_desde} → ${a.fecha_hasta}`);
          }
          if (a.lista_ros?.length) {
            partes.push(`${a.lista_ros.length} ROS detectados en el oficio`);
          }
          if (partes.length) {
            setAlcanceNota(`Autocompletado desde OCR: ${partes.join(' · ')}`);
          } else if (sugerenciaPaquete(data.tipo_comunicacion, soTipo)) {
            setAlcanceNota('Campos sugeridos según tipo de comunicación y catálogo regulatorio.');
          }
        } else if (comLocal) {
          const cat = sugerenciaPaquete(comLocal.tipo_comunicacion, soTipo);
          setAlcanceTipo(cat.alcance_tipo);
          setItemsText(itemsToText(cat.items));
          setNivelContenido(cat.nivel_contenido);
          setTamanoMuestra(cat.tamano_muestra ?? 10);
          setIncluirDocumentos(cat.incluir_documentos);
          setIncluirLog(cat.incluir_log);
          setIncluirPartes(cat.incluir_partes);
          setIncluirRiesgo(cat.incluir_riesgo);
          setIncluirSubsanaciones(cat.incluir_subsanaciones);
          setIncluirIndice(cat.incluir_indice_cumplimiento);
          setAlcanceNota('Sugerencia según tipo de comunicación (sin datos OCR).');
        }
      } finally {
        if (!cancelled) setLoadingAlcance(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar oficio
  }, [comId, comunicaciones, soTipo]);

  async function runPreview() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/supervision/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bodyFromState({
            comId,
            tituloRespuesta,
            responsableNombre,
            responsableCargo,
            itemsText,
            fundamento,
            notas,
            alcanceTipo,
            fechaDesde,
            fechaHasta,
            listaRos,
            tamanoMuestra,
            nivelContenido,
            incluirIndice,
            incluirDocumentos,
            incluirPartes,
            incluirRiesgo,
            incluirSubsanaciones,
            incluirLog,
          }),
          solo_preview: true,
        }),
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
      const res = await fetch('/api/supervision/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bodyFromState({
            comId,
            tituloRespuesta,
            responsableNombre,
            responsableCargo,
            itemsText,
            fundamento,
            notas,
            alcanceTipo,
            fechaDesde,
            fechaHasta,
            listaRos,
            tamanoMuestra,
            nivelContenido,
            incluirIndice,
            incluirDocumentos,
            incluirPartes,
            incluirRiesgo,
            incluirSubsanaciones,
            incluirLog,
          }),
          generar: true,
        }),
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

  return (
    <>
      <div className="card" style={{ marginTop: 18 }} id="generar-paquete">
        <h3 style={{ marginTop: 0 }}>Armar paquete de respuesta a supervisión</h3>
        <p className="small">
          Seleccione el oficio: el sistema cargará periodo, lista de ROS y demás campos desde el OCR guardado.
          Revise antes de generar el manifiesto.
        </p>

        <form onSubmit={onGenerate}>
          <div className="form-grid">
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
              {loadingAlcance && <p className="small" style={{ marginTop: 6 }}>Cargando alcance desde el oficio…</p>}
            </div>

            {alcanceNota && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <strong>Alcance detectado</strong>
                <p className="small" style={{ margin: '6px 0 0' }}>{alcanceNota}</p>
                {alcanceSugerido && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ marginTop: 10, fontSize: 12, padding: '6px 12px' }}
                    disabled={loadingAlcance}
                    onClick={() => applyAlcance(alcanceSugerido, alcanceSetters)}
                  >
                    Volver a llenar desde el oficio
                  </button>
                )}
              </div>
            )}

            {com && sugerencia && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <strong>Sugerencia según tipo ({soTipo === 'bank' ? 'banco' : soTipo}):</strong>
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

            <div className="field full">
              <label>2. Título de la respuesta</label>
              <input
                name="titulo_respuesta"
                value={tituloRespuesta}
                onChange={(e) => setTituloRespuesta(e.target.value)}
                placeholder="Respuesta a requerimiento inicial — inspección 2026"
              />
            </div>
            <div className="field">
              <label>Responsable (OC)</label>
              <input name="responsable_nombre" value={responsableNombre} readOnly />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input
                name="responsable_cargo"
                value={responsableCargo}
                onChange={(e) => setResponsableCargo(e.target.value)}
              />
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
              <select
                name="nivel_contenido"
                value={nivelContenido}
                onChange={(e) => setNivelContenido(e.target.value)}
              >
                {NIVELES_CONTENIDO.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>

            {alcanceTipo === 'periodo' && (
              <>
                <div className="field">
                  <label>Recepción desde</label>
                  <input
                    type="date"
                    name="fecha_desde"
                    required
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                  <p className="small" style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                    Primera fecha en que el banco <em>recibió</em> el ROS en SAGAF (no la fecha del hecho).
                    Suele coincidir con el periodo que pide el oficio.
                  </p>
                </div>
                <div className="field">
                  <label>Recepción hasta</label>
                  <input
                    type="date"
                    name="fecha_hasta"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                  <p className="small" style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                    Último día del periodo solicitado. Ejemplo demo SBP-01: 2026-01-01 a 2026-06-30.
                  </p>
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
                  value={tamanoMuestra}
                  onChange={(e) => setTamanoMuestra(Number(e.target.value))}
                />
              </div>
            )}

            {alcanceTipo === 'lista_ros' && (
              <div className="field full">
                <label>Números de ROS citados en el oficio</label>
                <textarea
                  name="lista_ros"
                  rows={4}
                  value={listaRos}
                  onChange={(e) => setListaRos(e.target.value)}
                  placeholder="ROS-2026-000001&#10;ROS-2026-000002"
                />
              </div>
            )}

            <div className="field full">
              <label>5. Evidencia a incluir en el manifiesto</label>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_indice_cumplimiento"
                    checked={incluirIndice}
                    onChange={(e) => setIncluirIndice(e.target.checked)}
                  />{' '}
                  Índice de cumplimiento documental (% docs obligatorios por ROS)
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_documentos"
                    checked={incluirDocumentos}
                    onChange={(e) => setIncluirDocumentos(e.target.checked)}
                  />{' '}
                  Metadatos de documentos adjuntos (nombre, tipo, estado)
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_partes"
                    checked={incluirPartes}
                    onChange={(e) => setIncluirPartes(e.target.checked)}
                  />{' '}
                  Partes involucradas (identificadores enmascarados)
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_riesgo"
                    checked={incluirRiesgo}
                    onChange={(e) => setIncluirRiesgo(e.target.checked)}
                  />{' '}
                  Clasificación de riesgo UAF
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_subsanaciones"
                    checked={incluirSubsanaciones}
                    onChange={(e) => setIncluirSubsanaciones(e.target.checked)}
                  />{' '}
                  Historial de subsanaciones
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="incluir_log"
                    checked={incluirLog}
                    onChange={(e) => setIncluirLog(e.target.checked)}
                  />{' '}
                  Trazabilidad de acciones sobre los ROS (solo los incluidos)
                </label>
              </div>
            </div>

            <div className="field full">
              <label>6. Fundamento del alcance</label>
              <textarea
                name="fundamento_alcance"
                rows={3}
                value={fundamento}
                onChange={(e) => setFundamento(e.target.value)}
                placeholder="Se completa solo al elegir el oficio. Explique en una frase por qué este alcance responde al requerimiento."
              />
              <p className="small" style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                Texto breve para el manifiesto: qué periodo o qué ROS incluye y por qué, citando el oficio.
                No hace falta redactarlo usted si el OCR lo detectó — puede editarlo si quiere.
              </p>
            </div>
            <div className="field full">
              <label>Notas para el regulador (opcional)</label>
              <textarea
                name="notas_regulatorio"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Referencia al número de oficio, plazo y aclaraciones de entrega."
              />
              <p className="small" style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                Opcional. Suele incluir número de oficio, plazo de respuesta y si hay anexos fuera del sistema.
                Puede dejarlo como está o borrarlo si no aplica.
              </p>
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
                <p style={{ margin: '0 0 12px' }}>
                  Paquete <strong>{result.numero}</strong> generado correctamente.
                </p>
                {result.paqueteId && <PaqueteDownloadLinks paqueteId={result.paqueteId} />}
              </div>
            )}

            <div className="field full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy || loadingAlcance}
                onClick={() => void runPreview()}
              >
                {busy ? 'Calculando…' : 'Vista previa del alcance'}
              </button>
              <button type="submit" className="btn primary" disabled={busy || loadingAlcance}>
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
