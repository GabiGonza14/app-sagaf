import Link from 'next/link';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, estadoTone, estadoLabel, riskTone } from '@/components/Badge';
import { formatPanamaMedium } from '@/lib/date';
import { FileText, FilePlus, RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight, Shield } from 'lucide-react';
import { FEATURES } from '@/lib/features';

export const revalidate = 0;

interface SujetoRow { id: string; nombre: string; tipo: string; sector: string; estado: string }

interface RosResumen {
  id: string;
  numero_ros: string;
  estado: string;
  fecha_recepcion: string;
  monto: number;
  nivel_riesgo: string | null;
  doc_total: number;
  doc_cargados: number;
  doc_obl_total: number;
  doc_obl_cargados: number;
  doc_cond_total: number;
  doc_cond_cargados: number;
  doc_opt_total: number;
  doc_opt_cargados: number;
  pendientes_subsanacion: number;
}

interface SubsanacionPendiente {
  id: string;
  ros_id: string;
  numero_ros: string;
  motivo: string;
}

export default async function PortalHome() {
  const session = await getSession();
  const soId = session!.user.sujetoObligadoId!;

  const so = db
    .prepare<[string], SujetoRow>('SELECT id, nombre, tipo, sector, estado FROM sujeto_obligado WHERE id = ?')
    .get(soId);

  const ros = db
    .prepare<[string], RosResumen>(
      `SELECT r.id, r.numero_ros, r.estado, r.fecha_recepcion,
              COALESCE((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id), 0) AS monto,
              (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id
                ORDER BY fecha_clasificacion DESC LIMIT 1) AS nivel_riesgo,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id) AS doc_total,
              (SELECT COUNT(*) FROM documento_adjunto da WHERE da.ros_id = r.id AND da.documento_requerido_id IS NOT NULL) AS doc_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'requerido') AS doc_obl_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'requerido') AS doc_obl_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'condicional') AS doc_cond_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'condicional') AS doc_cond_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'opcional') AS doc_opt_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'opcional') AS doc_opt_cargados,
              (SELECT COUNT(*) FROM solicitud_subsanacion s WHERE s.ros_id = r.id AND s.estado = 'pendiente') AS pendientes_subsanacion
         FROM ros r
        WHERE r.sujeto_obligado_id = ?
        ORDER BY r.fecha_recepcion DESC`,
    )
    .all(soId);

  const subsanacionesPendientes = db
    .prepare<[string], SubsanacionPendiente>(
      `SELECT s.id, s.ros_id, r.numero_ros, s.motivo
         FROM solicitud_subsanacion s
         JOIN ros r ON r.id = s.ros_id
        WHERE r.sujeto_obligado_id = ? AND s.estado = 'pendiente'
        ORDER BY s.fecha_solicitud DESC
        LIMIT 5`,
    )
    .all(soId);

  const supervisionPendiente = FEATURES.SUPERVISION_SO
    ? (db.prepare<[string], { n: number }>(
        `SELECT COUNT(*) AS n FROM comunicacion_supervision
          WHERE sujeto_obligado_id = ? AND estado IN ('recibida', 'en_analisis')`,
      ).get(soId)?.n ?? 0)
    : 0;

  const totales = {
    total: ros.length,
    enAnalisis: ros.filter((r) => r.estado === 'en_analisis').length,
    subsanacion: ros.filter((r) => r.pendientes_subsanacion > 0).length,
    altos: ros.filter((r) => r.nivel_riesgo === 'alto').length,
  };

  const recientes = ros.slice(0, 3);
  const tipoLabel = so?.tipo === 'bank' ? 'Banco' : so?.tipo === 'realestate' ? 'Inmobiliaria' : so?.tipo ?? '';

  return (
    <>
      <TopBar
        eyebrow="Portal del Sujeto Obligado"
        title={`Bienvenido, ${so?.nombre ?? 'Sujeto Obligado'}`}
        description="Registre nuevos Reportes de Operaciones Sospechosas, consulte el estado de sus envíos y atienda las solicitudes de subsanación de la UAF."
      />

      {/* A3 — Aviso si la organización está inactiva (CU-06) */}
      {so?.estado !== 'activo' && (
        <div className="notice red" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Organización inactiva.</strong> Su organización ha sido desactivada por el administrador del sistema.
            Puede consultar sus ROS anteriores pero no puede registrar nuevos hasta ser reactivada.
            Contacte al administrador para solicitar la reactivación.
          </div>
        </div>
      )}

      {FEATURES.SUPERVISION_SO && supervisionPendiente > 0 && (
        <div className="notice amber" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <Shield size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong>{supervisionPendiente} comunicación{supervisionPendiente > 1 ? 'es' : ''} de supervisión pendiente{supervisionPendiente > 1 ? 's' : ''}.</strong>
            <Link href="/portal/supervision" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700 }}>
              Ir a atención a supervisión <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kpis">
        <KpiCard label="Total de ROS registrados" value={totales.total} badge="Histórico" tone="blue" />
        <KpiCard label="En análisis UAF" value={totales.enAnalisis} badge="En curso" tone="teal" />
        <KpiCard label="Con subsanación pendiente" value={totales.subsanacion} badge="Requieren acción" tone="amber" />
        <KpiCard label="Clasificados alto riesgo" value={totales.altos} badge="Prioridad" tone="red" />
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
        {/* Acciones rápidas */}
        <div className="card">
          <div className="panel-head" style={{ marginBottom: 14 }}>
            <div>
              <h3>Acciones rápidas</h3>
              <p>Operaciones frecuentes</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <Link href="/portal/ros/nuevo" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 16, background: '#fbfdff', textDecoration: 'none', color: 'inherit', transition: 'all .18s ease' }}
              className="report-item">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <FilePlus size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 14, color: '#102a43' }}>Registrar nuevo ROS</strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Formulario dinámico según sector</span>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>

            <Link href="/portal/ros" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 16, background: '#fbfdff', textDecoration: 'none', color: 'inherit' }}
              className="report-item">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--teal-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <FileText size={18} style={{ color: 'var(--teal)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 14, color: '#102a43' }}>Ver mis ROS</strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Historial completo · filtros por estado</span>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>

            <Link href="/portal/subsanaciones" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: `1px solid ${subsanacionesPendientes.length > 0 ? 'rgba(183,121,31,.35)' : 'var(--line)'}`, borderRadius: 16, background: subsanacionesPendientes.length > 0 ? 'var(--amber-soft)' : '#fbfdff', textDecoration: 'none', color: 'inherit' }}
              className="report-item">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--amber-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <RefreshCw size={18} style={{ color: 'var(--amber)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 14, color: '#102a43' }}>Subsanaciones</strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {subsanacionesPendientes.length > 0
                    ? `${subsanacionesPendientes.length} pendiente(s) de atención`
                    : 'Sin observaciones pendientes'}
                </span>
              </div>
              {subsanacionesPendientes.length > 0
                ? <Badge tone="amber">{subsanacionesPendientes.length}</Badge>
                : <CheckCircle size={16} style={{ color: 'var(--green)' }} />}
            </Link>

            {FEATURES.SUPERVISION_SO && (
              <Link href="/portal/supervision" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: `1px solid ${supervisionPendiente > 0 ? 'rgba(183,121,31,.35)' : 'var(--line)'}`, borderRadius: 16, background: supervisionPendiente > 0 ? 'var(--amber-soft)' : '#fbfdff', textDecoration: 'none', color: 'inherit' }}
                className="report-item">
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Shield size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: 14, color: '#102a43' }}>Atención a supervisión</strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {supervisionPendiente > 0
                      ? `${supervisionPendiente} oficio(s) pendiente(s)`
                      : 'Oficios SBP / ISRNNF y paquetes acotados'}
                  </span>
                </div>
                {supervisionPendiente > 0
                  ? <Badge tone="amber">{supervisionPendiente}</Badge>
                  : <ArrowRight size={16} style={{ color: 'var(--muted)' }} />}
              </Link>
            )}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="card">
          <div className="panel-head" style={{ marginBottom: 14 }}>
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimos {recientes.length} reportes registrados</p>
            </div>
            <Link href="/portal/ros" className="btn ghost" style={{ padding: '8px 13px', fontSize: 12 }}>
              Ver todos →
            </Link>
          </div>

          {recientes.length === 0 ? (
            <div className="notice" style={{ marginBottom: 0 }}>
              <Clock size={16} style={{ display: 'inline', marginRight: 8 }} />
              Aún no has registrado ningún ROS.{' '}
              <Link href="/portal/ros/nuevo" style={{ color: 'var(--primary)', fontWeight: 700 }}>Registrar el primero</Link>.
            </div>
          ) : (
            <div className="report-list">
              {recientes.map((r) => (
                <Link key={r.id} href={`/portal/ros/${r.id}`} className="report-item">
                  <div className="report-top">
                    <strong>{r.numero_ros}</strong>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge tone={estadoTone(r.estado)}>{estadoLabel(r.estado, 'portal')}</Badge>
                      {r.nivel_riesgo && <Badge tone={riskTone(r.nivel_riesgo)}>{r.nivel_riesgo}</Badge>}
                    </div>
                  </div>
                  <div className="report-meta">
                    <span>
                      <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                      {formatPanamaMedium(r.fecha_recepcion)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      USD {r.monto.toLocaleString('en-US')}
                      {r.doc_obl_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                          background: r.doc_obl_cargados >= r.doc_obl_total ? 'var(--green-soft)' : 'var(--red-soft)',
                          color: r.doc_obl_cargados >= r.doc_obl_total ? 'var(--green)' : 'var(--red)',
                        }} title="Obligatorios">
                          {r.doc_obl_cargados}/{r.doc_obl_total} obl.
                        </span>
                      )}
                      {r.doc_cond_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                          background: 'var(--amber-soft)', color: 'var(--amber)',
                        }} title="Condicionales">
                          {r.doc_cond_cargados}/{r.doc_cond_total} cond.
                        </span>
                      )}
                      {r.doc_opt_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                          background: '#f1f5f9', color: '#64748b',
                        }} title="Opcionales">
                          {r.doc_opt_cargados}/{r.doc_opt_total} opc.
                        </span>
                      )}
                      {r.pendientes_subsanacion > 0 && (
                        <Badge tone="amber">{r.pendientes_subsanacion} subsanación</Badge>
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>


    </>
  );
}
