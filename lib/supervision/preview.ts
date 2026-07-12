// lib/supervision/preview.ts — Vista previa de alcance antes de generar paquete
import { db } from '@/lib/db';
import { resolveRosAlcance, type AlcanceInput } from './alcance';
import type { DetallePaquete } from './detalle';

export interface PaquetePreview {
  ros: number;
  numeros: string[];
  documentos: number;
  eventos_log: number;
  partes: number;
  con_riesgo: number;
  subsanaciones: number;
  indice_promedio_docs: number | null;
}

export interface PreviewOptions extends AlcanceInput {
  incluir_log: boolean;
  incluir_documentos: boolean;
  detalle?: DetallePaquete;
}

function indiceDocsRos(rosId: string): number | null {
  const row = db.prepare(
    `SELECT r.plantilla_id,
            (SELECT COUNT(*) FROM documento_requerido dr
              WHERE dr.plantilla_id = r.plantilla_id AND dr.tipo_requerimiento = 'requerido') AS total,
            (SELECT COUNT(*) FROM documento_adjunto da
              JOIN documento_requerido dr ON dr.id = da.documento_requerido_id
             WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'requerido') AS cargados
       FROM ros r WHERE r.id = ?`,
  ).get(rosId) as { total: number; cargados: number } | undefined;
  if (!row || row.total === 0) return null;
  return Math.round((row.cargados / row.total) * 100);
}

export function buildPaquetePreview(input: PreviewOptions): PaquetePreview {
  const rosRows = resolveRosAlcance(input);
  const numeros = rosRows.map((r) => r.numero_ros);
  const rosIds = rosRows.map((r) => r.id);
  const det = input.detalle;

  let documentos = 0;
  if (input.incluir_documentos && rosIds.length > 0) {
    const placeholders = rosIds.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT COUNT(*) AS c FROM documento_adjunto WHERE ros_id IN (${placeholders})`,
    ).get(...rosIds) as { c: number };
    documentos = row?.c ?? 0;
  }

  let eventos_log = 0;
  if (input.incluir_log && numeros.length > 0) {
    const placeholders = numeros.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT COUNT(*) AS c FROM evento_auditoria WHERE recurso_afectado IN (${placeholders})`,
    ).get(...numeros) as { c: number };
    eventos_log = Math.min(row?.c ?? 0, 500);
  }

  let partes = 0;
  if (det?.incluir_partes && rosIds.length > 0) {
    const placeholders = rosIds.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT COUNT(*) AS c FROM parte_involucrada WHERE ros_id IN (${placeholders})`,
    ).get(...rosIds) as { c: number };
    partes = row?.c ?? 0;
  }

  let con_riesgo = 0;
  if (det?.incluir_riesgo && rosIds.length > 0) {
    const placeholders = rosIds.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT COUNT(DISTINCT ros_id) AS c FROM riesgo_caso
        WHERE ros_id IN (${placeholders}) AND COALESCE(anulado, 0) = 0`,
    ).get(...rosIds) as { c: number };
    con_riesgo = row?.c ?? 0;
  }

  let subsanaciones = 0;
  if (det?.incluir_subsanaciones && rosIds.length > 0) {
    const placeholders = rosIds.map(() => '?').join(',');
    const row = db.prepare(
      `SELECT COUNT(*) AS c FROM solicitud_subsanacion WHERE ros_id IN (${placeholders})`,
    ).get(...rosIds) as { c: number };
    subsanaciones = row?.c ?? 0;
  }

  let indice_promedio_docs: number | null = null;
  if (det?.incluir_indice_cumplimiento && rosIds.length > 0) {
    const indices = rosIds.map((id) => indiceDocsRos(id)).filter((v): v is number => v !== null);
    if (indices.length > 0) {
      indice_promedio_docs = Math.round(indices.reduce((a, b) => a + b, 0) / indices.length);
    }
  }

  return {
    ros: rosRows.length,
    numeros,
    documentos,
    eventos_log,
    partes,
    con_riesgo,
    subsanaciones,
    indice_promedio_docs,
  };
}

export { indiceDocsRos };
