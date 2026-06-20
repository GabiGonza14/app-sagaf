import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractClientIp } from '@/lib/audit';
import { TopBar } from '@/components/TopBar';
import { Badge, riskTone, estadoTone, estadoLabel } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { InfoBox } from '@/components/InfoBox';
import { Notice } from '@/components/Notice';

import { ProgressList } from '@/components/ProgressBar';
import { Timeline } from '@/components/Timeline';
import { RosExpedienteTabs } from './ExpedienteTabs';

export const revalidate = 0;

interface RosRow {
  id: string;
  numero_ros: string;
  sujeto_obligado_id: string;
  sujeto_nombre: string;
  sujeto_tipo: string;
  plantilla_id: string;
  oficial_cumplimiento: string;
  fecha_deteccion: string;
  fecha_recepcion: string;
  estado: string;
  descripcion: string;
}
interface ParteRow {
  id: string;
  rol_en_operacion: string;
  tipo_persona: string;
  identificador: string;
  identificador_enmascarado: string;
  nombre_visible: string | null;
}
interface OpRow {
  monto: number; moneda: string;
  jurisdiccion: string | null;
  producto_servicio: string | null;
  bien_inmueble: string | null;
  forma_pago: string | null;
  senal_alerta: string;
}
interface DocReqRow { id: string; nombre: string; orden: number; tipo_requerimiento: string }
interface DocAdjRow {
  id: string;
  documento_requerido_id: string | null;
  nombre_archivo: string;
  ruta_archivo: string;
  estado: string;
  observacion: string | null;
  fecha_carga: string;
}
interface RiesgoRow {
  id: string; nivel: string; puntaje: number;
  justificacion: string;
  fecha_clasificacion: string;
  clasificado_por_nombre: string;
}
interface AsignacionRow {
  analista_id: string;
  analista_nombre: string;
  fecha_asignacion: string;
  asignado_por_nombre: string;
}
interface AnalistaRow { id: string; nombre: string }
interface VinculoRow {
  id: string; ros_destino_id: string; numero_ros: string; tipo_vinculo: string;
  descripcion: string | null; confirmado: number;
}
interface AuditoriaRow {
  fecha_hora_servidor: string; usuario_correo: string | null; rol: string | null;
  accion: string; modulo: string; resultado: string; criticidad: string; detalle: string | null;
}
interface SubsRow {
  id: string; motivo: string; estado: string; fecha_solicitud: string;
  fecha_limite: string | null; documento_adjunto_id: string | null;
  documento_requerido_id: string | null;
}

