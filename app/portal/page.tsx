import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, estadoTone, estadoLabel, riskTone } from '@/components/Badge';
import { formatPanamaMedium } from '@/lib/date';
import { FileText, FilePlus, RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react';

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
  pendientes_subsanacion: number;
}

interface SubsanacionPendiente {
  id: string;
  ros_id: string;
  numero_ros: string;
  motivo: string;
}

export default async function PortalHome() {
  const session = await auth();
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
              (SELECT COUNT(*) FROM documento_requerido dr
                JOIN plantilla_ros pl ON pl.id = dr.plantilla_id
               WHERE pl.id = r.plantilla_id) AS doc_total,
              (SELECT COUNT(*) FROM documento_adjunto da
                WHERE da.ros_id = r.id AND da.documento_requerido_id IS NOT NULL) AS doc_cargados,
              (SELECT COUNT(*) FROM solicitud_subsanacion s
                WHERE s.ros_id = r.id AND s.estado = 'pendiente') AS pendientes_subsanacion
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

      {/* KPIs */}
      <div className="kpis">
        <KpiCard label="Total de ROS registrados" value={totales.total} badge="Histórico" tone="blue" />
        <KpiCard label="En análisis UAF" value={totales.enAnalisis} badge="En curso" tone="teal" />
        <KpiCard label="Con subsanación pendiente" value={totales.subsanacion} badge="Requieren acción" tone="amber" />
        <KpiCard label="Clasificados alto riesgo" value={totales.altos} badge="Prioridad" tone="red" />
      </div>

      {/* Alertas de subsanación */}
      {subsanacionesPendientes.length > 0 && (
        <div className="notice amber" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>
              {subsanacionesPendientes.length} solicitud{subsanacionesPendientes.length > 1 ? 'es' : ''} de subsanación pendiente{subsanacionesPendientes.length > 1 ? 's' : ''}
            </strong>
            <div style={{ display: 'grid', gap: 4 }}>
              {subsanacionesPendientes.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{s.numero_ros}</span>
                  <span>—</span>
                  <span>{s.motivo}</span>
                  <Link href={`/portal/ros/${s.ros_id}`} style={{ marginLeft: 'auto', color: '#7a4b00', fontWeight: 700, textDecoration: 'underline' }}>
                    Atender →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                <Link key={r.id} href={`/portal/ros/${r.id}`} className="report-item" style={r.nivel_riesgo ? { borderLeft: `4px solid var(--${riskTone(r.nivel_riesgo)})` } : undefined}>
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
                    <span>
                      USD {r.monto.toLocaleString('en-US')} · Docs: {r.doc_cargados}/{r.doc_total}
                      {r.pendientes_subsanacion > 0 && (
                        <span style={{ marginLeft: 8 }}><Badge tone="amber">{r.pendientes_subsanacion} subsanación</Badge></span>
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
