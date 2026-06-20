'use client';
import { useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/Badge';
import { Timeline } from '@/components/Timeline';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SuccessModal } from '@/components/SuccessModal';
import { maskDescriptionText } from '@/lib/masking';
import { formatPanama, formatPanamaShort } from '@/lib/date';
import CustomSelect from '@/components/CustomSelect';
import { ClipboardList, Link2, CheckCircle, FileText } from 'lucide-react';

interface DocReq  { id: string; nombre: string; orden: number; tipo_requerimiento: string }
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
  estadoActual: string;
  canClassify: boolean;
  canClose: boolean;
  canReopen: boolean;
  canRevertRiesgo: boolean;
  canAssign: boolean;
  allRequiredDocsValidated: boolean;
  requiredDocTotal: number;
  requiredDocValidated: number;
  riesgoClasificado: boolean;
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

type Tab = 'resumen' | 'documentos' | 'riesgo' | 'vinculos' | 'auditoria';

interface StepDef {
  key: Tab;
  label: string;
  number: number;
}

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'resumen',    label: 'Resumen',    number: 1 },
  { key: 'documentos', label: 'Documentos', number: 2 },
  { key: 'riesgo',     label: 'Riesgo',     number: 3 },
];

const EXTRA_TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'vinculos',  label: 'Vínculos',  icon: <Link2 size={15} strokeWidth={2.4} /> },
  { key: 'auditoria', label: 'Auditoría', icon: <ClipboardList size={15} strokeWidth={2.4} /> },
];