export default async function ExpedienteUaf({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const ros = db.prepare<[string], RosRow>(
    `SELECT r.*, so.nombre AS sujeto_nombre, so.tipo AS sujeto_tipo
       FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
      WHERE r.id = ?`,
  ).get(id);
  if (!ros) notFound();

  // Analistas solo pueden acceder a ROS que les fueron asignados formalmente
  if (session.user.rol === 'analista') {
    const asignado = db.prepare<[string, string], { id: string }>(
      `SELECT id FROM asignacion_ros WHERE ros_id = ? AND analista_id = ? AND activa = 1`,
    ).get(id, session.user.id);
    if (!asignado) {
      const h2 = await headers();
      audit({
        modulo: 'expediente', accion: 'consulta_expediente', resultado: 'bloqueado',
        usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
        recurso_afectado: ros.numero_ros,
        ip: extractClientIp(h2),
        user_agent: h2.get('user-agent'),
        criticidad: 'alta',
      });
      return (
        <>
          <TopBar eyebrow="Expediente del ROS" title={ros.numero_ros}
            description="" />
          <div className="notice" style={{ color: 'var(--red)', borderColor: 'var(--red)', marginTop: 16 }}>
            <strong>Acceso restringido.</strong> Este ROS no le ha sido asignado.
            Solo puede gestionar los expedientes que el Supervisor le asigne formalmente.
          </div>
        </>
      );
    }
  }

  const h = await headers();
  audit({
    modulo: 'expediente', accion: 'consulta_expediente', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros,
    ip: extractClientIp(h),
    user_agent: h.get('user-agent'),
  });

  const partes = db.prepare<[string], ParteRow>(
    `SELECT id, rol_en_operacion, tipo_persona, identificador, identificador_enmascarado, nombre_visible
       FROM parte_involucrada WHERE ros_id = ?`,
  ).all(id);

  const op = db.prepare<[string], OpRow>(
    `SELECT monto, moneda, jurisdiccion, producto_servicio, bien_inmueble, forma_pago, senal_alerta
       FROM operacion_sospechosa WHERE ros_id = ?`,
  ).get(id);

  // Valores de campos dinámicos de la plantilla (RF-01, data-driven)
  const camposDin = db.prepare<[string], { nombre: string; valor: string | null }>(
    `SELECT cp.nombre, vcr.valor
       FROM valor_campo_ros vcr JOIN campo_plantilla cp ON cp.id = vcr.campo_plantilla_id
      WHERE vcr.ros_id = ? ORDER BY cp.orden`,
  ).all(id);

  const docsReq = db.prepare<[string], DocReqRow>(
    'SELECT id, nombre, orden, tipo_requerimiento FROM documento_requerido WHERE plantilla_id = ? ORDER BY orden',
  ).all(ros.plantilla_id);

  const docsAdj = db.prepare<[string], DocAdjRow>(
    `SELECT id, documento_requerido_id, nombre_archivo, ruta_archivo, estado, observacion, fecha_carga
       FROM documento_adjunto WHERE ros_id = ?`,
  ).all(id);

  const riesgos = db.prepare<[string], RiesgoRow>(
    `SELECT rc.id, rc.nivel, rc.puntaje, rc.justificacion, rc.fecha_clasificacion,
            u.nombre AS clasificado_por_nombre
       FROM riesgo_caso rc JOIN usuario u ON u.id = rc.clasificado_por
      WHERE rc.ros_id = ? AND rc.anulado = 0
      ORDER BY rc.fecha_clasificacion DESC`,
  ).all(id);
  const riesgoActual = riesgos[0] ?? null;

  const vinculos = db.prepare<[string, string, string], VinculoRow>(
    `SELECT v.id, v.ros_destino_id, r2.numero_ros, v.tipo_vinculo, v.descripcion, v.confirmado,
            (SELECT 1 FROM riesgo_caso rc
              WHERE rc.ros_id IN (v.ros_origen_id, v.ros_destino_id)
                AND rc.nivel = 'alto'
                AND rc.fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)
              LIMIT 1) AS alto_riesgo
        FROM vinculo_intersectorial v
        JOIN ros r2 ON r2.id = CASE WHEN v.ros_origen_id = ? THEN v.ros_destino_id ELSE v.ros_origen_id END
       WHERE (v.ros_origen_id = ? OR v.ros_destino_id = ?)
         AND (v.confirmado = 1 OR v.decidido_por IS NULL)`,
  ).all(id, id, id);

  const auditoria = db.prepare<[string, string], AuditoriaRow>(
    `SELECT fecha_hora_servidor, usuario_correo, rol, accion, modulo, resultado, criticidad, detalle
       FROM evento_auditoria
      WHERE recurso_afectado = ? OR recurso_afectado = (SELECT numero_ros FROM ros WHERE id = ?)
      ORDER BY fecha_hora_servidor DESC LIMIT 30`,
  ).all(id, id);

  // A4: marcar como vencidas las subsanaciones que superaron su fecha límite
  db.prepare(
    `UPDATE solicitud_subsanacion SET estado = 'vencida'
      WHERE estado = 'pendiente' AND fecha_limite IS NOT NULL AND fecha_limite < date('now')`,
  ).run();

  const subs = db.prepare<[string], SubsRow>(
    `SELECT id, motivo, estado, fecha_solicitud, fecha_limite, documento_adjunto_id, documento_requerido_id
       FROM solicitud_subsanacion WHERE ros_id = ? ORDER BY fecha_solicitud DESC`,
  ).all(id);

  const completitud = docsReq.length === 0
    ? 0
    : Math.round((docsAdj.filter((d) => d.documento_requerido_id).length / docsReq.length) * 100);
  const docsReqObligatorios = docsReq.filter((d) => d.tipo_requerimiento === 'requerido');
  const docsReqCondicionales = docsReq.filter((d) => d.tipo_requerimiento === 'condicional');
  const docsReqOpcionales = docsReq.filter((d) => d.tipo_requerimiento === 'opcional');
  const countCargados = (docs: DocReqRow[]) => docs.filter((d) => docsAdj.some((a) => a.documento_requerido_id === d.id)).length;
  const obligatoriosCargados = countCargados(docsReqObligatorios);
  const condicionalesCargados = countCargados(docsReqCondicionales);
  const opcionalesCargados = countCargados(docsReqOpcionales);
  const completitudObligatoria = docsReqObligatorios.length === 0
    ? 100
    : Math.round((obligatoriosCargados / docsReqObligatorios.length) * 100);

  const canClassify = ['analista', 'supervisor'].includes(session.user.rol);
  const canClose = session.user.rol === 'supervisor';
  const canReopen = session.user.rol === 'supervisor';
  const canRevertRiesgo = ['analista', 'supervisor'].includes(session.user.rol);

  // Workflow: docs obligatorios resueltos (validado o no aplica) para gatear Riesgo.
  // Si un obligatorio queda observado/cargado/pendiente, se espera corrección o validación antes de clasificar.
  const requiredValidados = docsReq.filter((r) =>
    r.tipo_requerimiento === 'requerido' &&
    docsAdj.some((d) => d.documento_requerido_id === r.id && ['validado', 'no_aplica'].includes(d.estado)),
  ).length;
  const requiredTotal = docsReq.filter((d) => d.tipo_requerimiento === 'requerido').length;
  const allRequiredDocsValidated = requiredTotal === 0 || requiredValidados >= requiredTotal;
  const riesgoClasificado = !!riesgoActual;

  const asignacion = db.prepare<[string], AsignacionRow>(
    `SELECT ar.analista_id, rtrim(u.nombre, ', ') AS analista_nombre, ar.fecha_asignacion,
            us.nombre AS asignado_por_nombre
       FROM asignacion_ros ar
       JOIN usuario u  ON u.id  = ar.analista_id
       JOIN usuario us ON us.id = ar.asignado_por
      WHERE ar.ros_id = ? AND ar.activa = 1`,
  ).get(id) ?? null;

  const analistas = canClose
    ? db.prepare<[], AnalistaRow>(
        `SELECT u.id, rtrim(u.nombre, ', ') AS nombre FROM usuario u
           JOIN rol r ON r.id = u.rol_id
          WHERE r.nombre = 'analista' AND u.estado = 'activo'
          ORDER BY u.nombre`,
      ).all()
    : [];

  return (
    <>

      <TopBar
        eyebrow="Expediente del ROS"
        title={`${ros.numero_ros} · ${ros.sujeto_tipo === 'bank' ? 'Banco' : ros.sujeto_tipo === 'realestate' ? 'Inmobiliaria' : ros.sujeto_tipo}`}
        description="Reporte recibido desde el portal público. Datos sensibles enmascarados por defecto."
      />

      <RosExpedienteTabs
        rosId={ros.id}
        numeroRos={ros.numero_ros}
        estadoActual={ros.estado}
        canClassify={canClassify}
        canClose={canClose}
        canReopen={canReopen}
        canRevertRiesgo={canRevertRiesgo}
        allRequiredDocsValidated={allRequiredDocsValidated}
        requiredDocTotal={requiredTotal}
        requiredDocValidated={requiredValidados}
        riesgoClasificado={riesgoClasificado}
        summary={
          <div>
            <div className="summary-grid">
              <InfoBox label="Sujeto obligado" value={ros.sujeto_nombre} />
              <InfoBox label="Tipo" value={ros.sujeto_tipo === 'bank' ? 'Banco · Persona Jurídica/Natural' : ros.sujeto_tipo === 'realestate' ? 'Inmobiliaria / Promotora' : ros.sujeto_tipo} />
              <InfoBox label="Cliente" value={partes[0] ? <span className="masked" title="Identificador enmascarado">{partes[0].identificador_enmascarado}</span> : '—'} />
              <InfoBox label="Monto reportado" value={op ? `$${op.monto.toLocaleString('en-US')}` : '—'} />
              <InfoBox label="Estado" value={<Badge tone={estadoTone(ros.estado)}>{estadoLabel(ros.estado)}</Badge>} />
              <InfoBox label="Completitud documental" value={
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: obligatoriosCargados === docsReqObligatorios.length ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                    {obligatoriosCargados}/{docsReqObligatorios.length} obligatorios
                  </span>
                  {docsReqCondicionales.length > 0 && (
                    <span style={{ color: '#d97706', fontWeight: 600, fontSize: 13 }}>
                      {condicionalesCargados}/{docsReqCondicionales.length} condicionales
                    </span>
                  )}
                  {docsReqOpcionales.length > 0 && (
                    <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 13 }}>
                      {opcionalesCargados}/{docsReqOpcionales.length} opcionales
                    </span>
                  )}
                </span>
              } />
            </div>

            <div className="info-box" style={{ marginTop: 12 }}>
              <span className="info-box-label">Resumen narrativo</span>
              <strong style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.6 }}>{ros.descripcion}</strong>
            </div>

            {op && (
              <div className="card" style={{ marginTop: 12, padding: '16px 18px' }}>
                <h3>Operación sospechosa</h3>
                <p className="small">Detalles reportados por el sujeto obligado.</p>
                <div className="summary-grid">
                  <InfoBox label="Monto" value={`$${op.monto.toLocaleString('en-US')}`} />
                  {op.jurisdiccion && <InfoBox label="Jurisdicción" value={op.jurisdiccion} />}
                  {op.producto_servicio && <InfoBox label="Producto / servicio" value={op.producto_servicio} />}
                  {op.bien_inmueble && <InfoBox label="Bien inmueble" value={op.bien_inmueble} />}
                  {op.forma_pago && <InfoBox label="Forma de pago" value={op.forma_pago} />}
                  <InfoBox label="Señal de alerta" value={op.senal_alerta} />
                </div>
              </div>
            )}

            {camposDin.length > 0 && (
              <div className="card" style={{ marginTop: 12, padding: '16px 18px' }}>
                <h3>Información adicional de la plantilla</h3>
                <p className="small">Campos definidos por la plantilla del sector.</p>
                <div className="summary-grid">
                  {camposDin.map((c) => (
                    <InfoBox key={c.nombre} label={c.nombre} value={c.valor?.trim() ? c.valor : '—'} />
                  ))}
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: 12, padding: '16px 18px' }}>
              <h3>Partes involucradas</h3>
              <p className="small">Identificadores enmascarados por privacidad. Los datos completos requieren permisos de acceso UAF.</p>
              <div className="summary-grid">
                {partes.map((p) => (
                  <InfoBox key={p.id} label={p.rol_en_operacion.replace(/_/g, ' ')}
                    value={<>
                      <div><span className="masked" title="Identificador enmascarado">{p.identificador_enmascarado}</span></div>
                      {p.nombre_visible && <div style={{ marginTop: 6 }}>{p.nombre_visible}</div>}
                    </>} />
                ))}
              </div>
            </div>
          </div>
        }
        riesgoNode={
          <div>
            <ProgressList
              items={[
                { label: 'Señales de alerta', value: riesgoActual?.puntaje ?? 0, badge: riesgoActual ? riesgoActual.nivel : 'sin clasificar', tone: riesgoActual ? riskTone(riesgoActual.nivel) : 'gray' },
                {
                  label: 'Completitud documental obligatoria',
                  value: completitudObligatoria,
                  badge: `${obligatoriosCargados}/${docsReqObligatorios.length} obligatorios`,
                  tone: completitudObligatoria === 100 ? 'green' : completitudObligatoria >= 75 ? 'amber' : 'red',
                  detail: [
                    {
                      label: 'obligatorios',
                      value: `${obligatoriosCargados}/${docsReqObligatorios.length}`,
                      tone: completitudObligatoria === 100 ? 'green' : 'red',
                    },
                    {
                      label: 'condicionales',
                      value: `${condicionalesCargados}/${docsReqCondicionales.length}`,
                      tone: condicionalesCargados >= docsReqCondicionales.length && docsReqCondicionales.length > 0 ? 'green' : 'amber',
                    },
                    {
                      label: 'opcionales',
                      value: `${opcionalesCargados}/${docsReqOpcionales.length}`,
                      tone: opcionalesCargados > 0 ? 'teal' : 'gray',
                    },
                  ],
                },
                { label: 'Coincidencias con otros ROS', value: Math.min(vinculos.length * 25, 100), badge: `${vinculos.length} vínculo(s)`, tone: vinculos.length > 0 ? 'purple' : 'gray' },
              ]}
            />
            {riesgos.length > 0 && (
              <div className="card" style={{ marginTop: 14, padding: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Historial de clasificación</h3>
                <p className="small" style={{ marginBottom: 12 }}>Cada cambio queda registrado con su justificación.</p>
                <Timeline events={riesgos.map((r) => ({
                  title: `${r.nivel.toUpperCase()} · ${r.puntaje}/100 · ${r.clasificado_por_nombre}`,
                  description: `${r.justificacion} — ${formatPanama(r.fecha_clasificacion)}`,
                  tone: r.nivel === 'alto' ? 'red' : r.nivel === 'medio' ? 'amber' : 'green',
                }))} />
              </div>
            )}
          </div>
        }
        docsReq={docsReq}
        docsAdj={docsAdj}
        vinculos={vinculos.map((v) => ({
          id: v.id, numero_ros: v.numero_ros, tipo_vinculo: v.tipo_vinculo,
          descripcion: v.descripcion, confirmado: v.confirmado === 1,
          alto_riesgo: (v as unknown as { alto_riesgo: number | null }).alto_riesgo === 1,
        }))}
        auditEvents={auditoria.map((a) => ({
          title: `${a.accion} · ${a.usuario_correo ?? 'system'} (${a.rol ?? '—'})`,
          description: `${formatPanama(a.fecha_hora_servidor)} · módulo ${a.modulo} · ${a.resultado}${a.detalle ? ` · ${a.detalle}` : ''}`,
          tone: a.criticidad === 'critica' ? 'red' : a.criticidad === 'alta' ? 'amber' : 'default',
        }))}
        subs={subs}
        asignacion={asignacion}
        analistas={analistas}
        canAssign={canClose}
      />
    </>
  );
}
