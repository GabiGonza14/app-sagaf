import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, riskTone, estadoTone, estadoLabel } from '@/components/Badge';
import { FilterBar } from './FilterBar';
import { Landmark, Home, MapPin } from 'lucide-react';

export const revalidate = 0;

interface SearchParams {
  q?: string;
  tipo?: string;
  riesgo?: string;
  estado?: string;
}

interface RosRow {
  id: string;
  numero_ros: string;
  sujeto_nombre: string;
  sujeto_tipo: string;
  estado: string;
  fecha_recepcion: string;
  monto: number;
  nivel_riesgo: string | null;
  doc_total: number;
  doc_cargados: number;
  doc_observados: number;
  cliente_enmascarado: string;
}

export default async function UafBandeja({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  const { q = '', tipo = '', riesgo = '', estado = '' } = await searchParams;

  // Construcción dinámica de filtros (RF-02); borradores nunca visibles en bandeja UAF
  const filters: string[] = ["r.estado != 'borrador'"];
  const params: unknown[] = [];

  if (q) {
    filters.push(`(r.numero_ros LIKE ? OR so.nombre LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tipo) { filters.push(`so.tipo = ?`); params.push(tipo); }
  if (estado) { filters.push(`r.estado = ?`); params.push(estado); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  let ros = db.prepare<unknown[], RosRow>(
    `
    SELECT r.id, r.numero_ros, so.nombre AS sujeto_nombre, so.tipo AS sujeto_tipo,
           r.estado, r.fecha_recepcion,
           COALESCE((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id), 0) AS monto,
           (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) AS nivel_riesgo,
           (SELECT COUNT(*) FROM documento_requerido dr WHERE dr.plantilla_id = r.plantilla_id) AS doc_total,
           (SELECT COUNT(*) FROM documento_adjunto da WHERE da.ros_id = r.id AND da.documento_requerido_id IS NOT NULL) AS doc_cargados,
           (SELECT COUNT(*) FROM documento_adjunto da WHERE da.ros_id = r.id AND da.estado = 'observado') AS doc_observados,
           COALESCE((SELECT identificador_enmascarado FROM parte_involucrada WHERE ros_id = r.id LIMIT 1), '***') AS cliente_enmascarado
      FROM ros r
      JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
      ${where}
      ORDER BY r.fecha_recepcion DESC
    `,
  ).all(...params);

  if (riesgo) ros = ros.filter((r) => r.nivel_riesgo === riesgo);

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

        <FilterBar initial={{ q, tipo, riesgo, estado }} />

        {ros.length === 0 ? (
          <div className="notice">Sin resultados para los filtros seleccionados.</div>
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
                  <span>Cliente: <span className="masked">{r.cliente_enmascarado}</span></span>
                  <span>Sustento: {r.doc_cargados}/{r.doc_total} documentos · USD {r.monto.toLocaleString('en-US')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
