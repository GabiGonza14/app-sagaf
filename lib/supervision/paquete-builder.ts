// lib/supervision/paquete-builder.ts — Generación de paquete (manifiesto JSON + hash)
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db';
import { UPLOADS_DIR } from '@/lib/uploads';
import { resolveRosAlcance, type AlcanceInput } from './alcance';
import { parseDetalleJson, type DetallePaquete } from './detalle';
import { indiceDocsRos } from './preview';
import { labelTipoComunicacion } from './constants';

export interface BuildResult {
  paqueteId: string;
  ruta: string;
  nombre: string;
  hash: string;
  tamano: number;
  resumen: Record<string, unknown>;
}

function exportDocsMeta(rosId: string) {
  return db.prepare(
    `SELECT dr.nombre AS documento_requerido, da.nombre_archivo, da.tipo_mime, da.tamano_bytes, da.estado, da.fecha_carga
       FROM documento_adjunto da
       LEFT JOIN documento_requerido dr ON dr.id = da.documento_requerido_id
      WHERE da.ros_id = ?
      ORDER BY da.fecha_carga`,
  ).all(rosId) as Array<Record<string, unknown>>;
}

function exportPartes(rosId: string) {
  return db.prepare(
    `SELECT rol_en_operacion, tipo_persona, identificador_enmascarado, nombre_visible
       FROM parte_involucrada WHERE ros_id = ?`,
  ).all(rosId);
}

function exportRiesgo(rosId: string) {
  return db.prepare(
    `SELECT nivel, puntaje, fecha_clasificacion, justificacion
       FROM riesgo_caso WHERE ros_id = ? AND COALESCE(anulado, 0) = 0
       ORDER BY fecha_clasificacion DESC LIMIT 1`,
  ).get(rosId);
}

function exportSubsanaciones(rosId: string) {
  return db.prepare(
    `SELECT motivo, estado, fecha_solicitud, fecha_limite, fecha_respuesta
       FROM solicitud_subsanacion WHERE ros_id = ? ORDER BY fecha_solicitud DESC`,
  ).all(rosId);
}

function exportRosMeta(
  rosId: string,
  nivel: string,
  incluirDocs: boolean,
  det: DetallePaquete,
) {
  const ros = db.prepare(
    `SELECT r.numero_ros, r.estado, r.fecha_deteccion, r.fecha_recepcion, r.descripcion, r.plantilla_id,
            o.monto, o.moneda, o.senal_alerta, o.jurisdiccion, o.producto_servicio, o.forma_pago, o.bien_inmueble
       FROM ros r
       LEFT JOIN operacion_sospechosa o ON o.ros_id = r.id
      WHERE r.id = ?`,
  ).get(rosId) as Record<string, unknown> | undefined;
  if (!ros) return null;

  const base = nivel === 'metadatos'
    ? (() => { const { descripcion: _d, plantilla_id: _p, ...rest } = ros; return rest; })()
    : (() => { const { plantilla_id: _p, ...rest } = ros; return rest; })();

  const extra: Record<string, unknown> = {};
  if (incluirDocs) extra.documentos = exportDocsMeta(rosId);
  if (det.incluir_partes) extra.partes = exportPartes(rosId);
  if (det.incluir_riesgo) extra.clasificacion_riesgo = exportRiesgo(rosId) ?? null;
  if (det.incluir_subsanaciones) extra.subsanaciones = exportSubsanaciones(rosId);
  if (det.incluir_indice_cumplimiento) {
    const pct = indiceDocsRos(rosId);
    extra.indice_documentacion_obligatoria_pct = pct;
  }
  return { ...base, ...extra };
}

function exportLogSubset(numerosRos: string[], incluir: boolean) {
  if (!incluir || numerosRos.length === 0) return [];
  const placeholders = numerosRos.map(() => '?').join(',');
  return db.prepare(
    `SELECT fecha_hora_servidor, usuario_correo, rol, modulo, accion, resultado, recurso_afectado, criticidad
       FROM evento_auditoria
      WHERE recurso_afectado IN (${placeholders})
      ORDER BY fecha_hora_servidor DESC
      LIMIT 500`,
  ).all(...numerosRos);
}

