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
interface SubsRow { id: string; motivo: string; estado: string; fecha_solicitud: string; documento_adjunto_id: string | null }

interface Props {
  rosId: string;
  numeroRos: string;
  canClassify: boolean;
  canClose: boolean;
  summary: ReactNode;
  riesgoNode: ReactNode;
  docsReq: DocReq[];
  docsAdj: DocAdj[];
  vinculos: Vinc[];
  auditEvents: AuditEv[];
  subs: SubsRow[];
}

type Tab = 'resumen' | 'riesgo' | 'documentos' | 'vinculos' | 'auditoria';

export function RosExpedienteTabs({
  rosId, numeroRos, canClassify, canClose,
  summary, riesgoNode, docsReq, docsAdj, vinculos, auditEvents, subs,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('resumen');

  // Acciones
  const [busy, setBusy] = useState(false);

  // Clasificación de riesgo
  const [riesgoNivel, setRiesgoNivel] = useState<'alto' | 'medio' | 'bajo'>('alto');
  const [riesgoPuntaje, setRiesgoPuntaje] = useState(0);
  const [riesgoJustif, setRiesgoJustif] = useState('');

  // Subsanación
  const [subDocId, setSubDocId] = useState<string>('');
  const [subMotivo, setSubMotivo] = useState('');

  // Cambio de estado
  const [nuevoEstado, setNuevoEstado] = useState<string>('en_analisis');

  // Modales de confirmación
  type ModalKey = 'cerrarRos' | 'observarDoc' | 'confirmarVinc' | 'descartarVinc' | null;
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [pendingDocId, setPendingDocId] = useState<string>('');
  const [observacionText, setObservacionText] = useState('');
  const [pendingVincId, setPendingVincId] = useState<string>('');
  const [detectando, setDetectando] = useState(false);

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

  async function solicitarSubsanacion(e: React.FormEvent) {
    e.preventDefault();
    if (subMotivo.trim().length < 10) { alert('El motivo debe tener al menos 10 caracteres.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/subsanacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_adjunto_id: subDocId || null, motivo: subMotivo }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error.'); return; }
      setSubMotivo(''); setSubDocId('');
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

  async function detectarVinculos() {
    setDetectando(true);
    try {
      const res = await fetch(`/api/vinculos/detectar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ros_id: rosId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? 'Error al detectar vínculos.'); return; }
      if (data.detectados === 0) {
        alert('No se encontraron coincidencias intersectoriales para este ROS.');
      } else {
        alert(`Se detectaron ${data.detectados} vínculo(s). Revísalos en la pestaña de Vínculos.`);
      }
      router.refresh();
    } finally { setDetectando(false); }
  }

  const adjByReq = new Map(docsAdj.filter((d) => d.documento_requerido_id).map((d) => [d.documento_requerido_id!, d]));
  const extras = docsAdj.filter((d) => !d.documento_requerido_id);

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
          <div className="doc-summary">
            <div className="info-box"><span>Recibidos</span><strong>{docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span>Pendientes</span><strong>{docsReq.length - docsAdj.filter((d) => d.documento_requerido_id).length}</strong></div>
            <div className="info-box"><span>Observados</span><strong>{docsAdj.filter((d) => d.estado === 'observado').length}</strong></div>
          </div>

          <div className="doc-grid">
            {docsReq.map((dr, i) => {
              const adj = adjByReq.get(dr.id);
              const tone =
                adj?.estado === 'validado' ? 'teal' :
                adj?.estado === 'observado' ? 'red' :
                adj?.estado === 'cargado' ? 'green' : 'amber';
              const klass = adj?.estado === 'observado' ? 'observed' : adj?.estado === 'validado' ? 'validated' : adj?.estado === 'cargado' ? 'uploaded' : '';
              return (
                <div key={dr.id} className={`doc-card ${klass}`}>
                  <div className="doc-top">
                    <div className="doc-title">{i + 1}. {dr.nombre}</div>
                    <Badge tone={tone as 'teal' | 'red' | 'green' | 'amber'}>{adj?.estado ?? 'pendiente'}</Badge>
                  </div>
                  {adj ? (
                    <>
                      <div className="file-name">Archivo: {adj.nombre_archivo}</div>
                      <div className="small">Recibido: {formatPanama(adj.fecha_carga)}</div>
                      {adj.observacion && (
                        <div className="client-status warning">
                          <strong>Observación:</strong> {adj.observacion}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <a href={`/api/documentos/${adj.id}/file`} target="_blank" className="btn ghost" rel="noreferrer">Ver</a>
                        <button className="btn green"
                          onClick={() => marcarDocumento(adj.id, 'validado')}
                          disabled={busy}>Validar</button>
                        <button className="btn amber"
                          onClick={() => abrirObservar(adj.id)}
                          disabled={busy}>Observar</button>
                      </div>
                    </>
                  ) : (
                    <div className="helper">Pendiente. Puedes solicitar subsanación al sujeto obligado.</div>
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

          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Solicitar subsanación al sujeto obligado</h3>
            <p className="small" style={{ marginBottom: 12 }}>Permite que el sujeto obligado corrija los documentos sin necesidad de crear un nuevo ROS.</p>

            <form onSubmit={solicitarSubsanacion}>
              <div className="form-grid">
                <div className="field full">
                  <label>Documento observado (opcional)</label>
                  <select value={subDocId} onChange={(e) => setSubDocId(e.target.value)}>
                    <option value="">(Sin documento asociado — observación general)</option>
                    {docsAdj.map((d) => <option key={d.id} value={d.id}>{d.nombre_archivo}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <label>Motivo</label>
                  <textarea value={subMotivo} onChange={(e) => setSubMotivo(e.target.value)} required minLength={10}
                    placeholder="Describe el motivo (archivo ilegible, falta sustento, inconsistencia…)" />
                </div>
                <div className="field full">
                  <button className="btn amber" disabled={busy}>{busy ? 'Enviando…' : 'Solicitar subsanación'}</button>
                </div>
              </div>
            </form>
          </div>

          {subs.length > 0 && (
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Subsanaciones de este expediente</h3>
              <Timeline events={subs.map((s) => ({
                title: `Subsanación #${s.id.slice(0, 8)} · ${s.estado}`,
                description: `${s.motivo} — ${formatPanama(s.fecha_solicitud)}`,
                tone: s.estado === 'pendiente' ? 'amber' : 'green',
              }))} />
            </div>
          )}
        </>
      )}

      {tab === 'vinculos' && (
        <>
          <div className="action-row" style={{ marginBottom: 12 }}>
            <button className="btn primary" onClick={detectarVinculos} disabled={detectando || busy}>
              {detectando ? 'Detectando…' : 'Detectar vínculos automáticamente'}
            </button>
          </div>

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
        title="Observar documento"
        message="Escribe la observación que verá el sujeto obligado al revisar el estado de este documento."
        confirmLabel="Enviar observación"
        cancelLabel="Cancelar"
        busy={busy}
        input={{
          label: 'Observación para el sujeto obligado',
          placeholder: 'Ej: El archivo está ilegible, por favor cargue una versión legible…',
          required: true,
          value: observacionText,
          onChange: setObservacionText,
        }}
        onConfirm={() => marcarDocumento(pendingDocId, 'observado', observacionText)}
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
