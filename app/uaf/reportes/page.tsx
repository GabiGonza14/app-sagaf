import { headers } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractClientIp } from '@/lib/audit';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, estadoLabel } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { InfoBox } from '@/components/InfoBox';
import { ReportesFilterForm } from './ReportesFilterForm';

export const revalidate = 0;

function formatSector(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SP {
  tipo?: string;
  sector?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

function buildFilter(f: Readonly<{
  sector?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string;
}>) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  if (f.sector)      { conds.push('so.sector = ?');                      vals.push(f.sector); }
  if (f.estado)      { conds.push('r.estado = ?');                       vals.push(f.estado); }
  if (f.fecha_desde) { conds.push("date(r.fecha_recepcion) >= date(?)"); vals.push(f.fecha_desde); }
  if (f.fecha_hasta) { conds.push("date(r.fecha_recepcion) <= date(?)"); vals.push(f.fecha_hasta); }
  return {
    where: conds.length ? `WHERE ${conds.join(' AND ')}`  : '',
    and:   conds.length ? `AND ${conds.join(' AND ')}`    : '',
    vals,
  };
}

const TIPO_LABEL: Record<string, string> = {
  operativo:    'Reporte Operativo',
  documental:   'Reporte Documental',
  estadistico:  'Reporte Estadístico',
  inteligencia: 'Inteligencia Financiera',
};

export default async function ReportesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  const sp = await searchParams;

  const tipo   = sp.tipo        ?? 'operativo';
  const sector = sp.sector      ?? '';
  const estado = sp.estado      ?? '';
  const fd     = sp.fecha_desde ?? '';
  const fh     = sp.fecha_hasta ?? '';

  const f = buildFilter({
    sector:      sector || undefined,
    estado:      estado || undefined,
    fecha_desde: fd     || undefined,
    fecha_hasta: fh     || undefined,
  });

  const h = await headers();
  audit({
    modulo: 'reportes', accion: 'generar_reporte', resultado: 'exito',
    usuario_id: session!.user.id, usuario_correo: session!.user.email, rol: session!.user.rol,
    ip: extractClientIp(h) ?? undefined,
    user_agent: h.get('user-agent') ?? undefined,
    detalle: { tipo, sector, estado, fecha_desde: fd, fecha_hasta: fh },
  });

  const totalROS  = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM ros').get()!.c;
  const totalAlto = db.prepare<[], { c: number }>(
    `SELECT COUNT(DISTINCT ros_id) AS c FROM riesgo_caso rc
       WHERE nivel = 'alto'
         AND fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)`,
  ).get()!.c;
  const subsPend  = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM solicitud_subsanacion WHERE estado = 'pendiente'`,
  ).get()!.c;
  const docsTotal = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM documento_adjunto').get()!.c;

  const canExport    = session!.user.rol === 'supervisor';
  const exportParams = new URLSearchParams({
    tipo,
    ...(sector && { sector }),
    ...(estado && { estado }),
    ...(fd && { fecha_desde: fd }),
    ...(fh && { fecha_hasta: fh }),
  });

  interface ResumenSector {
    sector: string; total: number; alto: number; medio: number; bajo: number; monto: number;
  }
  interface ResumenTiempo {
    numero_ros: string; fecha_recepcion: string; estado: string; tiempo_horas: number | null;
  }
  const porSector = tipo === 'operativo'
    ? db.prepare<unknown[], ResumenSector>(
        `SELECT so.sector, COUNT(*) AS total,
                SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'alto'  THEN 1 ELSE 0 END) AS alto,
                SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'medio' THEN 1 ELSE 0 END) AS medio,
                SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'bajo'  THEN 1 ELSE 0 END) AS bajo,
                COALESCE(SUM((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id)), 0) AS monto
           FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where} GROUP BY so.sector ORDER BY total DESC`,
      ).all(...f.vals)
    : [];

  const tiempos = tipo === 'operativo'
    ? db.prepare<unknown[], ResumenTiempo>(
        `SELECT r.numero_ros, r.fecha_recepcion, r.estado,
                CAST((julianday(COALESCE(
                  (SELECT MAX(fecha_hora_servidor) FROM evento_auditoria WHERE recurso_afectado = r.numero_ros),
                  r.fecha_recepcion)) - julianday(r.fecha_recepcion)) * 24 AS REAL) AS tiempo_horas
           FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where} ORDER BY r.fecha_recepcion DESC LIMIT 10`,
      ).all(...f.vals)
    : [];

  interface DocCompletitud { nombre: string; total_ros: number; cargados: number }
  const completitudDocs = tipo === 'documental'
    ? db.prepare<unknown[], DocCompletitud>(
        `SELECT dr.nombre,
                COUNT(DISTINCT r.id) AS total_ros,
                COUNT(da.id)         AS cargados
           FROM documento_requerido dr
           JOIN ros r ON r.plantilla_id = dr.plantilla_id
           JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           LEFT JOIN documento_adjunto da ON da.documento_requerido_id = dr.id AND da.ros_id = r.id
           ${f.where}
           GROUP BY dr.id, dr.nombre ORDER BY dr.plantilla_id, dr.orden`,
      ).all(...f.vals)
    : [];

  interface DocEstado { estado: string; total: number }
  const docsPorEstado = tipo === 'documental'
    ? db.prepare<unknown[], DocEstado>(
        `SELECT da.estado, COUNT(*) AS total
           FROM documento_adjunto da
           JOIN ros r ON r.id = da.ros_id
           JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where} GROUP BY da.estado ORDER BY total DESC`,
      ).all(...f.vals)
    : [];

  interface ResumenRiesgo { nivel: string; total: number }
  const porRiesgo = tipo === 'estadistico'
    ? db.prepare<unknown[], ResumenRiesgo>(
        `SELECT rc.nivel, COUNT(DISTINCT rc.ros_id) AS total
           FROM riesgo_caso rc
           JOIN ros r ON r.id = rc.ros_id
           JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           WHERE rc.fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)
             ${f.and}
           GROUP BY rc.nivel ORDER BY total DESC`,
      ).all(...f.vals)
    : [];

  interface ResumenEstado { estado: string; total: number }
  const porEstado = tipo === 'estadistico'
    ? db.prepare<unknown[], ResumenEstado>(
        `SELECT r.estado, COUNT(*) AS total
           FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where} GROUP BY r.estado ORDER BY total DESC`,
      ).all(...f.vals)
    : [];

  interface Jurisdiccion { jurisdiccion: string; total: number }
  const jurisdicciones = tipo === 'inteligencia'
    ? db.prepare<unknown[], Jurisdiccion>(
        `SELECT os.jurisdiccion, COUNT(*) AS total
           FROM operacion_sospechosa os
           JOIN ros r ON r.id = os.ros_id
           JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where ? f.where + ' AND os.jurisdiccion IS NOT NULL' : 'WHERE os.jurisdiccion IS NOT NULL'}
           GROUP BY os.jurisdiccion ORDER BY total DESC LIMIT 10`,
      ).all(...f.vals)
    : [];

  interface Senal { senal_alerta: string; total: number }
  const senales = tipo === 'inteligencia'
    ? db.prepare<unknown[], Senal>(
        `SELECT os.senal_alerta, COUNT(*) AS total
           FROM operacion_sospechosa os
           JOIN ros r ON r.id = os.ros_id
           JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
           ${f.where} GROUP BY os.senal_alerta ORDER BY total DESC LIMIT 10`,
      ).all(...f.vals)
    : [];

  interface VinculoStats { total: number; confirmados: number }
  const vinculoStats = tipo === 'inteligencia'
    ? (db.prepare<[], VinculoStats>(
        `SELECT COUNT(*) AS total, SUM(confirmado) AS confirmados FROM vinculo_intersectorial`,
      ).get() ?? { total: 0, confirmados: 0 })
    : null;

  const EMPTY = <div className="notice">Sin datos para los criterios seleccionados.</div>;
  const TableWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="table-wrapper">{children}</div>
  );

  return (
    <>
      <TopBar
        eyebrow="Reportes e inteligencia financiera"
        title={TIPO_LABEL[tipo] ?? 'Reportes'}
        description="Datos agregados y anonimizados. La visualización y exportación quedan registradas en auditoría."
      />

      <div className="kpis">
        <KpiCard label="Total ROS"          value={totalROS}  badge="Histórico"  tone="blue" />
        <KpiCard label="Alto riesgo"        value={totalAlto} badge="Atención"   tone="red" />
        <KpiCard label="Subsanación pend."  value={subsPend}  badge="Pendientes" tone="amber" />
        <KpiCard label="Docs. adjuntos"     value={docsTotal} badge="Sustento"   tone="green" />
      </div>

      <ReportesFilterForm tipo={tipo} sector={sector} estado={estado} fd={fd} fh={fh} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        {canExport
          ? <a className="btn ghost" href={`/api/reportes?${exportParams}`}>Exportar CSV</a>
          : <Badge tone="amber">Exportación reservada a Supervisor</Badge>}
      </div>

      {tipo === 'operativo' && (
        <>
          <div className="card">
            <h3 style={{ margin: 0 }}>ROS por sector económico</h3>
            <p className="small" style={{ marginBottom: 12 }}>Datos agregados por sector reportante — sin identificación individual.</p>
            {porSector.length === 0 ? EMPTY : (
              <TableWrap>
                <table className="table" style={{ minWidth: 650 }}>
                  <thead><tr><th>Sector</th><th>Total</th><th>Alto</th><th>Medio</th><th>Bajo</th><th>Monto (USD)</th></tr></thead>
                  <tbody>
                    {porSector.map((s) => (
                      <tr key={s.sector}>
                        <td><strong>{formatSector(s.sector)}</strong></td>
                        <td>{s.total}</td>
                        <td><Badge tone="red">{s.alto}</Badge></td>
                        <td><Badge tone="amber">{s.medio}</Badge></td>
                        <td><Badge tone="green">{s.bajo}</Badge></td>
                        <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${s.monto.toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ margin: 0 }}>Tiempos de atención (últimos 10)</h3>
            <p className="small" style={{ marginBottom: 12 }}>Horas desde recepción hasta último evento auditado.</p>
            {tiempos.length === 0 ? EMPTY : (
              <TableWrap>
                <table className="table" style={{ minWidth: 600 }}>
                  <thead><tr><th>ROS</th><th>Recibido</th><th>Estado</th><th>Tiempo (horas)</th></tr></thead>
                  <tbody>
                    {tiempos.map((t) => (
                      <tr key={t.numero_ros}>
                        <td><strong style={{ color: 'var(--primary-dark)' }}>{t.numero_ros}</strong></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatPanama(t.fecha_recepcion)}</td>
                        <td><Badge tone="blue">{estadoLabel(t.estado)}</Badge></td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.tiempo_horas?.toFixed(1) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </>
      )}

      {tipo === 'documental' && (
        <>
          <div className="card">
            <h3 style={{ margin: 0 }}>Completitud documental por tipo</h3>
            <p className="small" style={{ marginBottom: 12 }}>Evalúa cumplimiento por tipo de documento requerido.</p>
            {completitudDocs.length === 0 ? EMPTY : (
              <TableWrap>
                <table className="table" style={{ minWidth: 700 }}>
                  <thead><tr><th style={{ minWidth: 220 }}>Documento requerido</th><th>Esperados</th><th>Cargados</th><th>Faltantes</th><th>%</th></tr></thead>
                  <tbody>
                    {completitudDocs.map((d) => {
                      const faltantes = Math.max(0, d.total_ros - d.cargados);
                      const pct = d.total_ros > 0 ? Math.round((d.cargados / d.total_ros) * 100) : 0;
                      return (
                        <tr key={d.nombre}>
                          <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.nombre}>{d.nombre}</td>
                          <td>{d.total_ros}</td>
                          <td><Badge tone="green">{d.cargados}</Badge></td>
                          <td><Badge tone={faltantes > 0 ? 'amber' : 'green'}>{faltantes}</Badge></td>
                          <td><Badge tone={pct >= 90 ? 'green' : pct >= 60 ? 'amber' : 'red'}>{pct}%</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ margin: 0 }}>Documentos por estado</h3>
            <p className="small" style={{ marginBottom: 12 }}>Distribución del estado actual de adjuntos recibidos.</p>
            {docsPorEstado.length === 0 ? EMPTY : (
              <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {docsPorEstado.map((d) => <InfoBox key={d.estado} label={estadoLabel(d.estado)} value={d.total} />)}
              </div>
            )}
          </div>
        </>
      )}

      {tipo === 'estadistico' && (
        <div className="uaf-layout">
          <div className="card">
            <h3 style={{ margin: 0 }}>Distribución por nivel de riesgo</h3>
            <p className="small" style={{ marginBottom: 12 }}>Clasificación vigente (última por ROS).</p>
            {porRiesgo.length === 0 ? EMPTY : (
              <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                {porRiesgo.map((r) => <InfoBox key={r.nivel} label={r.nivel.toUpperCase()} value={r.total} />)}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ margin: 0 }}>ROS por estado de flujo</h3>
            <p className="small" style={{ marginBottom: 12 }}>Distribución del flujo de trabajo actual.</p>
            {porEstado.length === 0 ? EMPTY : (
              <TableWrap>
                <table className="table" style={{ minWidth: 400 }}>
                  <thead><tr><th>Estado</th><th>Total</th></tr></thead>
                  <tbody>
                    {porEstado.map((e) => (
                      <tr key={e.estado}>
                        <td>{estadoLabel(e.estado)}</td>
                        <td><Badge tone="blue">{e.total}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </div>
      )}

      {tipo === 'inteligencia' && (
        <>
          <div className="uaf-layout">
            <div className="card">
              <h3 style={{ margin: 0 }}>Jurisdicciones más frecuentes</h3>
              <p className="small" style={{ marginBottom: 12 }}>Volumen de operaciones sospechosas por jurisdicción.</p>
              {jurisdicciones.length === 0 ? EMPTY : (
                <TableWrap>
                  <table className="table" style={{ minWidth: 400 }}>
                    <thead><tr><th>Jurisdicción</th><th>ROS</th></tr></thead>
                    <tbody>
                      {jurisdicciones.map((j) => (
                        <tr key={j.jurisdiccion}>
                          <td style={{ fontWeight: 600 }}>{j.jurisdiccion}</td>
                          <td><Badge tone="red">{j.total}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </div>

            <div className="card">
              <h3 style={{ margin: 0 }}>Riesgo reportado</h3>
              <p className="small" style={{ marginBottom: 12 }}>Patrones de actividad sospechosa reportada.</p>
              {senales.length === 0 ? EMPTY : (
                <TableWrap>
                  <table className="table" style={{ minWidth: 400 }}>
                    <thead><tr><th>Riesgo reportado</th><th>Frecuencia</th></tr></thead>
                    <tbody>
                      {senales.map((s) => (
                        <tr key={s.senal_alerta}>
                          <td style={{ fontSize: 13 }}>{s.senal_alerta}</td>
                          <td><Badge tone="amber">{s.total}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </div>
          </div>

          {vinculoStats && (
            <div className="card" style={{ marginTop: 18 }}>
              <h3 style={{ margin: 0 }}>Vínculos intersectoriales</h3>
              <p className="small" style={{ marginBottom: 12 }}>Coincidencias detectadas entre ROS de distintos sujetos obligados.</p>
              <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <InfoBox label="Detectados"             value={vinculoStats.total} />
                <InfoBox label="Confirmados"            value={vinculoStats.confirmados ?? 0} />
                <InfoBox label="Pendientes de revisión" value={vinculoStats.total - (vinculoStats.confirmados ?? 0)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="notice" style={{ marginTop: 18 }}>
        <strong>Privacidad por diseño</strong>: reportes con datos agregados sin identificadores personales.
        Visualización y exportación registradas en auditoría.
      </div>
    </>
  );
}
