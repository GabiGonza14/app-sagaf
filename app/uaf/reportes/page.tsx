import { headers } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { InfoBox } from '@/components/InfoBox';

export const revalidate = 0;

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

  // Auditar visualización (RE-02 — no solo la exportación)
  const h = await headers();
  audit({
    modulo: 'reportes', accion: 'generar_reporte', resultado: 'exito',
    usuario_id: session!.user.id, usuario_correo: session!.user.email, rol: session!.user.rol,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined,
    user_agent: h.get('user-agent') ?? undefined,
    detalle: { tipo, sector, estado, fecha_desde: fd, fecha_hasta: fh },
  });

  // ── KPIs globales (sin filtros — siempre visibles) ──────────────────────
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

  // ── Queries por tipo (solo la sección activa) ───────────────────────────

  // OPERATIVO
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

  // DOCUMENTAL
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
           GROUP BY dr.id, dr.nombre ORDER BY dr.plantilla_id, dr.orden LIMIT 25`,
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

  // ESTADÍSTICO
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

  // INTELIGENCIA
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

  return (
    <>
      <TopBar
        eyebrow="Reportes e inteligencia financiera"
        title={TIPO_LABEL[tipo] ?? 'Reportes'}
        description="Datos agregados y anonimizados. La visualización y exportación quedan registradas en auditoría (RE-02)."
      />

      {/* KPIs globales — sin filtros */}
      <div className="kpis">
        <KpiCard label="Total ROS"          value={totalROS}  badge="Histórico"  tone="blue" />
        <KpiCard label="Alto riesgo"        value={totalAlto} badge="Atención"   tone="red" />
        <KpiCard label="Subsanación pend."  value={subsPend}  badge="Pendientes" tone="amber" />
        <KpiCard label="Docs. adjuntos"     value={docsTotal} badge="Sustento"   tone="green" />
      </div>

      {/* Filtros + selector de tipo */}
      <form method="get" className="card" style={{ padding: 16 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <div className="field">
            <label>Tipo de reporte</label>
            <select name="tipo" defaultValue={tipo}>
              <option value="operativo">Operativo</option>
              <option value="documental">Documental</option>
              <option value="estadistico">Estadístico</option>
              <option value="inteligencia">Inteligencia financiera</option>
            </select>
          </div>
          <div className="field">
            <label>Sector</label>
            <select name="sector" defaultValue={sector}>
              <option value="">Todos</option>
              <option value="financiero">Financiero</option>
              <option value="no_financiero">No financiero</option>
              <option value="actividad_profesional">Actividad profesional</option>
            </select>
          </div>
          <div className="field">
            <label>Estado del ROS</label>
            <select name="estado" defaultValue={estado}>
              <option value="">Todos</option>
              <option value="recibido">Recibido</option>
              <option value="en_analisis">En análisis</option>
              <option value="revision_documental">Revisión documental</option>
              <option value="subsanacion">Subsanación</option>
              <option value="escalado">Escalado</option>
              <option value="vinculado">Vinculado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div className="field">
            <label>Desde</label>
            <input type="date" name="fecha_desde" defaultValue={fd} />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input type="date" name="fecha_hasta" defaultValue={fh} />
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn primary">Aplicar filtros</button>
          </div>
        </div>
      </form>

      {/* Exportación controlada (RE-02, A3) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        {canExport
          ? <a className="btn ghost" href={`/api/reportes?${exportParams}`}>Exportar CSV</a>
          : <Badge tone="amber">Exportación reservada a Supervisor</Badge>}
      </div>

      {/* ── Operativo ── */}
      {tipo === 'operativo' && (
        <>
          <div className="card">
            <h3 style={{ margin: 0 }}>ROS por sector económico</h3>
            <p className="small" style={{ marginBottom: 12 }}>Datos agregados por sector reportante — sin identificación individual (RE-01, RE-03).</p>
            {porSector.length === 0 ? EMPTY : (
              <table className="table">
                <thead><tr><th>Sector</th><th>Total</th><th>Alto</th><th>Medio</th><th>Bajo</th><th>Monto (USD)</th></tr></thead>
                <tbody>
                  {porSector.map((s) => (
                    <tr key={s.sector}>
                      <td><strong>{s.sector}</strong></td>
                      <td>{s.total}</td>
                      <td><Badge tone="red">{s.alto}</Badge></td>
                      <td><Badge tone="amber">{s.medio}</Badge></td>
                      <td><Badge tone="green">{s.bajo}</Badge></td>
                      <td>USD {s.monto.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ margin: 0 }}>Tiempos de atención (últimos 10)</h3>
            <p className="small" style={{ marginBottom: 12 }}>Horas desde recepción hasta último evento auditado.</p>
            {tiempos.length === 0 ? EMPTY : (
              <table className="table">
                <thead><tr><th>ROS</th><th>Recibido</th><th>Estado</th><th>Tiempo (h)</th></tr></thead>
                <tbody>
                  {tiempos.map((t) => (
                    <tr key={t.numero_ros}>
                      <td><strong>{t.numero_ros}</strong></td>
                      <td>{formatPanama(t.fecha_recepcion)}</td>
                      <td>{t.estado}</td>
                      <td>{t.tiempo_horas?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Documental ── */}
      {tipo === 'documental' && (
        <>
          <div className="card">
            <h3 style={{ margin: 0 }}>Completitud documental por requisito (RE-04)</h3>
            <p className="small" style={{ marginBottom: 12 }}>Evalúa cumplimiento por tipo de documento requerido.</p>
            {completitudDocs.length === 0 ? EMPTY : (
              <table className="table">
                <thead><tr><th>Documento requerido</th><th>Esperados</th><th>Cargados</th><th>Faltantes</th><th>%</th></tr></thead>
                <tbody>
                  {completitudDocs.map((d) => {
                    const faltantes = Math.max(0, d.total_ros - d.cargados);
                    const pct = d.total_ros > 0 ? Math.round((d.cargados / d.total_ros) * 100) : 0;
                    return (
                      <tr key={d.nombre}>
                        <td>{d.nombre}</td>
                        <td>{d.total_ros}</td>
                        <td><Badge tone="green">{d.cargados}</Badge></td>
                        <td><Badge tone={faltantes > 0 ? 'amber' : 'green'}>{faltantes}</Badge></td>
                        <td><Badge tone={pct >= 90 ? 'green' : pct >= 60 ? 'amber' : 'red'}>{pct}%</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ margin: 0 }}>Documentos por estado</h3>
            <p className="small" style={{ marginBottom: 12 }}>Distribución del estado actual de adjuntos recibidos.</p>
            {docsPorEstado.length === 0 ? EMPTY : (
              <div className="summary-grid">
                {docsPorEstado.map((d) => <InfoBox key={d.estado} label={d.estado} value={d.total} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Estadístico ── */}
      {tipo === 'estadistico' && (
        <div className="uaf-layout">
          <div className="card">
            <h3 style={{ margin: 0 }}>Distribución por nivel de riesgo</h3>
            <p className="small" style={{ marginBottom: 12 }}>Clasificación vigente (última por ROS).</p>
            {porRiesgo.length === 0 ? EMPTY : (
              <div className="summary-grid">
                {porRiesgo.map((r) => <InfoBox key={r.nivel} label={r.nivel.toUpperCase()} value={r.total} />)}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ margin: 0 }}>ROS por estado de flujo</h3>
            <p className="small" style={{ marginBottom: 12 }}>Distribución del flujo de trabajo actual.</p>
            {porEstado.length === 0 ? EMPTY : (
              <table className="table">
                <thead><tr><th>Estado</th><th>Total</th></tr></thead>
                <tbody>
                  {porEstado.map((e) => (
                    <tr key={e.estado}>
                      <td>{e.estado}</td>
                      <td><Badge tone="blue">{e.total}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Inteligencia financiera ── */}
      {tipo === 'inteligencia' && (
        <>
          <div className="uaf-layout">
            <div className="card">
              <h3 style={{ margin: 0 }}>Jurisdicciones más frecuentes</h3>
              <p className="small" style={{ marginBottom: 12 }}>Volumen de operaciones sospechosas por jurisdicción (RE-01).</p>
              {jurisdicciones.length === 0 ? EMPTY : (
                <table className="table">
                  <thead><tr><th>Jurisdicción</th><th>ROS</th></tr></thead>
                  <tbody>
                    {jurisdicciones.map((j) => (
                      <tr key={j.jurisdiccion}>
                        <td>{j.jurisdiccion}</td>
                        <td><Badge tone="red">{j.total}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3 style={{ margin: 0 }}>Tipologías / señales de alerta</h3>
              <p className="small" style={{ marginBottom: 12 }}>Patrones básicos de actividad sospechosa reportada.</p>
              {senales.length === 0 ? EMPTY : (
                <table className="table">
                  <thead><tr><th>Señal de alerta</th><th>Frecuencia</th></tr></thead>
                  <tbody>
                    {senales.map((s) => (
                      <tr key={s.senal_alerta}>
                        <td style={{ fontSize: 13 }}>{s.senal_alerta}</td>
                        <td><Badge tone="amber">{s.total}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {vinculoStats && (
            <div className="card" style={{ marginTop: 18 }}>
              <h3 style={{ margin: 0 }}>Vínculos intersectoriales</h3>
              <p className="small" style={{ marginBottom: 12 }}>Coincidencias detectadas entre ROS de distintos sujetos obligados.</p>
              <div className="summary-grid">
                <InfoBox label="Detectados"           value={vinculoStats.total} />
                <InfoBox label="Confirmados"          value={vinculoStats.confirmados ?? 0} />
                <InfoBox label="Pendientes de revisión" value={vinculoStats.total - (vinculoStats.confirmados ?? 0)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="notice" style={{ marginTop: 18 }}>
        <strong>Privacidad por diseño (RE-03)</strong>: reportes con datos agregados sin identificadores personales.
        Visualización y exportación registradas en auditoría (RE-02).
      </div>
    </>
  );
}
