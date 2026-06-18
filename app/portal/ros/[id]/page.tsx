import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge, estadoTone, estadoLabel, riskTone } from '@/components/Badge';
import { formatPanama, formatPanamaDate } from '@/lib/date';
import { InfoBox } from '@/components/InfoBox';

import { canAccessROS } from '@/lib/permissions';
import { ResubmitDocCard } from './ResubmitDocCard';

export const revalidate = 0;

interface RosRow {
  id: string;
  numero_ros: string;
  sujeto_obligado_id: string;
  plantilla_id: string;
  oficial_cumplimiento: string;
  fecha_deteccion: string;
  fecha_recepcion: string;
  estado: string;
  descripcion: string;
  observaciones: string | null;
}

interface ParteRow {
  rol_en_operacion: string;
  identificador_enmascarado: string;
  nombre_visible: string | null;
}

interface OpRow {
  monto: number;
  moneda: string;
  jurisdiccion: string | null;
  producto_servicio: string | null;
  bien_inmueble: string | null;
  forma_pago: string | null;
  senal_alerta: string;
}

interface DocReqRow {
  id: string;
  nombre: string;
  orden: number;
}

interface DocAdjRow {
  id: string;
  documento_requerido_id: string | null;
  nombre_archivo: string;
  estado: string;
  observacion: string | null;
  fecha_carga: string;
}

interface SubsanRow {
  id: string;
  motivo: string;
  estado: string;
  fecha_solicitud: string;
  documento_adjunto_id: string | null;
  documento_requerido_id: string | null;
}

interface RiesgoRow { nivel: string; justificacion: string }

