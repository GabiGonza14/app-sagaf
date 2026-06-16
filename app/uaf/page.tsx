import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, riskTone, estadoTone, estadoLabel } from '@/components/Badge';
import { FilterBar } from './FilterBar';
import { Landmark, Home, MapPin } from 'lucide-react';

export const revalidate = 0;

function buildInnerFilters(
  params: { q?: string; tipo?: string; estado?: string; sector?: string },
  isAnalista: boolean,
  userId: string,
) {
  const filters: string[] = ["r.estado != 'borrador'"];
  const vals: unknown[] = [];
  if (params.q) {
    filters.push(`(r.numero_ros LIKE ? OR so.nombre LIKE ? OR EXISTS (
      SELECT 1 FROM parte_involucrada pi WHERE pi.ros_id = r.id AND pi.identificador_enmascarado LIKE ?
    ) OR EXISTS (
      SELECT 1 FROM documento_adjunto da WHERE da.ros_id = r.id AND da.nombre_archivo LIKE ?
    ))`);
    vals.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`, `%${params.q}%`);
  }
  if (params.tipo)   { filters.push(`so.tipo = ?`);    vals.push(params.tipo); }
  if (params.estado) { filters.push(`r.estado = ?`);   vals.push(params.estado); }
  if (params.sector) { filters.push(`so.sector = ?`);  vals.push(params.sector); }
  if (isAnalista) {
    filters.push(`EXISTS (SELECT 1 FROM asignacion_ros ar WHERE ar.ros_id = r.id AND ar.analista_id = ? AND ar.activa = 1)`);
    vals.push(userId);
  }
  return { filters, vals };
}

function buildOuterFilters(params: {
  riesgo?: string; montoMin?: string; montoMax?: string; jurisdiccion?: string;
  completitud?: string; fechaDesde?: string; fechaHasta?: string;
}) {
  const filters: string[] = [];
  const vals: unknown[] = [];
  if (params.riesgo)      { filters.push(`nivel_riesgo = ?`);            vals.push(params.riesgo); }
  if (params.montoMin)    { filters.push(`monto >= ?`);                  vals.push(Number(params.montoMin)); }
  if (params.montoMax)    { filters.push(`monto <= ?`);                  vals.push(Number(params.montoMax)); }
  if (params.jurisdiccion){ filters.push(`jurisdiccion LIKE ?`);         vals.push(`%${params.jurisdiccion}%`); }
  if (params.completitud === 'completo')      filters.push(`doc_total > 0 AND doc_cargados >= doc_total`);
  if (params.completitud === 'incompleto')    filters.push(`doc_total > 0 AND doc_cargados < doc_total`);
  if (params.completitud === 'con_observados') filters.push(`doc_observados > 0`);
  if (params.fechaDesde)  { filters.push(`DATE(fecha_recepcion) >= ?`);  vals.push(params.fechaDesde); }
  if (params.fechaHasta)  { filters.push(`DATE(fecha_recepcion) <= ?`);  vals.push(params.fechaHasta); }
  return { filters, vals };
}

interface SearchParams {
  q?: string;
  tipo?: string;
  riesgo?: string;
  estado?: string;
  sector?: string;
  montoMin?: string;
  montoMax?: string;
  jurisdiccion?: string;
  completitud?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  ordenar?: string;
}

interface RosRow {
  id: string;
  numero_ros: string;
  sujeto_nombre: string;
  sujeto_tipo: string;
  sujeto_sector: string;
  estado: string;
  fecha_recepcion: string;
  monto: number;
  jurisdiccion: string | null;
  nivel_riesgo: string | null;
  doc_total: number;
  doc_cargados: number;
  doc_observados: number;
  cliente_enmascarado: string;
}

export default async function UafBandeja({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  const {
    q = '', tipo = '', riesgo = '', estado = '',
    sector = '', montoMin = '', montoMax = '', jurisdiccion = '',
    completitud = '', fechaDesde = '', fechaHasta = '', ordenar = '',
  } = await searchParams;

  // Sectores económicos disponibles para el filtro
  const sectores = db.prepare<[], { sector: string }>(
    `SELECT DISTINCT sector FROM sujeto_obligado WHERE sector IS NOT NULL ORDER BY sector`,
  ).all().map((r) => r.sector);

  // Analista solo ve los ROS que le fueron asignados formalmente por el supervisor
  const isAnalista = session?.user?.rol === 'analista';

  // Filtros de la CTE interna (sobre tablas base)
  const { filters: innerFilters, vals: innerParams } = buildInnerFilters(
    { q, tipo, estado, sector },
    isAnalista,
    session?.user?.id ?? '',
  );

  // Filtros de la CTE externa (sobre columnas calculadas)
  const { filters: outerFilters, vals: outerParams } = buildOuterFilters(
    { riesgo, montoMin, montoMax, jurisdiccion, completitud, fechaDesde, fechaHasta },
  );

  // Ordenamiento seguro (whitelist)
  const orderMap: Record<string, string> = {
    'fecha_recepcion_desc': 'ORDER BY fecha_recepcion DESC',
    'fecha_recepcion_asc': 'ORDER BY fecha_recepcion ASC',
    'monto_desc': 'ORDER BY monto DESC',
    'monto_asc': 'ORDER BY monto ASC',
    'riesgo_desc': "ORDER BY CASE nivel_riesgo WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 WHEN 'bajo' THEN 3 ELSE 4 END",
    'riesgo_asc': "ORDER BY CASE nivel_riesgo WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 WHEN 'bajo' THEN 1 ELSE 4 END",
  };
  const orderSql = orderMap[ordenar] ?? 'ORDER BY fecha_recepcion DESC';

  const sql = `
    WITH ros_base AS (
      SELECT
        r.id,
        r.numero_ros,
        so.nombre AS sujeto_nombre,
        so.tipo AS sujeto_tipo,
        so.sector AS sujeto_sector,
        r.estado,
        r.fecha_recepcion,
        COALESCE((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id), 0) AS monto,
        (SELECT jurisdiccion FROM operacion_sospechosa WHERE ros_id = r.id) AS jurisdiccion,
        (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) AS nivel_riesgo,
        (SELECT COUNT(*) FROM documento_requerido dr WHERE dr.plantilla_id = r.plantilla_id) AS doc_total,
        (SELECT COUNT(*) FROM documento_adjunto da WHERE da.ros_id = r.id AND da.documento_requerido_id IS NOT NULL) AS doc_cargados,
        (SELECT COUNT(*) FROM documento_adjunto da WHERE da.ros_id = r.id AND da.estado = 'observado') AS doc_observados,
        COALESCE((SELECT identificador_enmascarado FROM parte_involucrada WHERE ros_id = r.id LIMIT 1), '***') AS cliente_enmascarado
      FROM ros r
      JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
      WHERE ${innerFilters.join(' AND ')}
    )
    SELECT * FROM ros_base
    WHERE 1=1
      ${outerFilters.map((f) => `AND ${f}`).join('\n      ')}
    ${orderSql}
  `;

  const ros = db.prepare<unknown[], RosRow>(sql).all(...innerParams, ...outerParams);

  // KPIs (sec. 2.2 del documento; mismos del Prototipo.html)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const nuevosHoy = db
    .prepare<[string], { c: number }>(`SELECT COUNT(*) AS c FROM ros WHERE fecha_recepcion >= ?`)
    .get(todayStart.toISOString())?.c ?? 0;
  const altoRiesgo = db
    .prepare<[], { c: number }>(
      `SELECT COUNT(DISTINCT ros_id) AS c FROM riesgo_caso rc
        WHERE nivel = 'alto'
          AND fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)`,
    ).get()?.c ?? 0;
  const conSubs = db
    .prepare<[], { c: number }>(`SELECT COUNT(DISTINCT ros_id) AS c FROM solicitud_subsanacion WHERE estado = 'pendiente'`)
    .get()?.c ?? 0;
  const vinculos = db
    .prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM vinculo_intersectorial WHERE confirmado = 0`)
    .get()?.c ?? 0;

  return (
    <>
      <TopBar
        eyebrow="Sistema interno de la UAF"
        title="Bandeja de análisis de Reportes de Operaciones Sospechosas"
        description="Vista enfocada en revisar ROS recibidos, priorizar riesgo, verificar sustentos, solicitar subsanaciones y mantener trazabilidad completa sin saturar al analista."
      />

      <div className="kpis">
        <KpiCard label="Nuevos ROS" value={nuevosHoy} badge="Hoy" tone="blue" />
        <KpiCard label="Alto riesgo" value={altoRiesgo} badge="Atención prioritaria" tone="red" />
        <KpiCard label="Con sustento incompleto" value={conSubs} badge="Subsanación" tone="amber" />
        <KpiCard label="Vínculos detectados" value={vinculos} badge="Validar relación" tone="purple" />
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Bandeja de ROS</h3>
            <p>Priorizada por riesgo, estado y completitud documental.</p>
          </div>
          <span className="badge green">Actualizado</span>
        </div>

        <FilterBar
          initial={{ q, tipo, riesgo, estado, sector, montoMin, montoMax, jurisdiccion, completitud, fechaDesde, fechaHasta, ordenar }}
          sectores={sectores}
        />

        {isAnalista && (
          <div className="notice" style={{ marginBottom: 12 }}>
            Solo se muestran los ROS que le han sido asignados formalmente por un Supervisor.
          </div>
        )}

        {ros.length === 0 ? (
          <div className="notice">
            {isAnalista && !q && !tipo && !riesgo && !estado && !sector
              ? 'No tiene ROS asignados aún. Un Supervisor debe asignarle casos desde el expediente de cada ROS.'
              : 'Sin resultados para los filtros seleccionados.'}
          </div>
        ) : (
          <div className="report-list">
            {ros.map((r) => (
              <Link key={r.id} href={`/uaf/ros/${r.id}`} className="report-item">
                <div className="report-top">
                  <strong>{r.numero_ros}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.nivel_riesgo && <Badge tone={riskTone(r.nivel_riesgo)}>{r.nivel_riesgo}</Badge>}
                    <Badge tone={estadoTone(r.estado)}>{estadoLabel(r.estado)}</Badge>
                    {r.doc_observados > 0 && <Badge tone="red">{r.doc_observados} observados</Badge>}
                  </div>
                </div>
                <div className="report-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {r.sujeto_tipo === 'bank' ? <Landmark size={13} /> : r.sujeto_tipo === 'realestate' ? <Home size={13} /> : <MapPin size={13} />}
                    {r.sujeto_nombre}
                  </span>
                  <span>Sector: {r.sujeto_sector}</span>
                  <span>Cliente: <span className="masked">{r.cliente_enmascarado}</span></span>
                  <span>Sustento: {r.doc_cargados}/{r.doc_total} documentos · USD {r.monto.toLocaleString('en-US')}</span>
                  {r.jurisdiccion && <span>Jurisdicción: {r.jurisdiccion}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
