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

interface DocCardItemProps {
  dr: DocReq; index: number; adj: DocAdj | undefined;
  pendingSubsByAdjId: Set<string>; pendingSubsByDocReqId: Set<string>;
  canClassify: boolean; busy: boolean;
  onMarcar: (docId: string, estado: 'observado' | 'validado') => void;
  onObservar: (docId: string) => void;
  onNoAplica: (docId: string) => void;
  onSolicitar: (docReqId: string, docNombre: string) => void;
}

function DocCardItem({ dr, index, adj, pendingSubsByAdjId, pendingSubsByDocReqId, canClassify, busy, onMarcar, onObservar, onNoAplica, onSolicitar }: DocCardItemProps) {
  const hasPendingSubsOnAdj = adj ? pendingSubsByAdjId.has(adj.id) : false;
  const hasSolicitudPend    = !adj && pendingSubsByDocReqId.has(dr.id);

  let tone: 'teal' | 'gray' | 'red' | 'green' | 'purple' | 'amber';
  if (adj?.estado === 'validado') tone = 'teal';
  else if (adj?.estado === 'no_aplica') tone = 'gray';
  else if (adj?.estado === 'observado') tone = 'red';
  else if (adj?.estado === 'cargado') tone = 'green';
  else if (hasSolicitudPend) tone = 'purple';
  else tone = 'amber';

  const badgeLabel = hasSolicitudPend ? 'Solicitado' : (adj?.estado ?? 'pendiente');

  let klass: string;
  if (adj?.estado === 'observado') klass = 'observed';
  else if (adj?.estado === 'validado') klass = 'validated';
  else if (adj?.estado === 'cargado') klass = 'uploaded';
  else klass = '';

  return (
    <div key={dr.id} className={`doc-card ${klass}`}>
      <div className="doc-top">
        <div className="doc-title">{index}. {dr.nombre}</div>
        <Badge tone={tone}>{badgeLabel}</Badge>
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
                  <button className="btn green" onClick={() => onMarcar(adj.id, 'validado')} disabled={busy}>Validar</button>
                  {adj.estado !== 'no_aplica' && (
                    <>
                      <button className="btn amber" onClick={() => onObservar(adj.id)} disabled={busy}>Observar</button>
                      <button className="btn ghost" onClick={() => onNoAplica(adj.id)} disabled={busy}>No aplica</button>
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
              <button className="btn amber" onClick={() => onSolicitar(dr.id, dr.nombre)} disabled={busy}>Solicitar documento</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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

  async function clasificar(e: React.FormEvent) {
    e.preventDefault();
    if (riesgoJustif.trim().length < 15) { alert('La justificación debe tener al menos 15 caracteres.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/riesgo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: riesgoNivel, puntaje: riesgoPuntaje, justificacion: riesgoJustif }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error al clasificar.'); return; }
      setRiesgoJustif('');
      router.refresh();
    } finally { setBusy(false); }
  }

  async function observarYSubsanar(docId: string, motivo: string) {
    setActiveModal(null);
    setBusy(true);
    try {
      const r1 = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'observado', observacion: motivo }),
      });
      if (!r1.ok) { const d = await r1.json().catch(() => ({})); alert(d.error ?? 'Error al observar documento.'); return; }

      const r2 = await fetch(`/api/ros/${rosId}/subsanacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_adjunto_id: docId, motivo }),
      });
      if (!r2.ok) { const d = await r2.json().catch(() => ({})); alert(d.error ?? 'Error al crear subsanación.'); return; }

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
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error.'); return; }
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
    setBusy(true);
    try {
      const r = await fetch(`/api/ros/${rosId}/subsanacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_adjunto_id: null, documento_requerido_id: pendingDocId, motivo }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Error al solicitar subsanación.'); return; }
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
    setBusy(true);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'no_aplica', observacion: 'Marcado como no aplicable por la UAF.' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function marcarDocumento(docId: string, estado: 'observado' | 'validado', observacion?: string) {
    setActiveModal(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, observacion: observacion ?? null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirVinculo(vincId: string, confirmar: boolean) {
    setPendingVincId(vincId);
    setActiveModal(confirmar ? 'confirmarVinc' : 'descartarVinc');
  }

  async function doVinculo(confirmar: boolean) {
    setActiveModal(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/vinculos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingVincId, confirmado: confirmar }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error.'); return; }
      const data = await res.json().catch(() => ({}));
      if (data.alto_riesgo) {
        alert('⚠️ Alerta: este vínculo involucra un ROS clasificado como ALTO RIESGO. Se ha registrado con criticidad crítica en auditoría.');
      }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function asignarAnalista(e: React.FormEvent) {
    e.preventDefault();
    if (!analistaId) return;
    setAsignandoBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/asignar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: analistaId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error al asignar.'); return; }
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
      <div className="tabs">
        <button className={`tab ${tab === 'resumen' ? 'active' : ''}`}     onClick={() => setTab('resumen')}>Resumen</button>
        <button className={`tab ${tab === 'riesgo' ? 'active' : ''}`}      onClick={() => setTab('riesgo')}>Riesgo</button>
        <button className={`tab ${tab === 'documentos' ? 'active' : ''}`}  onClick={() => setTab('documentos')}>Documentos ({docsAdj.length}/{docsReq.length})</button>
        <button className={`tab ${tab === 'vinculos' ? 'active' : ''}`}    onClick={() => setTab('vinculos')}>Vínculos ({vinculos.length})</button>
        <button className={`tab ${tab === 'auditoria' ? 'active' : ''}`}   onClick={() => setTab('auditoria')}>Auditoría</button>
      </div>

      {tab === 'resumen' && (
        <>
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
        </>
      )}

      {tab === 'riesgo' && (
        <>
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
        </>
      )}

      {tab === 'documentos' && (
        <>
          {solicitudEnviada && (
            <div className="notice green" style={{ marginBottom: 12 }}>
              Solicitud enviada al sujeto obligado. El ROS pasó a estado «subsanación».
            </div>
          )}
          <div className="doc-summary">
            <div className="info-box"><span>Recibidos</span><strong>{docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span>Pendientes</span><strong>{docsReq.length - docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span>Observados</span><strong>{docsAdj.filter((d) => d.estado === 'observado').length}</strong></div>
          </div>

          <div className="doc-grid">
            {docsReq.map((dr, i) => (
              <DocCardItem
                key={dr.id} dr={dr} index={i + 1} adj={adjByReq.get(dr.id)}
                pendingSubsByAdjId={pendingSubsByAdjId} pendingSubsByDocReqId={pendingSubsByDocReqId}
                canClassify={canClassify} busy={busy}
                onMarcar={marcarDocumento} onObservar={abrirObservar}
                onNoAplica={abrirNoAplica} onSolicitar={abrirSolicitarPendiente}
              />
            ))}
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
              <Timeline events={subs.map((s) => {
                const limiteStr = s.fecha_limite ? ` · Límite: ${formatPanama(s.fecha_limite)}` : '';
                let subsTone: 'red' | 'amber' | 'green';
                if (s.estado === 'vencida') subsTone = 'red';
                else if (s.estado === 'pendiente') subsTone = 'amber';
                else subsTone = 'green';
                return {
                  title: `Subsanación #${s.id.slice(0, 8)} · ${s.estado}`,
                  description: `${s.motivo} — Solicitada: ${formatPanama(s.fecha_solicitud)}${limiteStr}`,
                  tone: subsTone,
                };
              })} />
            </div>
          )}
        </>
      )}

      {tab === 'vinculos' && (
        <>
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
        </>
      )}

      {tab === 'auditoria' && (
        <>
          {auditEvents.length === 0 ? (
            <div className="notice">Sin eventos auditables para este ROS aún.</div>
          ) : (
            <Timeline events={auditEvents} />
          )}
          <div className="notice" style={{ marginTop: 12 }}>
            El log de auditoría es <strong>inmutable</strong>. La hora de cada evento es generada por el servidor.
          </div>
        </>
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