export default async function RosDetailPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const ros = db.prepare<[string], RosRow>(
    'SELECT * FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) notFound();

  // Defensa profunda: aunque middleware ya filtra rol, comprobamos pertenencia (DEF-05).
  if (!canAccessROS(
    { id: session.user.id, correo: session.user.email ?? '', rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId },
    ros.sujeto_obligado_id,
  )) {
    redirect('/portal');
  }

  const partes = db.prepare<[string], ParteRow>(
    'SELECT rol_en_operacion, identificador_enmascarado, nombre_visible FROM parte_involucrada WHERE ros_id = ?',
  ).all(id);

  const op = db.prepare<[string], OpRow>(
    'SELECT monto, moneda, jurisdiccion, producto_servicio, bien_inmueble, forma_pago, senal_alerta FROM operacion_sospechosa WHERE ros_id = ?',
  ).get(id);

  const camposDin = db.prepare<[string], { nombre: string; valor: string | null }>(
    `SELECT cp.nombre, vcr.valor
       FROM valor_campo_ros vcr JOIN campo_plantilla cp ON cp.id = vcr.campo_plantilla_id
      WHERE vcr.ros_id = ? ORDER BY cp.orden`,
  ).all(id);

  const docsReq = db.prepare<[string], DocReqRow>(
    'SELECT id, nombre, orden FROM documento_requerido WHERE plantilla_id = ? ORDER BY orden',
  ).all(ros.plantilla_id);

  const docsAdj = db.prepare<[string], DocAdjRow>(
    'SELECT id, documento_requerido_id, nombre_archivo, estado, observacion, fecha_carga FROM documento_adjunto WHERE ros_id = ?',
  ).all(id);

  const subs = db.prepare<[string], SubsanRow>(
    'SELECT id, motivo, estado, fecha_solicitud, documento_adjunto_id, documento_requerido_id FROM solicitud_subsanacion WHERE ros_id = ? ORDER BY fecha_solicitud DESC',
  ).all(id);

  const riesgo = db.prepare<[string], RiesgoRow>(
    'SELECT nivel, justificacion FROM riesgo_caso WHERE ros_id = ? ORDER BY fecha_clasificacion DESC LIMIT 1',
  ).get(id);

  const adjByReq = new Map(docsAdj.filter((d) => d.documento_requerido_id).map((d) => [d.documento_requerido_id!, d]));
  const extras   = docsAdj.filter((d) => !d.documento_requerido_id);

  // Solicitudes pendientes de la UAF para documentos faltantes (sin adjunto previo)
  const pendingSolicitudesByDocReq = new Map(
    subs
      .filter((s) => s.estado === 'pendiente' && s.documento_requerido_id && !s.documento_adjunto_id)
      .map((s) => [s.documento_requerido_id!, s.motivo]),
  );

  return (
    <>

      <TopBar
        eyebrow="Detalle del ROS"
        title={`${ros.numero_ros} · ${estadoLabel(ros.estado, 'portal')}`}
        description="Visualiza el estado, completitud documental y solicitudes de subsanación de la UAF."
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {ros.estado === 'borrador' && (
              <Link href={`/portal/ros/${ros.id}/editar`} className="btn primary" style={{ padding: '7px 12px', fontSize: 12 }}>
                Continuar edición
              </Link>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div className="card">
          <div className="panel-head"><div><h3>Resumen</h3><p>Datos generales del reporte.</p></div></div>

          <div className="summary-grid">
            <InfoBox label="Número" value={<strong>{ros.numero_ros}</strong>} />
            <InfoBox label="Estado" value={<Badge tone={estadoTone(ros.estado)}>{estadoLabel(ros.estado, 'portal')}</Badge>} />
            <InfoBox label="Fecha detección" value={formatPanamaDate(ros.fecha_deteccion)} />
            <InfoBox label="Fecha recepción UAF" value={formatPanama(ros.fecha_recepcion)} />
            <InfoBox label="Oficial de cumplimiento" value={ros.oficial_cumplimiento} />
            <InfoBox label="Riesgo asignado" value={riesgo ? <Badge tone={riskTone(riesgo.nivel)}>{riesgo.nivel}</Badge> : <span className="small">Sin clasificar aún</span>} />
            {op && (
              <>
                <InfoBox label="Monto" value={`USD ${op.monto.toLocaleString('en-US')}`} />
                <InfoBox label="Jurisdicción" value={op.jurisdiccion ?? '—'} />
                <InfoBox label="Señal de alerta" value={op.senal_alerta} />
                <InfoBox label="Producto / Bien" value={op.producto_servicio ?? op.bien_inmueble ?? '—'} />
              </>
            )}
          </div>

          <div className="info-box" style={{ marginTop: 12 }}>
            <span className="info-box-label">Resumen narrativo</span>
            <strong>{ros.descripcion}</strong>
          </div>

          {ros.observaciones && (
            <div className="info-box" style={{ marginTop: 8, borderColor: '#fedf89', background: 'var(--amber-soft)' }}>
              <span className="info-box-label" style={{ color: 'var(--amber)' }}>Observaciones adicionales</span>
              <strong>{ros.observaciones}</strong>
            </div>
          )}
        </div>

        <div className="card">
          <div className="panel-head">
            <div>
              <h3>Partes involucradas</h3>
              <p>Identificadores enmascarados por privacidad.</p>
            </div>
          </div>

          <div className="summary-grid">
            {partes.map((p, i) => (
              <InfoBox
                key={i}
                label={p.rol_en_operacion.replace(/_/g, ' ')}
                value={
                  <>
                    <div><span className="masked" title="Identificador enmascarado">{p.identificador_enmascarado}</span></div>
                    {p.nombre_visible && <div style={{ marginTop: 6 }}>{p.nombre_visible}</div>}
                  </>
                }
              />
            ))}
          </div>
        </div>
      </div>

      {camposDin.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div><h3>Información adicional de la plantilla</h3><p>Campos definidos por la plantilla de tu sector.</p></div>
          </div>
          <div className="summary-grid">
            {camposDin.map((c) => (
              <InfoBox key={c.nombre} label={c.nombre} value={c.valor?.trim() ? c.valor : '—'} />
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div><h3>Solicitudes de subsanación de la UAF</h3><p>Corrija los documentos observados sin necesidad de crear un nuevo ROS.</p></div>
          {subs.filter((s) => s.estado === 'pendiente').length > 0 && (
            <Badge tone="amber">{subs.filter((s) => s.estado === 'pendiente').length} pendiente(s)</Badge>
          )}
        </div>

        {subs.length === 0 ? (
          <div className="notice green">No hay solicitudes pendientes de subsanación.</div>
        ) : (
          <div className="report-list">
            {subs.map((s) => {
              const adj = docsAdj.find((d) => d.id === s.documento_adjunto_id);
              return (
                <div key={s.id} className="report-item">
                  <div className="report-top">
                    <strong>Solicitud #{s.id.slice(0, 8)}</strong>
                    <Badge tone={s.estado === 'pendiente' ? 'amber' : 'green'}>{s.estado}</Badge>
                  </div>
                  <div className="report-meta">
                    <span><strong>Motivo:</strong> {s.motivo}</span>
                    {adj && <span><strong>Documento:</strong> {adj.nombre_archivo}</span>}
                    <span>{formatPanama(s.fecha_solicitud)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div><h3>Documentos requeridos por la plantilla</h3><p>Cada documento solicitado tiene su propio contenedor de carga independiente.</p></div>
        </div>

        <div className="doc-grid">
          {docsReq.map((dr, i) => {
            const adj = adjByReq.get(dr.id);
            const solicitudMotivo = pendingSolicitudesByDocReq.get(dr.id) ?? null;
            return (
              <ResubmitDocCard
                key={dr.id}
                rosId={ros.id}
                docReqId={dr.id}
                index={i + 1}
                nombre={dr.nombre}
                readOnly={ros.estado !== 'borrador' && adj?.estado !== 'observado' && !solicitudMotivo}
                solicitudMotivo={solicitudMotivo}
                adjunto={adj ? {
                  id: adj.id,
                  nombre_archivo: adj.nombre_archivo,
                  estado: adj.estado,
                  observacion: adj.observacion,
                  fecha_carga: adj.fecha_carga,
                } : null}
              />
            );
          })}
        </div>

        {extras.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Evidencia adicional no catalogada</h4>
            <div className="doc-grid">
              {extras.map((e) => (
                <div key={e.id} className="doc-card">
                  <div className="doc-top">
                    <div className="doc-title">{e.nombre_archivo}</div>
                    <span className="badge gray">extra</span>
                  </div>
                  <div className="small" style={{ color: 'var(--muted)' }}>
                    Cargado: {formatPanama(e.fecha_carga)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
