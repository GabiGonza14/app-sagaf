// lib/supervision/alcance.ts — Resolución acotada de ROS para paquetes de supervisión
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

export interface AlcanceInput {
  sujeto_obligado_id: string;
  alcance_tipo: 'periodo' | 'lista_ros' | 'muestra';
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  lista_ros?: string | null;
  tamano_muestra?: number | null;
  semilla_muestra?: string | null;
}

export interface RosAlcanceRow {
  id: string;
  numero_ros: string;
  estado: string;
  fecha_recepcion: string;
}

const MAX_LISTA = 50;
const MAX_MUESTRA = 20;

export function resolveRosAlcance(input: AlcanceInput): RosAlcanceRow[] {
  if (input.alcance_tipo === 'lista_ros') {
    const nums: string[] = input.lista_ros ? JSON.parse(input.lista_ros) : [];
    if (nums.length === 0) return [];
    const limited = nums.slice(0, MAX_LISTA);
    const placeholders = limited.map(() => '?').join(',');
    return db.prepare(
      `SELECT id, numero_ros, estado, fecha_recepcion FROM ros
       WHERE sujeto_obligado_id = ? AND numero_ros IN (${placeholders})
       ORDER BY fecha_recepcion DESC`,
    ).all(input.sujeto_obligado_id, ...limited) as RosAlcanceRow[];
  }

  if (input.alcance_tipo === 'muestra') {
    const n = Math.min(input.tamano_muestra ?? 10, MAX_MUESTRA);
    const semilla = input.semilla_muestra ?? createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 16);
    return db.prepare(
      `SELECT id, numero_ros, estado, fecha_recepcion FROM ros
       WHERE sujeto_obligado_id = ?
       ORDER BY substr(hex(randomblob(8)) || ?, 1, 32)
       LIMIT ?`,
    ).all(input.sujeto_obligado_id, semilla, n) as RosAlcanceRow[];
  }

  const desde = input.fecha_desde ?? '2000-01-01';
  const hasta = input.fecha_hasta ?? new Date().toISOString().slice(0, 10);
  return db.prepare(
    `SELECT id, numero_ros, estado, fecha_recepcion FROM ros
     WHERE sujeto_obligado_id = ?
       AND date(fecha_recepcion) BETWEEN date(?) AND date(?)
     ORDER BY fecha_recepcion DESC
     LIMIT ?`,
  ).all(input.sujeto_obligado_id, desde, hasta, MAX_LISTA) as RosAlcanceRow[];
}

export function nextNumeroSolicitud(): string {
  const year = new Date().getFullYear();
  const row = db.prepare<[string], { c: number }>(
    `SELECT COUNT(*) AS c FROM solicitud_paquete WHERE numero_solicitud LIKE ?`,
  ).get(`PKG-${year}-%`);
  const seq = (row?.c ?? 0) + 1;
  return `PKG-${year}-${String(seq).padStart(5, '0')}`;
}

export { MAX_LISTA, MAX_MUESTRA };

const MAX_MESES_PERIODO = 12;

function validarListaRos(listaRos: string | null | undefined): string | null {
  const nums: string[] = listaRos ? JSON.parse(listaRos) : [];
  if (nums.length === 0) return 'Indique al menos un número de ROS';
  if (nums.length > MAX_LISTA) return `Máximo ${MAX_LISTA} ROS por lista`;
  return null;
}

function validarMuestra(tamano: number | null | undefined): string | null {
  const n = tamano ?? 0;
  if (n < 1) return 'Indique el tamaño de la muestra';
  if (n > MAX_MUESTRA) return `Máximo ${MAX_MUESTRA} ROS en muestra`;
  return null;
}

function validarPeriodo(desde: string | null | undefined, hasta: string | null | undefined): string | null {
  const hastaEff = hasta ?? new Date().toISOString().slice(0, 10);
  if (!desde) return 'Indique fecha desde para el periodo';
  const d0 = new Date(desde);
  const d1 = new Date(hastaEff);
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return 'Fechas inválidas';
  if (d0 > d1) return 'La fecha desde no puede ser posterior a hasta';
  const meses = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth());
  if (meses > MAX_MESES_PERIODO) return `El periodo no puede exceder ${MAX_MESES_PERIODO} meses`;
  return null;
}

export function validarAlcance(input: AlcanceInput): string | null {
  if (input.alcance_tipo === 'lista_ros') return validarListaRos(input.lista_ros);
  if (input.alcance_tipo === 'muestra') return validarMuestra(input.tamano_muestra);
  return validarPeriodo(input.fecha_desde, input.fecha_hasta);
}
