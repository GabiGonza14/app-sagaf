// POST /api/vinculos/detectar — Detección automática de coincidencias intersectoriales (CU-07)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { randomUUID } from 'node:crypto';

const schema = z.object({ ros_id: z.string().min(1) });

interface RosBase { sujeto_obligado_id: string; numero_ros: string }
interface Insertado { id: string; ros_destino_id: string; tipo_vinculo: string; criterio: string }

function vinculoYaExiste(a: string, b: string, tipo: string): boolean {
  const ex = db.prepare<[string, string, string], { id: string }>(
    'SELECT id FROM vinculo_intersectorial WHERE ros_origen_id = ? AND ros_destino_id = ? AND tipo_vinculo = ?',
  ).get(a, b, tipo)
    ?? db.prepare<[string, string, string], { id: string }>(
      'SELECT id FROM vinculo_intersectorial WHERE ros_origen_id = ? AND ros_destino_id = ? AND tipo_vinculo = ?',
    ).get(b, a, tipo);
  return !!ex;
}

function insertarVinculo(
  rosId: string, rosDestino: string, tipo: string, descripcion: string,
  insertados: Insertado[], criterio: string,
): void {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO vinculo_intersectorial (id, ros_origen_id, ros_destino_id, tipo_vinculo, descripcion, confirmado, fecha_deteccion)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(id, rosId, rosDestino, tipo, descripcion);
  insertados.push({ id, ros_destino_id: rosDestino, tipo_vinculo: tipo, criterio });
}

function detectarPorPersonas(rosId: string, rosBase: RosBase, insertados: Insertado[]): void {
  const partes = db.prepare<[string], { identificador: string; rol_en_operacion: string }>(
    'SELECT identificador, rol_en_operacion FROM parte_involucrada WHERE ros_id = ?',
  ).all(rosId);

  for (const p of partes) {
    const matches = db.prepare<[string, string, string], { ros_id: string; numero_ros: string }>(`
      SELECT DISTINCT p2.ros_id, r.numero_ros
      FROM parte_involucrada p2
      JOIN ros r ON r.id = p2.ros_id
      WHERE p2.identificador = ? AND p2.ros_id != ? AND r.sujeto_obligado_id != ?
    `).all(p.identificador, rosId, rosBase.sujeto_obligado_id);

    for (const m of matches) {
      const tipo = p.rol_en_operacion === 'beneficiario_final' ? 'beneficiario' : 'persona';
      if (!vinculoYaExiste(rosId, m.ros_id, tipo)) {
        const desc = `Coincidencia por identificador ${p.rol_en_operacion} en ROS ${m.numero_ros}`;
        insertarVinculo(rosId, m.ros_id, tipo, desc, insertados, 'identificador');
      }
    }
  }
}

function detectarPorInmueble(rosId: string, rosBase: RosBase, opBase: { bien_inmueble: string | null; jurisdiccion: string | null }, insertados: Insertado[]): void {
  if (!opBase.bien_inmueble) return;
  const matches = db.prepare<[string, string, string], { ros_id: string; numero_ros: string }>(`
    SELECT o2.ros_id, r.numero_ros
    FROM operacion_sospechosa o2
    JOIN ros r ON r.id = o2.ros_id
    WHERE o2.bien_inmueble = ? AND o2.ros_id != ? AND r.sujeto_obligado_id != ?
  `).all(opBase.bien_inmueble, rosId, rosBase.sujeto_obligado_id);

  for (const m of matches) {
    if (!vinculoYaExiste(rosId, m.ros_id, 'inmueble')) {
      const desc = `Coincidencia por bien inmueble: ${opBase.bien_inmueble}`;
      insertarVinculo(rosId, m.ros_id, 'inmueble', desc, insertados, 'bien_inmueble');
    }
  }
}

function detectarPorJurisdiccion(rosId: string, rosBase: RosBase, opBase: { bien_inmueble: string | null; jurisdiccion: string | null }, insertados: Insertado[]): void {
  if (!opBase.jurisdiccion) return;
  const matches = db.prepare<[string, string, string], { ros_id: string; numero_ros: string }>(`
    SELECT o2.ros_id, r.numero_ros
    FROM operacion_sospechosa o2
    JOIN ros r ON r.id = o2.ros_id
    WHERE o2.jurisdiccion = ? AND o2.ros_id != ? AND r.sujeto_obligado_id != ?
  `).all(opBase.jurisdiccion, rosId, rosBase.sujeto_obligado_id);

  for (const m of matches) {
    if (!vinculoYaExiste(rosId, m.ros_id, 'direccion')) {
      const desc = `Coincidencia por jurisdicción: ${opBase.jurisdiccion}`;
      insertarVinculo(rosId, m.ros_id, 'direccion', desc, insertados, 'jurisdiccion');
    }
  }
}

function detectarPorDocumentos(rosId: string, rosBase: RosBase, insertados: Insertado[]): void {
  const docs = db.prepare<[string], { nombre_archivo: string }>(
    'SELECT nombre_archivo FROM documento_adjunto WHERE ros_id = ?',
  ).all(rosId);

  for (const d of docs) {
    const matches = db.prepare<[string, string, string], { ros_id: string; numero_ros: string }>(`
      SELECT da.ros_id, r.numero_ros
      FROM documento_adjunto da
      JOIN ros r ON r.id = da.ros_id
      WHERE da.nombre_archivo = ? AND da.ros_id != ? AND r.sujeto_obligado_id != ?
    `).all(d.nombre_archivo, rosId, rosBase.sujeto_obligado_id);

    for (const m of matches) {
      if (!vinculoYaExiste(rosId, m.ros_id, 'documento')) {
        const desc = `Coincidencia por documento: ${d.nombre_archivo}`;
        insertarVinculo(rosId, m.ros_id, 'documento', desc, insertados, 'documento');
      }
    }
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { ros_id } = parsed.data;

  const rosBase = db.prepare<[string], RosBase>(
    'SELECT sujeto_obligado_id, numero_ros FROM ros WHERE id = ?',
  ).get(ros_id);
  if (!rosBase) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });

  const insertados: Insertado[] = [];

  detectarPorPersonas(ros_id, rosBase, insertados);

  const opBase = db.prepare<[string], { bien_inmueble: string | null; jurisdiccion: string | null }>(
    'SELECT bien_inmueble, jurisdiccion FROM operacion_sospechosa WHERE ros_id = ?',
  ).get(ros_id);

  if (opBase) {
    detectarPorInmueble(ros_id, rosBase, opBase, insertados);
    detectarPorJurisdiccion(ros_id, rosBase, opBase, insertados);
  }

  detectarPorDocumentos(ros_id, rosBase, insertados);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'vinculos', accion: 'detectar_vinculos', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    recurso_afectado: rosBase.numero_ros,
    detalle: { detectados: insertados.length, criterios: insertados.map((i) => i.criterio) },
  });

  return NextResponse.json({ detectados: insertados.length, vinculos: insertados }, { status: 201 });
}