export function RosExpedienteTabs({
  rosId, numeroRos, estadoActual, canClassify, canClose, canReopen, canRevertRiesgo, canAssign,
  allRequiredDocsValidated, requiredDocTotal, requiredDocValidated, riesgoClasificado,
  summary, riesgoNode, docsReq, docsAdj, vinculos, auditEvents, subs,
  asignacion, analistas,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('resumen');

  const [busy, setBusy] = useState(false);

  const [riesgoNivel, setRiesgoNivel] = useState<'alto' | 'medio' | 'bajo' | ''>('');
  const [riesgoPuntaje, setRiesgoPuntaje] = useState(0);
  const [riesgoJustif, setRiesgoJustif] = useState('');

  const [nuevoEstado, setNuevoEstado] = useState<string>('en_analisis');

  type ModalKey = 'cerrarRos' | 'observarDoc' | 'noAplicaDoc' | 'solicitarDocPend' | 'confirmarVinc' | 'descartarVinc'
    | 'revertirValidacion' | 'reabrirRos' | 'revertirRiesgo' | null;
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [pendingDocId, setPendingDocId] = useState<string>('');
  const [pendingDocNombre, setPendingDocNombre] = useState<string>('');
  const [observacionText, setObservacionText] = useState('');
  const [pendingVincId, setPendingVincId] = useState<string>('');
  const [revertirJustif, setRevertirJustif] = useState('');
  const [detectando, setDetectando] = useState(false);
  const [detectMsg, setDetectMsg] = useState<{ text: string; tipo: 'ok' | 'info' } | null>(null);
  const [analistaId, setAnalistaId] = useState('');
  const [asignandoBusy, setAsignandoBusy] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [altoRiesgoMsg, setAltoRiesgoMsg] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);

  const isWorkflowTab = WORKFLOW_STEPS.some((s) => s.key === tab);
  const wfIdx = WORKFLOW_STEPS.findIndex((s) => s.key === tab);
  const stepStatus = useMemo(() => {
    const riesgoLocked = !allRequiredDocsValidated && !riesgoClasificado;
    return WORKFLOW_STEPS.map((_, i) => {
      if (i < wfIdx) return 'completed' as const;
      if (i === wfIdx) return 'current' as const;
      if (i === 2 && riesgoLocked) return 'locked' as const;
      return 'pending' as const;
    });
  }, [wfIdx, allRequiredDocsValidated, riesgoClasificado]);

  const WF_SEQUENCE: Tab[] = WORKFLOW_STEPS.map((s) => s.key);

  function goToStep(key: Tab) {
    const idx = WORKFLOW_STEPS.findIndex((s) => s.key === key);
    if (idx === -1) { setTab(key); return; }
    const status = stepStatus[idx];
    if (status === 'locked') {
      setActionError('Debe validar o marcar como no aplica todos los documentos obligatorios antes de clasificar el riesgo.');
      return;
    }
    setTab(key);
  }

  function handleStepKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, key: Tab) {
    const steps = [...WF_SEQUENCE, ...EXTRA_TABS.map((t) => t.key)];
    const idx = steps.indexOf(key);
    if (e.key === 'ArrowRight') { e.preventDefault(); const next = steps[(idx + 1) % steps.length]; goToStep(next); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); const prev = steps[(idx - 1 + steps.length) % steps.length]; goToStep(prev); }
    else if (e.key === 'Home') { e.preventDefault(); goToStep(steps[0]); }
    else if (e.key === 'End') { e.preventDefault(); goToStep(steps[steps.length - 1]); }
  }

  function clearError() { setActionError(null); setAltoRiesgoMsg(null); }

  async function clasificar(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (!riesgoNivel) { setActionError('Debe seleccionar un nivel de riesgo.'); return; }
    if (riesgoJustif.trim().length < 15) { setActionError('La justificación debe tener al menos 15 caracteres.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/riesgo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: riesgoNivel, puntaje: riesgoPuntaje, justificacion: riesgoJustif }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'Error al clasificar.'); return; }
      setRiesgoJustif('');
      setSuccessModal({ title: 'Riesgo clasificado', message: `El nivel de riesgo ${riesgoNivel.toUpperCase()} fue registrado correctamente en el expediente.` });
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
    if (estadoActual === 'cerrado' && nuevoEstado === 'en_analisis') { setActiveModal('reabrirRos'); return; }
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
      setSuccessModal({ title: 'Estado actualizado', message: `El ROS ${numeroRos} fue cambiado a "${nuevoEstado.replace(/_/g, ' ')}" correctamente.` });
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

  async function revertirValidacionDoc(docId: string) {
    setActiveModal(null);
    clearError();
    setBusy(true);
    try {
      const res = await fetch(`/api/documentos/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cargado', observacion: 'Validación revertida por el analista.' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo revertir la validación.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirRevertirValidacion(docId: string) {
    setPendingDocId(docId);
    setActiveModal('revertirValidacion');
  }

  async function revertirRiesgo() {
    setActiveModal(null);
    if (revertirJustif.trim().length < 15) { setActionError('La justificación debe tener al menos 15 caracteres.'); return; }
    clearError();
    setBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/riesgo/revertir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificacion: revertirJustif }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo revertir la clasificación.'); return; }
      setRevertirJustif('');
      setSuccessModal({ title: 'Clasificación revertida', message: 'La clasificación de riesgo fue anulada correctamente. Puede registrar una nueva.' });
      router.refresh();
    } finally { setBusy(false); }
  }

  function abrirRevertirRiesgo() {
    setRevertirJustif('');
    setActiveModal('revertirRiesgo');
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
    if (!analistaId || analistaId === asignacion?.analista_id) return;
    clearError();
    setAsignandoBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/asignar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: analistaId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo actualizar el responsable.'); return; }
      setAnalistaId('');
      setSuccessModal({ title: 'Analista asignado', message: 'El analista fue asignado al expediente correctamente.' });
      router.refresh();
    } finally { setAsignandoBusy(false); }
  }

  async function desasignarAnalista() {
    if (!asignacion) return;
    clearError();
    setAsignandoBusy(true);
    try {
      const res = await fetch(`/api/ros/${rosId}/asignar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analista_id: null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error ?? 'No se pudo quitar la asignación.'); return; }
      setSuccessModal({ title: 'Responsable actualizado', message: 'El expediente quedó sin analista asignado.' });
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
  const docListReq = docsReq.filter((d) => d.tipo_requerimiento === 'requerido');
  const docListCond = docsReq.filter((d) => d.tipo_requerimiento === 'condicional');
  const docListOpt = docsReq.filter((d) => d.tipo_requerimiento === 'opcional');
  const cleanAnalystName = (name: string) => name.trim().replace(/[,\s]+$/g, '');

  const pendingSubsByAdjId = new Set(
    subs.filter((s) => s.estado === 'pendiente' && s.documento_adjunto_id).map((s) => s.documento_adjunto_id!),
  );
  const pendingSubsByDocReqId = new Set(
    subs.filter((s) => s.estado === 'pendiente' && s.documento_requerido_id && !s.documento_adjunto_id).map((s) => s.documento_requerido_id!),
  );

  const riesgoBloqueado = !allRequiredDocsValidated && !riesgoClasificado;

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible' }}>
      {/* ── Workflow Stepper (Resumen · Documentos · Riesgo + extras) ── */}
      <nav className="workflow-stepper" aria-label="Flujo de análisis del expediente">
        <div className="wf-steps-row">
          {WORKFLOW_STEPS.map((s, i) => {
            const status = stepStatus[i];

            return (
              <div key={s.key} className="wf-step-block">
                <button
                  className={`wf-step ${status}`}
                  onClick={() => goToStep(s.key)}
                  onKeyDown={(e) => handleStepKeyDown(e, s.key)}
                  role="tab"
                  aria-selected={tab === s.key}
                  disabled={status === 'locked'}
                  tabIndex={status === 'locked' ? -1 : 0}
                >
                  <span className={`wf-circle ${status}`} aria-hidden="true">
                    {status === 'completed' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : status === 'locked' ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      s.number
                    )}
                  </span>
                  <span className="wf-label">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="wf-extra-divider" aria-hidden="true" />

        <div className="wf-extra-tabs" role="tablist" aria-label="Secciones adicionales">
          {EXTRA_TABS.map((t) => (
            <button
              key={t.key}
              className={`wf-extra-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => handleStepKeyDown(e, t.key)}
              role="tab"
              aria-selected={tab === t.key}
            >
              <span className="wf-extra-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Summary bar ── */}
      <div className="wf-summary-bar">
        <span className="wf-summary-text">
          {isWorkflowTab
            ? <>Paso {wfIdx + 1} de {WORKFLOW_STEPS.length}: <strong>{WORKFLOW_STEPS[wfIdx]?.label}</strong></>
            : <><strong>{EXTRA_TABS.find((t) => t.key === tab)?.label ?? ''}</strong> — consulta adicional</>}
        </span>
        <span className="wf-summary-docs">
          {requiredDocTotal > 0
            ? `Documentos obligatorios: ${requiredDocValidated}/${requiredDocTotal} validados`
            : 'Sin documentos requeridos'}
        </span>
      </div>

      {actionError && (
        <div className="client-status error" role="alert" style={{ margin: '0 20px 12px' }}>
          {actionError}
          <button onClick={() => setActionError(null)} aria-label="Cerrar error"
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}

      {altoRiesgoMsg && (
        <div className="notice" style={{ margin: '0 20px 12px', borderColor: '#fcd34d', background: '#fffbeb', color: '#7a4b00' }} role="alert">
          <strong>⚠️ Alerta de alto riesgo:</strong> {altoRiesgoMsg}
          <button onClick={() => setAltoRiesgoMsg(null)} aria-label="Cerrar alerta"
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}

      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', padding: 20 }}>
        {/* ── Resumen ── */}
        {tab === 'resumen' && (
          <div role="tabpanel" aria-labelledby="step-resumen" tabIndex={-1}>
            {summary}

            {canAssign && (
              <div className="card" style={{ marginTop: 16, padding: '16px 18px' }}>
                <h3 style={{ marginBottom: 4 }}>Asignar responsable</h3>
                <p className="small" style={{ marginBottom: 12 }}>
                  Solo el analista asignado formalmente puede ver y gestionar este expediente.
                </p>
                {asignacion ? (
                  <div className="notice" style={{ marginBottom: 12 }}>
                  Asignado a <strong>{cleanAnalystName(asignacion.analista_nombre)}</strong>
                    {' '}— por {asignacion.asignado_por_nombre} el {formatPanama(asignacion.fecha_asignacion)}
                  </div>
                ) : (
                  <div className="notice" style={{ marginBottom: 12, color: 'var(--amber)' }}>
                    Sin analista asignado. Este ROS no es visible en la bandeja de ningún analista.
                  </div>
                )}
                <form onSubmit={asignarAnalista} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <CustomSelect
                    value={analistaId}
                    onChange={(e) => setAnalistaId(e.target.value)}
                    style={{ minWidth: 220 }}
                  >
                    <option value="" disabled>Seleccionar analista</option>
                    {analistas.map((a) => (
                      <option key={a.id} value={a.id}
                        style={asignacion?.analista_id === a.id ? { fontWeight: 600 } : undefined}>
                        {cleanAnalystName(a.nombre)}{asignacion?.analista_id === a.id ? ' (actual)' : ''}
                      </option>
                    ))}
                  </CustomSelect>
                  <button className="btn primary" type="submit"
                    disabled={!analistaId || asignandoBusy || analistaId === asignacion?.analista_id}>
                    {asignacion ? 'Reasignar' : 'Asignar'}
                  </button>
                  {asignacion && (
                    <button className="btn secondary" type="button" onClick={desasignarAnalista} disabled={asignandoBusy}>
                      No asignar a nadie
                    </button>
                  )}
                </form>
              </div>
            )}

            {!canAssign && asignacion && (
              <div className="notice" style={{ marginTop: 12 }}>
                Este ROS le fue asignado por <strong>{asignacion.asignado_por_nombre}</strong> el {formatPanama(asignacion.fecha_asignacion)}.
              </div>
            )}

            {canClassify && (
              <div className="card" style={{ marginTop: 12, padding: '16px 18px' }}>
                <h3 style={{ marginBottom: 4 }}>Actualizar estado del ROS</h3>
                <p className="small" style={{ marginBottom: 14 }}>
                  Cambia el estado del expediente según el avance del análisis. La transición queda registrada en el log de auditoría.
                </p>
                <form onSubmit={cambiarEstado} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <CustomSelect value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} style={{ minWidth: 220 }}>
                    {(() => {
                      const transiciones: Record<string, string[]> = {
                        recibido:             ['en_analisis'],
                        en_analisis:          ['revision_documental', 'subsanacion', 'escalado'],
                        revision_documental:  ['en_analisis', 'subsanacion', 'escalado'],
                        subsanacion:          ['en_analisis', 'revision_documental', 'escalado'],
                        escalado:             ['en_analisis', 'revision_documental'],
                        vinculado:            ['en_analisis', 'revision_documental', 'escalado'],
                      };
                      if (canClose) {
                        transiciones.escalado?.push('cerrado');
                        transiciones.vinculado?.push('cerrado');
                      }
                      if (canReopen && estadoActual === 'cerrado') {
                        transiciones.cerrado = ['en_analisis'];
                      }
                      const opts = transiciones[estadoActual] ?? [];
                      return opts.length > 0 ? (
                        opts.map((v) => (
                          <option key={v} value={v}>
                            {v === 'en_analisis' ? 'En análisis' :
                             v === 'revision_documental' ? 'Revisión documental' :
                             v === 'subsanacion' ? 'Subsanación' :
                             v === 'escalado' ? 'Escalado' :
                             v === 'vinculado' ? 'Vinculado' :
                             v === 'cerrado' ? 'Cerrar ROS' : v}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No hay transiciones disponibles</option>
                      );
                    })()}
                  </CustomSelect>
                  <button className="btn primary" disabled={busy || nuevoEstado === ''}>
                    Actualizar estado
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

        {/* ── Documentos ── */}
        {tab === 'documentos' && (
          <div role="tabpanel" aria-labelledby="step-documentos" tabIndex={-1}>
            {solicitudEnviada && (
              <div className="notice green" style={{ marginBottom: 12 }}>
                Solicitud enviada al sujeto obligado. El ROS pasó a estado «subsanación».
              </div>
            )}
            <div className="doc-stat-strip">
              <div className="doc-stat ok">
                <span className="doc-stat-dot" />
                <strong>{docsAdj.filter((d) => d.documento_requerido_id).length}</strong>
                Recibidos
              </div>
              <div className="doc-stat-divider" />
              <div className="doc-stat">
                <span className="doc-stat-dot" style={{ background: '#94a3b8' }} />
                <strong>{docsReq.length - docsAdj.filter((d) => d.documento_requerido_id).length}</strong>
                Pendientes
              </div>
              <div className="doc-stat-divider" />
              <div className="doc-stat req">
                <span className="doc-stat-dot" />
                <strong>{docsAdj.filter((d) => d.estado === 'observado').length}</strong>
                Observados
              </div>
              <div className="doc-stat-right">
                <div className="doc-stat">
                  <strong>{docsReq.length}</strong>
                  total
                </div>
              </div>
            </div>

            {requiredDocTotal > 0 && (
              <div className="wf-doc-progress">
                <div className="wf-doc-progress-header">
                  <span className="wf-doc-progress-label">Documentos obligatorios validados</span>
                  <span className={`wf-doc-progress-count ${allRequiredDocsValidated ? 'wf-done-text' : 'wf-pending-text'}`}>
                    {requiredDocValidated}/{requiredDocTotal}
                  </span>
                </div>
                <div className="wf-doc-progress-track">
                  <div
                    className="wf-doc-progress-fill"
                    style={{ width: `${requiredDocTotal > 0 ? (requiredDocValidated / requiredDocTotal) * 100 : 0}%` }}
                  />
                </div>
                {allRequiredDocsValidated && (
                  <div className="wf-doc-all-ok">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Todos los obligatorios validados — puede clasificar el riesgo
                  </div>
                )}
              </div>
            )}

            {(() => {
              const renderDocCard = (dr: DocReq) => {
                const adj = adjByReq.get(dr.id);
                const hasPendingSubsOnAdj = adj ? pendingSubsByAdjId.has(adj.id) : false;
                const hasSolicitudPend    = !adj && pendingSubsByDocReqId.has(dr.id);
                const globalIdx = docsReq.findIndex((d) => d.id === dr.id) + 1;
                const typeClass =
                  dr.tipo_requerimiento === 'requerido' ? 'req-card' :
                  dr.tipo_requerimiento === 'condicional' ? 'cond-card' : 'opt-card';

                const tone =
                  adj?.estado === 'validado'  ? 'teal' :
                  adj?.estado === 'no_aplica' ? 'gray' :
                  adj?.estado === 'observado' ? 'red' :
                  adj?.estado === 'cargado'   ? 'green' :
                  hasSolicitudPend            ? 'purple' : 'amber';
                const badgeLabel =
                  hasSolicitudPend ? 'Solicitado' :
                  adj?.estado === 'cargado'    ? 'recibido' :
                  adj?.estado === 'no_aplica'  ? 'no aplica' :
                  (adj?.estado ?? 'pendiente');
                const showBadge = Boolean(adj || hasSolicitudPend || dr.tipo_requerimiento === 'requerido');
                const klass = adj?.estado === 'observado' ? 'observed' : adj?.estado === 'validado' ? 'validated' : adj?.estado === 'cargado' ? 'uploaded' : '';

                return (
                  <div key={dr.id} className={`doc-card uaf-doc-card ${typeClass} ${klass}`}>
                    <div className="uaf-doc-header">
                      <div className="uaf-doc-index doc-num">{globalIdx}</div>
                      <div className="uaf-doc-meta">
                        <div className="doc-title">{dr.nombre}</div>
                        {adj && adj.estado !== 'no_aplica' && (
                          <div className="uaf-doc-filename">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <a href={`/documentos/${adj.id}`} target="_blank" rel="noreferrer" className="uaf-doc-link">
                              {adj.nombre_archivo}
                            </a>
                          </div>
                        )}
                      </div>
                      {showBadge && (
                        <Badge tone={tone as 'teal' | 'red' | 'green' | 'amber' | 'purple'}>{badgeLabel}</Badge>
                      )}
                    </div>

                    {adj ? (
                      <>
                        {adj.estado === 'no_aplica' ? (
                          <div className="uaf-doc-body">
                            <div className="uaf-doc-notice pending">
                              No aplica
                              <span className="uaf-doc-sub">{adj.observacion ?? 'Declarado como no aplicable.'}</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(adj.observacion && adj.estado === 'observado') || adj.estado === 'validado' || adj.estado === 'cargado' ? (
                              <div className="uaf-doc-body">
                                {adj.observacion && adj.estado === 'observado' && (
                                  <div className="uaf-doc-notice error">
                                    <strong>Observación:</strong> {adj.observacion}
                                  </div>
                                )}
                                {adj.estado === 'validado' && (
                                  <div className="uaf-doc-notice success">Documento validado correctamente</div>
                                )}
                                {adj.estado === 'cargado' && (
                                  <div className="uaf-doc-notice success">Documento recibido correctamente</div>
                                )}
                              </div>
                            ) : null}
                            {adj.estado === 'validado' ? (
                              <div className="uaf-doc-actions">
                                <span className="uaf-doc-ok-label" style={{ color: 'var(--teal)', fontSize: 12, marginRight: 8 }}>✓ Validado</span>
                                <button className="btn ghost uaf-btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                                  onClick={() => abrirRevertirValidacion(adj.id)}
                                  disabled={busy}>↩ Revertir</button>
                                <span className="uaf-doc-datestamp" style={{ marginLeft: 'auto' }}>{formatPanamaShort(adj.fecha_carga)}</span>
                              </div>
                            ) : (
                              <div className="uaf-doc-actions">
                                {hasPendingSubsOnAdj ? (
                                  <span className="uaf-waiting-label">Esperando corrección del sujeto…</span>
                                ) : (
                                  <>
                                    <button className="btn green uaf-btn-sm"
                                      onClick={() => marcarDocumento(adj.id, 'validado')}
                                      disabled={busy}>Validar</button>
                                    {adj.estado !== 'no_aplica' && (
                                      <>
                                        <button className="btn amber uaf-btn-sm"
                                          onClick={() => abrirObservar(adj.id)}
                                          disabled={busy}>Observar</button>
                                        <button className="btn ghost uaf-btn-sm"
                                          onClick={() => abrirNoAplica(adj.id)}
                                          disabled={busy}>No aplica</button>
                                      </>
                                    )}
                                  </>
                                )}
                                <span className="uaf-doc-datestamp" style={{ marginLeft: 'auto' }}>{formatPanamaShort(adj.fecha_carga)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="uaf-doc-body">
                          <div className="uaf-doc-notice pending">
                            {hasSolicitudPend
                              ? 'Solicitud enviada — esperando carga del sujeto obligado'
                              : 'Sin documento adjunto aún'}
                          </div>
                        </div>
                        {canClassify && !hasSolicitudPend && (
                          <div className="uaf-doc-actions">
                            <button className="btn amber uaf-btn-sm"
                              onClick={() => abrirSolicitarPendiente(dr.id, dr.nombre)}
                              disabled={busy}>Solicitar documento</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {docListReq.length > 0 && (
                    <>
                      <div className="doc-group-label req">
                        <span className="doc-group-dot" />
                        Obligatorios — {docListReq.length} documentos
                        <span className="doc-group-line" />
                      </div>
                      <div className="doc-grid">{docListReq.map(renderDocCard)}</div>
                    </>
                  )}
                  {docListCond.length > 0 && (
                    <>
                      <div className="doc-group-label cond">
                        <span className="doc-group-dot" />
                        Condicionales — {docListCond.length} documentos
                        <span className="doc-group-line" />
                      </div>
                      <div className="doc-grid">{docListCond.map(renderDocCard)}</div>
                    </>
                  )}
                  {docListOpt.length > 0 && (
                    <>
                      <div className="doc-group-label opt">
                        <span className="doc-group-dot" />
                        Opcionales — {docListOpt.length} documentos
                        <span className="doc-group-line" />
                      </div>
                      <div className="doc-grid">{docListOpt.map(renderDocCard)}</div>
                    </>
                  )}
                </>
              );
            })()}

            {extras.length > 0 && (
              <>
                <div className="doc-group-label" style={{ marginTop: 18 }}>
                  <span className="doc-group-dot" style={{ background: 'var(--muted)' }} />
                  Evidencia adicional no catalogada — {extras.length} {extras.length === 1 ? 'archivo' : 'archivos'}
                  <span className="doc-group-line" />
                </div>
                <div className="doc-grid">
                  {extras.map((e) => (
                    <div key={e.id} className="doc-card uploaded">
                      <div className="doc-top">
                        <div className="doc-title">
                          <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, opacity: 0.6 }} />
                          {e.nombre_archivo}
                        </div>
                        <Badge tone="green">Cargado</Badge>
                      </div>
                      <div className="upload-zone has-file" style={{ marginBottom: 0 }}>
                        <div className="upload-zone-content">
                          <CheckCircle size={18} className="upload-zone-icon uploaded" />
                          <div>
                            <a
                              href={`/documentos/${e.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="upload-zone-filename"
                              style={{ color: 'var(--primary)', textDecoration: 'none' }}
                            >
                              {e.nombre_archivo}
                            </a>
                            <div className="upload-zone-size">Documento adjunto · {formatPanama(e.fecha_carga)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {subs.length > 0 && (
              <div className="card" style={{ marginTop: 14, padding: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Subsanaciones de este expediente</h3>
                <Timeline events={subs.map((s) => {
                  const docNombre = s.documento_requerido_id
                    ? (docsReq.find((d) => d.id === s.documento_requerido_id)?.nombre ?? 'Documento')
                    : 'Evidencia adicional';
                  const fechas = `Solicitada: ${formatPanamaShort(s.fecha_solicitud)}${s.fecha_limite ? ` · Límite: ${formatPanamaShort(s.fecha_limite)}` : ''}`;
                  return {
                    title: `${docNombre} · ${s.estado}`,
                    description: `${s.motivo}\n${fechas}`,
                    tone: s.estado === 'vencida' ? 'red' : s.estado === 'pendiente' ? 'amber' : 'green',
                  };
                })} />
              </div>
            )}
          </div>
        )}

        {/* ── Riesgo ── */}
        {tab === 'riesgo' && (
          <div role="tabpanel" aria-labelledby="step-riesgo" tabIndex={-1}>
            {riesgoNode}

            {canClassify && (
              <div className="card" style={{ marginTop: 14, padding: 14 }}>
                {riesgoBloqueado ? (
                  <div className="wf-risk-blocked">
                    <div className="wf-risk-blocked-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>Documentos pendientes de validación</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                      Debe validar o marcar como no aplica todos los documentos obligatorios antes de clasificar el riesgo.
                      Actualmente {requiredDocValidated} de {requiredDocTotal} obligatorios están validados.
                    </p>
                    <button className="btn primary" style={{ marginTop: 12 }}
                      onClick={() => goToStep('documentos')}>
                      Ir a Documentos
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>Clasificar riesgo</h3>
                      {riesgoClasificado && canRevertRiesgo && (
                        <button className="btn ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: 12 }}
                          onClick={abrirRevertirRiesgo} disabled={busy}>
                          ↩ Revertir clasificación
                        </button>
                      )}
                    </div>
                    <p className="small" style={{ marginBottom: 12 }}>La justificación es obligatoria y queda registrada en auditoría.</p>
                    <form onSubmit={clasificar}>
                      <div className="form-grid">
                        <div className="field">
                          <label>Nivel</label>
                          <CustomSelect value={riesgoNivel} onChange={(e) => setRiesgoNivel(e.target.value as 'alto' | 'medio' | 'bajo' | '')}>
                            <option value="" disabled>Seleccione un nivel...</option>
                            <option value="alto">Alto</option>
                            <option value="medio">Medio</option>
                            <option value="bajo">Bajo</option>
                          </CustomSelect>
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
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Vínculos (tab libre) ── */}
        {tab === 'vinculos' && (
          <div role="tabpanel" aria-labelledby="step-vinculos" tabIndex={-1}>
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
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Link2 size={14} strokeWidth={2.4} />
                        {v.numero_ros}
                      </strong>
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

        {/* ── Auditoría (tab libre) ── */}
        {tab === 'auditoria' && (
          <div role="tabpanel" aria-labelledby="step-auditoria" tabIndex={-1}>
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
      </div>

      {/* ── Modales ── */}
      <ConfirmModal
        isOpen={activeModal === 'cerrarRos'}
        variant="danger"
        title="¿Cerrar este ROS?"
        message={`El ROS ${numeroRos} pasará a estado Cerrado. Un supervisor podrá reabrirlo después si es necesario. Queda registrado en auditoría.`}
        confirmLabel="Sí, cerrar ROS"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={doCambiarEstado}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'reabrirRos'}
        variant="warning"
        title="¿Reabrir este ROS?"
        message={`El ROS ${numeroRos} estaba en estado Cerrado. Pasara a "En análisis" y podra continuar la gestion. Solo un supervisor puede ejecutar esta accion y queda registrada en auditoria.`}
        confirmLabel="Sí, reabrir ROS"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={doCambiarEstado}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'revertirValidacion'}
        variant="warning"
        title="¿Revertir validación del documento?"
        message="El documento volverá a estado 'recibido' y podrá ser validado nuevamente u observado. Esta acción queda registrada en auditoría."
        confirmLabel="Sí, revertir validación"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={() => revertirValidacionDoc(pendingDocId)}
        onCancel={() => setActiveModal(null)}
      />

      <ConfirmModal
        isOpen={activeModal === 'revertirRiesgo'}
        variant="warning"
        title="¿Revertir clasificación de riesgo?"
        message="La clasificación actual será anulada y quedará registrada en auditoría con la justificación. Luego podrá registrar una nueva clasificación."
        confirmLabel="Sí, revertir clasificación"
        cancelLabel="Cancelar"
        busy={busy}
        input={{
          label: `Justificación de la reversión (mín. 15 caracteres · ${revertirJustif.trim().length}/15)`,
          placeholder: 'Ej: Se identificaron nuevos elementos que cambian la evaluación inicial…',
          required: true,
          minLength: 15,
          value: revertirJustif,
          onChange: setRevertirJustif,
        }}
        onConfirm={revertirRiesgo}
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

      <SuccessModal
        isOpen={!!successModal}
        title={successModal?.title ?? ''}
        message={successModal?.message ?? ''}
        onClose={() => setSuccessModal(null)}
      />
    </div>
  );
}
