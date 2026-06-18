'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/Badge';
import { Timeline } from '@/components/Timeline';
import { ConfirmModal } from '@/components/ConfirmModal';
import { maskDescriptionText } from '@/lib/masking';
import { formatPanama } from '@/lib/date';

interface DocReq  { id: string; nombre: string; orden: number }
interface DocAdj  {
  id: string; documento_requerido_id: string | null; nombre_archivo: string;
  estado: string; observacion: string | null; fecha_carga: string;
}
interface Vinc    { id: string; numero_ros: string; tipo_vinculo: string; descripcion: string | null; confirmado: boolean; alto_riesgo?: boolean }
interface AuditEv { title: string; description: string; tone?: 'default' | 'red' | 'amber' | 'green' }
interface SubsRow { id: string; motivo: string; estado: string; fecha_solicitud: string; fecha_limite: string | null; documento_adjunto_id: string | null; documento_requerido_id: string | null }
interface Asignacion { analista_id: string; analista_nombre: string; fecha_asignacion: string; asignado_por_nombre: string }
interface Analista   { id: string; nombre: string }

interface Props {
  rosId: string;
  numeroRos: string;
  canClassify: boolean;
  canClose: boolean;
  canAssign: boolean;
  summary: ReactNode;
  riesgoNode: ReactNode;
  docsReq: DocReq[];
  docsAdj: DocAdj[];
  vinculos: Vinc[];
  auditEvents: AuditEv[];
  subs: SubsRow[];
  asignacion: Asignacion | null;
  analistas: Analista[];
}

type Tab = 'resumen' | 'riesgo' | 'documentos' | 'vinculos' | 'auditoria';