export function buildPaquete(solicitudId: string, userId: string): BuildResult {
  const sol = db.prepare(`SELECT * FROM solicitud_paquete WHERE id = ?`).get(solicitudId) as AlcanceInput & {
    id: string;
    numero_solicitud: string;
    nivel_contenido: string;
    incluir_documentos: number;
    incluir_log: number;
    sujeto_obligado_id: string;
    comunicacion_id: string | null;
    detalle_json: string | null;
  };

  if (!sol) throw new Error('Solicitud no encontrada');

  const det = parseDetalleJson(sol.detalle_json);
  const rosRows = resolveRosAlcance(sol);
  const numeros = rosRows.map((r) => r.numero_ros);

  const so = db.prepare(
    `SELECT nombre, tipo, sector, organismo_supervisor FROM sujeto_obligado WHERE id = ?`,
  ).get(sol.sujeto_obligado_id) as Record<string, string>;

  const com = sol.comunicacion_id
    ? db.prepare(
        `SELECT organismo, tipo_comunicacion, numero_oficio, asunto, fecha_oficio, fecha_limite_respuesta
           FROM comunicacion_supervision WHERE id = ?`,
      ).get(sol.comunicacion_id) as Record<string, string | null>
    : null;

  const generador = db.prepare(`SELECT nombre, correo FROM usuario WHERE id = ?`).get(userId) as {
    nombre: string;
    correo: string;
  };

  const expedientes = rosRows.map((r) => ({
    numero_ros: r.numero_ros,
    estado: r.estado,
    fecha_recepcion: r.fecha_recepcion,
    detalle: exportRosMeta(r.id, sol.nivel_contenido, sol.incluir_documentos === 1, det),
  }));

  const logEventos = exportLogSubset(numeros, sol.incluir_log === 1);

  const payload = {
    manifiesto: {
      version: '1.0',
      solicitud: sol.numero_solicitud,
      generado: new Date().toISOString(),
      hash_algoritmo: 'SHA-256',
    },
    respuesta: {
      titulo: det.titulo_respuesta ?? `Respuesta ${sol.numero_solicitud}`,
      responsable: {
        nombre: det.responsable_nombre ?? generador?.nombre,
        cargo: det.responsable_cargo ?? 'Oficial de Cumplimiento',
        correo: generador?.correo,
      },
      items_atendidos: det.items_solicitados,
      fundamento_alcance: det.fundamento_alcance ?? null,
      notas_para_regulator: det.notas_regulatorio ?? null,
    },
    oficio: com
      ? {
          numero: com.numero_oficio,
          tipo: labelTipoComunicacion(com.tipo_comunicacion ?? ''),
          tipo_id: com.tipo_comunicacion,
          asunto: com.asunto,
          organismo: com.organismo,
          fecha_oficio: com.fecha_oficio,
          plazo_respuesta: com.fecha_limite_respuesta,
        }
      : null,
    entidad_reportante: so ?? null,
    alcance: {
      tipo: sol.alcance_tipo,
      fecha_desde: sol.fecha_desde,
      fecha_hasta: sol.fecha_hasta,
      ros_incluidos: numeros.length,
      numeros_ros: numeros,
    },
    nivel_contenido: sol.nivel_contenido,
    contenido_incluido: {
      documentos: sol.incluir_documentos === 1,
      trazabilidad: sol.incluir_log === 1,
      partes: det.incluir_partes,
      riesgo: det.incluir_riesgo,
      subsanaciones: det.incluir_subsanaciones,
      indice_cumplimiento: det.incluir_indice_cumplimiento,
    },
    expedientes,
    trazabilidad: logEventos,
    nota_legal:
      'Paquete de supervisión generado por el Sujeto Obligado. Uso exclusivo para atender requerimiento formal. No constituye acceso continuo al sistema.',
  };

  const dir = join(UPLOADS_DIR, 'paquetes');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const nombre = `${sol.numero_solicitud}.json`;
  const ruta = join(dir, nombre);
  const body = JSON.stringify(payload, null, 2);
  writeFileSync(ruta, body, 'utf8');

  const hash = createHash('sha256').update(body).digest('hex');
  const paqueteId = randomUUID();

  db.prepare(
    `INSERT INTO paquete_generado (id, solicitud_id, ruta_archivo, nombre_archivo, hash_sha256, tamano_bytes, resumen_json, generado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    paqueteId,
    solicitudId,
    ruta,
    nombre,
    hash,
    Buffer.byteLength(body),
    JSON.stringify({ ros: numeros.length, eventos_log: logEventos.length, hash }),
    userId,
  );

  db.prepare(`UPDATE solicitud_paquete SET estado = 'generada' WHERE id = ?`).run(solicitudId);

  if (sol.comunicacion_id) {
    db.prepare(
      `UPDATE comunicacion_supervision SET estado = 'atendida' WHERE id = ? AND sujeto_obligado_id = ?`,
    ).run(sol.comunicacion_id, sol.sujeto_obligado_id);
  }

  return {
    paqueteId,
    ruta,
    nombre,
    hash,
    tamano: Buffer.byteLength(body),
    resumen: { ros: numeros.length, eventos_log: logEventos.length },
  };
}
