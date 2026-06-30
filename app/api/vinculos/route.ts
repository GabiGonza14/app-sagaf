// /api/vinculos — Crear, confirmar / descartar vínculo intersectorial (CU-07)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { randomUUID } from 'node:crypto';

function computeCriticidad(confirmado: boolean, altoRiesgo: boolean): 'critica' | 'alta' | 'normal' {
  if (confirmado && altoRiesgo) return 'critica';
  if (confirmado) return 'alta';
  return 'normal';
}

const postSchema = z.object({
  ros_origen_id: z.string().min(1),
  ros_destino_id: z.string().min(1),
  tipo_vinculo: z.enum(['persona', 'beneficiario', 'sociedad', 'cuenta', 'inmueble', 'documento', 'direccion']),
  descripcion: z.string().optional().default(''),
});

const patchSchema = z.object({
  id: z.string().min(1),
  confirmado: z.boolean(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const { ros_origen_id, ros_destino_id, tipo_vinculo, descripcion } = parsed.data;

  if (ros_origen_id === ros_destino_id) {
    return NextResponse.json({ error: 'No puede vincular un ROS consigo mismo' }, { status: 400 });
  }

  const r1 = db.prepare<[string], { id: string; numero_ros: string; sujeto_obligado_id: string }>(
    'SELECT id, numero_ros, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(ros_origen_id);
  const r2 = db.prepare<[string], { id: string; numero_ros: string; sujeto_obligado_id: string }>(
    'SELECT id, numero_ros, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(ros_destino_id);
  if (!r1 || !r2) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });

  // CU-07: intersectorial — idealmente distintos sujetos obligados, aunque intra-sector también puede ser útil.
  // No bloqueamos intra-sector, solo documentamos.
  const intersectorial = r1.sujeto_obligado_id !== r2.sujeto_obligado_id;

  const existente = db.prepare<[string, string, string], { id: string }>(
    'SELECT id FROM vinculo_intersectorial WHERE ros_origen_id = ? AND ros_destino_id = ? AND tipo_vinculo = ?',
  ).get(ros_origen_id, ros_destino_id, tipo_vinculo)
    ?? db.prepare<[string, string, string], { id: string }>(
      'SELECT id FROM vinculo_intersectorial WHERE ros_origen_id = ? AND ros_destino_id = ? AND tipo_vinculo = ?',
    ).get(ros_destino_id, ros_origen_id, tipo_vinculo);

  if (existente) {
    return NextResponse.json({ error: 'Ya existe un vínculo de este tipo entre los ROS seleccionados' }, { status: 409 });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO vinculo_intersectorial (id, ros_origen_id, ros_destino_id, tipo_vinculo, descripcion, confirmado, fecha_deteccion)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(id, ros_origen_id, ros_destino_id, tipo_vinculo, descripcion);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'vinculos', accion: 'crear_vinculo', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { vinculo_id: id, tipo_vinculo, intersectorial, ros_origen: r1.numero_ros, ros_destino: r2.numero_ros },
    criticidad: 'alta',
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const v = db.prepare<[string], { ros_origen_id: string; ros_destino_id: string }>(
    'SELECT ros_origen_id, ros_destino_id FROM vinculo_intersectorial WHERE id = ?',
  ).get(parsed.data.id);
  if (!v) return NextResponse.json({ error: 'Vínculo no encontrado' }, { status: 404 });

  db.prepare(
    'UPDATE vinculo_intersectorial SET confirmado = ?, decidido_por = ?, fecha_decision = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(parsed.data.confirmado ? 1 : 0, session.user.id, parsed.data.id);

  // Si confirmado, el ROS pasa a estado 'en_revision_vinculo'
  if (parsed.data.confirmado) {
    db.prepare('UPDATE ros SET estado = ? WHERE id IN (?, ?)')
      .run('en_revision_vinculo', v.ros_origen_id, v.ros_destino_id);
  }

  // A4 — Coincidencia de alto riesgo: verificar si alguno de los ROS tiene riesgo alto
  const altoRiesgo = db.prepare<[string, string], { c: number }>(`
    SELECT COUNT(*) AS c FROM riesgo_caso rc
    WHERE rc.ros_id IN (?, ?)
      AND rc.nivel = 'alto'
      AND rc.fecha_clasificacion = (
        SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id
      )
  `).get(v.ros_origen_id, v.ros_destino_id)?.c ?? 0;

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'vinculos',
    accion: parsed.data.confirmado ? 'confirmar_vinculo' : 'descartar_vinculo',
    resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { vinculo_id: parsed.data.id, alto_riesgo: altoRiesgo > 0 },
    criticidad: computeCriticidad(parsed.data.confirmado, altoRiesgo > 0),
  });

  return NextResponse.json({ ok: true, alto_riesgo: altoRiesgo > 0 });
}