export function RosExpedienteTabs({
  rosId, numeroRos, canClassify, canClose, canAssign,
  summary, riesgoNode, docsReq, docsAdj, vinculos, auditEvents, subs,
  asignacion, analistas,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('resumen');

  // Acciones
  const [busy, setBusy] = useState(false);

  // Clasificación de riesgo
  const [riesgoNivel, setRiesgoNivel] = useState<'alto' | 'medio' | 'bajo'>('alto');
  const [riesgoPuntaje, setRiesgoPuntaje] = useState(0);
  const [riesgoJustif, setRiesgoJustif] = useState('');

  // Cambio de estado
  const [nuevoEstado, setNuevoEstado] = useState<string>('en_analisis');

  // Modales de confirmación
  type ModalKey = 'cerrarRos' | 'observarDoc' | 'noAplicaDoc' | 'solicitarDocPend' | 'confirmarVinc' | 'descartarVinc' | null;
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [pendingDocId, setPendingDocId] = useState<string>('');
  const [pendingDocNombre, setPendingDocNombre] = useState<string>('');
  const [observacionText, setObservacionText] = useState('');
  const [pendingVincId, setPendingVincId] = useState<string>('');
  const [detectando, setDetectando] = useState(false);
  const [detectMsg, setDetectMsg] = useState<{ text: string; tipo: 'ok' | 'info' } | null>(null);
  const [analistaId, setAnalistaId] = useState('');
  const [asignandoBusy, setAsignandoBusy] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [altoRiesgoMsg, setAltoRiesgoMsg] = useState<string | null>(null);

  const TABS: Tab[] = ['resumen', 'riesgo', 'documentos', 'vinculos', 'auditoria'];

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const idx = TABS.indexOf(tab);
    if (e.key === 'ArrowRight') { e.preventDefault(); setTab(TABS[(idx + 1) % TABS.length]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setTab(TABS[(idx - 1 + TABS.length) % TABS.length]); }
    else if (e.key === 'Home') { e.preventDefault(); setTab(TABS[0]); }
    else if (e.key === 'End') { e.preventDefault(); setTab(TABS[TABS.length - 1]); }
  }

  function clearError() { setActionError(null); setAltoRiesgoMsg(null); }

  async function clasificar(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (riesgoJustif.trim().length < 15) { setActionError('La justificación debe tener al menos 15 caracteres.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/riesgo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: riesgoNivel, puntaje: riesgoPuntaje, justificacion: riesgoJustif }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'Error al clasificar.'); return; }
      setRiesgoJustif('');
      router.refresh();
    } finally { setBusy(false); }
  }

  async function observarYSubsanar(docId: string, motivo: string) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const r1 = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'observado', observacion: motivo }),
      });
      if (!r1.ok) { const d = await r1.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo registrar la observación en el documento.'); return; }

      const r2 = await fetch(`/api/ros/${rosId}/subsanacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_adjunto_id: docId, motivo }),
      });
      if (!r2.ok) { const d = await r2.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo crear la solicitud de subsanación.'); return; }

      router.refresh();
    } finally { setBusy(false); }
  }

  async function cambiarEstado(e: React.FormEvent) {
    e.preventDefault();
    if (nuevoEstado === 'cerrado') { setActiveModal('cerrarRos'); return; }
    await doCambiarEstado();
  }

  async function doCambiarEstado() {
    setActiveModal(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo actualizar el estado del ROS.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirObservar(docId: string) {
    setPendingDocId(docId);
    setObservacionText('');
    setActiveModal('observarDoc');
  }

  function abrirSolicitarPendiente(docReqId: string, docNombre: string) {
    setPendingDocId(docReqId);
    setPendingDocNombre(docNombre);
    setObservacionText('');
    setActiveModal('solicitarDocPend');
  }

  async function solicitarDocPendiente(motivo: string) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const r = await fetch(`/api/ros/${rosId}/subsanacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_adjunto_id: null, documento_requerido_id: pendingDocId, motivo }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo enviar la solicitud de documento.'); return; }
      setSolicitudEnviada(true);
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirNoAplica(docId: string) {
    setPendingDocId(docId);
    setActiveModal('noAplicaDoc');
  }

  async function marcarNoAplica(docId: string) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'no_aplica', observacion: 'Marcado como no aplicable por la UAF.' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo marcar el documento como no aplica.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function marcarDocumento(docId: string, estado: 'observado' | 'validado', observacion?: string) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, observacion: observacion ?? null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? `No se pudo marcar el documento como ${estado}.`); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirVinculo(vincId: string, confirmar: boolean) {
    setPendingVincId(vincId);
    setActiveModal(confirmar ? 'confirmarVinc' : 'descartarVinc');
  }

  async function doVinculo(confirmar: boolean) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const res = await fetch(`/api/vinculos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingVincId, confirmado: confirmar }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo actualizar el vínculo.'); return; }
      const data = await res.json().catch(() => ({}));
      if (data.alto_riesgo) {
        setAltoRiesgoMsg('Este vínculo involucra un ROS clasificado como ALTO RIESGO. Se ha registrado con criticidad crítica en auditoría.');
      }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function asignarAnalista(e: React.FormEvent) {
    e.preventDefault();
    if (!analistaId) return;
    clearError();
    setAsignandoBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/asignar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: analistaId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo asignar el analista.'); return; }
      setAnalistaId('');
      router.refresh();
    } finally { setAsignandoBusy(false); }
  }

  async function detectarVinculos() {
    setDetectando(true);
    setDetectMsg(null);
    try {
      const res = await fetch(`/api/vinculos/detectar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ros_id: rosId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDetectMsg({ text: data.error ?? 'Error al detectar vínculos.', tipo: 'info' }); return; }
      if (data.detectados === 0) {
        setDetectMsg({ text: 'No se encontraron coincidencias intersectoriales para este ROS.', tipo: 'info' });
      } else {
        setDetectMsg({ text: `Se detectaron ${data.detectados} vínculo(s) nuevos.`, tipo: 'ok' });
      }
      router.refresh();
    } finally { setDetectando(false); }
  }

  const adjByReq = new Map(docsAdj.filter((d) => d.documento_requerido_id).map((d) => [d.documento_requerido_id!, d]));
  const extras = docsAdj.filter((d) => !d.documento_requerido_id);

  // Subsanaciones pendientes: bloquean acciones sobre el adjunto hasta que sujeto suba corrección
  const pendingSubsByAdjId = new Set(
    subs.filter((s) => s.estado === 'pendiente' && s.documento_adjunto_id).map((s) => s.documento_adjunto_id!),
  );
  // Solicitudes pendientes para docs faltantes: cambia badge a "Solicitado"
  const pendingSubsByDocReqId = new Set(
    subs.filter((s) => s.estado === 'pendiente' && s.documento_requerido_id && !s.documento_adjunto_id).map((s) => s.documento_requerido_id!),
  );

  return (
    <div className="card">
      <div className="tabs" role="tablist" aria-label="Secciones del expediente">
        <button className={`tab ${tab === 'resumen' ? 'active' : ''}`}
          role="tab" aria-selected={tab === 'resumen'} id="tab-resumen" aria-controls="panel-resumen"
          onClick={() => setTab('resumen')} onKeyDown={handleTabKeyDown}>Resumen</button>
        <button className={`tab ${tab === 'riesgo' ? 'active' : ''}`}
          role="tab" aria-selected={tab === 'riesgo'} id="tab-riesgo" aria-controls="panel-riesgo"
          onClick={() => setTab('riesgo')} onKeyDown={handleTabKeyDown}>Riesgo</button>
        <button className={`tab ${tab === 'documentos' ? 'active' : ''}`}
          role="tab" aria-selected={tab === 'documentos'} id="tab-documentos" aria-controls="panel-documentos"
          onClick={() => setTab('documentos')} onKeyDown={handleTabKeyDown}>Documentos ({docsAdj.filter((d) => d.documento_requerido_id).length}/{docsReq.length})</button>
        <button className={`tab ${tab === 'vinculos' ? 'active' : ''}`}
          role="tab" aria-selected={tab === 'vinculos'} id="tab-vinculos" aria-controls="panel-vinculos"
          onClick={() => setTab('vinculos')} onKeyDown={handleTabKeyDown}>Vínculos ({vinculos.length})</button>
        <button className={`tab ${tab === 'auditoria' ? 'active' : ''}`}
          role="tab" aria-selected={tab === 'auditoria'} id="tab-auditoria" aria-controls="panel-auditoria"
          onClick={() => setTab('auditoria')} onKeyDown={handleTabKeyDown}>Auditoría</button>
      </div>

      {actionError && (
        <div className="client-status error" role="alert" style={{ marginBottom: 12 }}>
          {actionError}
          <button onClick={() => setActionError(null)} aria-label="Cerrar error"
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}

      {altoRiesgoMsg && (
        <div className="notice" style={{ marginBottom: 12, borderColor: '#fcd34d', background: '#fffbeb', color: '#7a4b00' }} role="alert">
          <strong>⚠️ Alerta de alto riesgo:</strong> {altoRiesgoMsg}
          <button onClick={() => setAltoRiesgoMsg(null)} aria-label="Cerrar alerta"
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}

      {tab === 'resumen' && (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen" tabIndex={-1}>
          {summary}

          {/* ── Asignación de analista (solo Supervisor) ── */}
          {canAssign && (
            <div className="card" style={{ marginTop: 16, padding: 14 }}>
              <h3 style={{ margin: '0 0 4px' }}>Asignar responsable</h3>
              <p className="small" style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
                Solo el responsable asignado formalmente puede ver y gestionar este expediente (analista o supervisor).
              </p>
              {asignacion ? (
                <div className="notice" style={{ marginBottom: 12 }}>
                  Asignado a <strong>{asignacion.analista_nombre}</strong>
                  {' '}— por {asignacion.asignado_por_nombre} el {formatPanama(asignacion.fecha_asignacion)}
                </div>
              ) : (
                <div className="notice" style={{ marginBottom: 12, color: 'var(--amber)' }}>
                  Sin analista asignado. Este ROS no es visible en la bandeja de ningún analista.
                </div>
              )}
              <form onSubmit={asignarAnalista} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={analistaId}
                  onChange={(e) => setAnalistaId(e.target.value)}
                  style={{ minWidth: 220 }}
                >
                  <option value="">— Seleccionar analista —</option>
                  {analistas.map((a) => (
                    <option key={a.id} value={a.id}
                      style={asignacion?.analista_id === a.id ? { fontWeight: 600 } : undefined}>
                      {a.nombre}{asignacion?.analista_id === a.id ? ' (actual)' : ''}
                    </option>
                  ))}
                </select>
                <button className="btn primary" type="submit"
                  disabled={!analistaId || asignandoBusy || analistaId === asignacion?.analista_id}>
                  {asignacion ? 'Reasignar' : 'Asignar'}
                </button>
              </form>
            </div>
          )}

          {/* ── Asignación visible para analista ── */}
          {!canAssign && asignacion && (
            <div className="notice" style={{ marginTop: 12 }}>
              Este ROS le fue asignado por <strong>{asignacion.asignado_por_nombre}</strong> el {formatPanama(asignacion.fecha_asignacion)}.
            </div>
          )}

          <div className="action-row">
            {canClassify && (
              <form onSubmit={cambiarEstado} style={{ display: 'flex', gap: 8 }}>
                <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                  <option value="en_analisis">En análisis</option>
                  <option value="revision_documental">Revisión documental</option>
                  <option value="subsanacion">Subsanación</option>
                  <option value="escalado">Escalado</option>
                  <option value="vinculado">Vinculado</option>
                  {canClose && <option value="cerrado">Cerrado</option>}
                </select>
                <button className="btn secondary" disabled={busy}>Actualizar estado</button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === 'riesgo' && (
        <div role="tabpanel" id="panel-riesgo" aria-labelledby="tab-riesgo" tabIndex={-1}>
          {riesgoNode}

          {canClassify && (
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Clasificar riesgo</h3>
              <p className="small" style={{ marginBottom: 12 }}>La justificación es obligatoria y queda registrada en auditoría.</p>
              <form onSubmit={clasificar}>
                <div className="form-grid">
                  <div className="field">
                    <label>Nivel</label>
                    <select value={riesgoNivel} onChange={(e) => setRiesgoNivel(e.target.value as 'alto' | 'medio' | 'bajo')}>
                      <option value="alto">Alto</option>
                      <option value="medio">Medio</option>
                      <option value="bajo">Bajo</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Puntaje (0-100)</label>
                    <input type="number" min={0} max={100} value={riesgoPuntaje} onChange={(e) => setRiesgoPuntaje(Number(e.target.value))} />
                  </div>
                  <div className="field full">
                    <label>Justificación</label>
                    <textarea value={riesgoJustif} onChange={(e) => setRiesgoJustif(e.target.value)} placeholder="Justifique los criterios de la clasificación…" required minLength={15} />
                  </div>
                  <div className="field full">
                    <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar clasificación'}</button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === 'documentos' && (
        <div role="tabpanel" id="panel-documentos" aria-labelledby="tab-documentos" tabIndex={-1}>
          {solicitudEnviada && (
            <div className="notice green" style={{ marginBottom: 12 }}>
              Solicitud enviada al sujeto obligado. El ROS pasó a estado «subsanación».
            </div>
          )}
          <div className="doc-summary">
            <div className="info-box"><span className="info-box-label">Recibidos</span><strong>{docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span className="info-box-label">Pendientes</span><strong>{docsReq.length - docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span className="info-box-label">Observados</span><strong>{docsAdj.filter((d) => d.estado === 'observado').length}</strong></div>
          </div>

          <div className="doc-grid">
            {docsReq.map((dr, i) => {
              const adj = adjByReq.get(dr.id);
              const hasPendingSubsOnAdj = adj ? pendingSubsByAdjId.has(adj.id) : false;
              const hasSolicitudPend    = !adj && pendingSubsByDocReqId.has(dr.id);

              const tone =
                adj?.estado === 'validado'  ? 'teal' :
                adj?.estado === 'no_aplica' ? 'gray' :
                adj?.estado === 'observado' ? 'red' :
                adj?.estado === 'cargado'   ? 'green' :
                hasSolicitudPend            ? 'purple' : 'amber';
              const badgeLabel =
                hasSolicitudPend ? 'Solicitado' : (adj?.estado ?? 'pendiente');
              const klass = adj?.estado === 'observado' ? 'observed' : adj?.estado === 'validado' ? 'validated' : adj?.estado === 'cargado' ? 'uploaded' : '';

              return (
                <div key={dr.id} className={`doc-card ${klass}`}>
                  <div className="doc-top">
                    <div className="doc-title">{i + 1}. {dr.nombre}</div>
                    <Badge tone={tone as 'teal' | 'red' | 'green' | 'amber' | 'purple'}>{badgeLabel}</Badge>
                  </div>
                  {adj ? (
                    <>
                      {adj.estado === 'no_aplica' ? (
                        <div className="client-status info">
                          <strong>No aplica</strong> — {adj.observacion ?? 'Declarado como no aplicable.'}
                        </div>
                      ) : (
                        <>
                          <div className="file-name">Archivo: {adj.nombre_archivo}</div>
                          <div className="small">Recibido: {formatPanama(adj.fecha_carga)}</div>
                          {adj.observacion && (
                            <div className="client-status warning">
                              <strong>Observación:</strong> {adj.observacion}
                            </div>
                          )}
                        </>
                      )}
                      {adj.estado !== 'validado' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {adj.estado !== 'no_aplica' && (
                            <a href={`/api/documentos/${adj.id}/file`} target="_blank" className="btn ghost" rel="noreferrer">Ver</a>
                          )}
                          {hasPendingSubsOnAdj ? (
                            <span className="small" style={{ color: 'var(--amber)', fontStyle: 'italic' }}>
                              Esperando corrección del sujeto obligado…
                            </span>
                          ) : (
                            <>
                              <button className="btn green"
                                onClick={() => marcarDocumento(adj.id, 'validado')}
                                disabled={busy}>Validar</button>
                              {adj.estado !== 'no_aplica' && (
                                <>
                                  <button className="btn amber"
                                    onClick={() => abrirObservar(adj.id)}
                                    disabled={busy}>Observar</button>
                                  <button className="btn ghost"
                                    onClick={() => abrirNoAplica(adj.id)}
                                    disabled={busy}>No aplica</button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="helper">
                        {hasSolicitudPend
                          ? 'Solicitud enviada. Esperando que el sujeto obligado cargue el documento.'
                          : 'Pendiente. El sujeto obligado no ha cargado este documento.'}
                      </div>
                      {canClassify && !hasSolicitudPend && (
                        <div style={{ marginTop: 8 }}>
                          <button className="btn amber"
                            onClick={() => abrirSolicitarPendiente(dr.id, dr.nombre)}
                            disabled={busy}>Solicitar documento</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {extras.length > 0 && (
            <>
              <h3 style={{ marginTop: 18, marginBottom: 8 }}>Evidencia adicional</h3>
              <div className="doc-grid">
                {extras.map((e) => (
                  <div key={e.id} className="doc-card">
                    <div className="doc-top">
                      <div className="doc-title">{e.nombre_archivo}</div>
                      <Badge tone="gray">extra</Badge>
                    </div>
                    <div className="small">Recibido: {formatPanama(e.fecha_carga)}</div>
                    <a href={`/api/documentos/${e.id}/file`} target="_blank" className="btn ghost" rel="noreferrer">Ver</a>
                  </div>
                ))}
              </div>
            </>
          )}

          {subs.length > 0 && (
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Subsanaciones de este expediente</h3>
              <Timeline events={subs.map((s) => ({
                title: `Subsanación #${s.id.slice(0, 8)} · ${s.estado}`,
                description: `${s.motivo} — Solicitada: ${formatPanama(s.fecha_solicitud)}${s.fecha_limite ? ` · Límite: ${formatPanama(s.fecha_limite)}` : ''}`,
                tone: s.estado === 'vencida' ? 'red' : s.estado === 'pendiente' ? 'amber' : 'green',
              }))} />
            </div>
          )}
        </div>
      )}

      {tab === 'vinculos' && (
        <div role="tabpanel" id="panel-vinculos" aria-labelledby="tab-vinculos" tabIndex={-1}>
          <div className="action-row" style={{ marginBottom: 8 }}>
            <button className="btn primary" onClick={detectarVinculos} disabled={detectando || busy}>
              {detectando ? 'Detectando…' : 'Detectar vínculos automáticamente'}
            </button>
          </div>

          {detectMsg && (
            <div className={`notice${detectMsg.tipo === 'ok' ? ' green' : ''}`} style={{ marginBottom: 12 }}>
              {detectMsg.text}
            </div>
          )}

          {vinculos.length === 0 ? (
            <div className="notice">No se detectaron vínculos para este ROS.</div>
          ) : (
            <div className="report-list">
              {vinculos.map((v) => (
                <div key={v.id} className="report-item" style={{ cursor: 'default' }}>
                  <div className="report-top">
                    <strong>↔ {v.numero_ros}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {v.alto_riesgo && <Badge tone="red">Alto riesgo</Badge>}
                      <Badge tone={v.confirmado ? 'green' : 'amber'}>{v.confirmado ? 'Confirmado' : 'Por validar'}</Badge>
                    </div>
                  </div>
                  <div className="report-meta">
                    <span><strong>Tipo:</strong> {v.tipo_vinculo}</span>
                    {v.descripcion && <span>{maskDescriptionText(v.descripcion)}</span>}
                  </div>
                  <div className="action-row">
                    {!v.confirmado && (
                      <>
                        <button className="btn green" onClick={() => abrirVinculo(v.id, true)}  disabled={busy}>Confirmar vínculo</button>
                        <button className="btn red"   onClick={() => abrirVinculo(v.id, false)} disabled={busy}>Descartar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="notice" style={{ marginTop: 12 }}>
            Las vinculaciones detectadas automáticamente <strong>no se consolidan sin revisión y validación humana</strong>.
          </div>
        </div>
      )}

      {tab === 'auditoria' && (
        <div role="tabpanel" id="panel-auditoria" aria-labelledby="tab-auditoria" tabIndex={-1}>
          {auditEvents.length === 0 ? (
            <div className="notice">Sin eventos auditables para este ROS aún.</div>
          ) : (
            <Timeline events={auditEvents} />
          )}
          <div className="notice" style={{ marginTop: 12 }}>
            El log de auditoría es <strong>inmutable</strong>. La hora de cada evento es generada por el servidor.
          </div>
        </div>
      )}

      {/* ── Modales de confirmación ── */}
      <ConfirmModal
        isOpen={activeModal === 'cerrarRos'}
        variant="danger"
        title="¿Cerrar este ROS?"
        message={`El ROS ${numeroRos} pasará a estado Cerrado de forma definitiva. Solo un supervisor puede ejecutar esta acción y queda registrada en auditoría.`}
        confirmLabel="Sí, cerrar ROS"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={doCambiarEstado}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'observarDoc'}
        variant="warning"
        title="Solicitar subsanación"
        message="Describe el problema. El documento quedará marcado como observado y se enviará la solicitud de subsanación al sujeto obligado."
        confirmLabel="Enviar Subsanación"
        cancelLabel="Cancelar"
        busy={busy}
        input={{
          label: `Motivo de la subsanación (mín. 10 caracteres · ${observacionText.trim().length}/10)`,
          placeholder: 'Ej: El archivo está ilegible, por favor cargue una versión legible…',
          required: true,
          minLength: 10,
          value: observacionText,
          onChange: setObservacionText,
        }}
        onConfirm={() => observarYSubsanar(pendingDocId, observacionText)}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'noAplicaDoc'}
        variant="info"
        title="¿Marcar documento como no aplica?"
        message="El documento quedará marcado como 'no aplica'. Podrás validarlo más adelante si el sujeto obligado lo envía."
        confirmLabel="Sí, marcar no aplica"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={() => marcarNoAplica(pendingDocId)}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'solicitarDocPend'}
        variant="warning"
        title={`Solicitar documento faltante`}
        message={`El documento "${pendingDocNombre}" está pendiente. Indica el motivo de la solicitud para notificar al sujeto obligado.`}
        confirmLabel="Enviar solicitud"
        cancelLabel="Cancelar"
        busy={busy}
        input={{
          label: `Motivo de la solicitud (mín. 10 caracteres · ${observacionText.trim().length}/10)`,
          placeholder: 'Ej: Este documento es requerido para continuar el análisis del expediente…',
          required: true,
          minLength: 10,
          value: observacionText,
          onChange: setObservacionText,
        }}
        onConfirm={() => solicitarDocPendiente(observacionText)}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'confirmarVinc'}
        variant="success"
        title="¿Confirmar vínculo intersectorial?"
        message="Se registrará el vínculo como confirmado y el estado del ROS cambiará a 'Vinculado'. Esta acción queda en auditoría."
        confirmLabel="Sí, confirmar vínculo"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={() => doVinculo(true)}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'descartarVinc'}
        variant="warning"
        title="¿Descartar vínculo?"
        message="El vínculo detectado automáticamente será descartado. Esta acción queda registrada en auditoría."
        confirmLabel="Sí, descartar"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={() => doVinculo(false)}
        onCancel={() => setActiveModal(null)}
      />
    </div>
  );
}
