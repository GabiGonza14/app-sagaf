// POST /api/ros/[id]/riesgo/revertir — Revertir/anular la última clasificación de riesgo
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  justificacion: z.string().min(15, 'La justificación debe tener al menos 15 caracteres'),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  // Si es analista, solo puede revertir riesgo de ROS que le hayan sido asignados
  if (session.user.rol === 'analista') {
    const asignado = db.prepare<[string, string], { id: string }>(
      'SELECT id FROM asignacion_ros WHERE ros_id = ? AND analista_id = ? AND activa = 1',
    ).get(id, session.user.id);
    if (!asignado) {
      return NextResponse.json({ error: 'Solo el analista asignado puede revertir la clasificación' }, { status: 403 });
    }
  }

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const ros = db.prepare<[string], { numero_ros: string }>(
    'SELECT numero_ros FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Buscar la última clasificación NO anulada
  const ultimo = db.prepare<[string], { id: string; nivel: string; puntaje: number }>(
    `SELECT id, nivel, puntaje FROM riesgo_caso
      WHERE ros_id = ? AND anulado = 0
      ORDER BY fecha_clasificacion DESC LIMIT 1`,
  ).get(id);
  if (!ultimo) return NextResponse.json({ error: 'No hay clasificación de riesgo para revertir' }, { status: 400 });

  // Marcar como anulado
  db.prepare(`
    UPDATE riesgo_caso
    SET anulado = 1, anulado_por = ?, anulado_justificacion = ?, fecha_anulacion = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(session.user.id, parsed.data.justificacion, ultimo.id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'ros', accion: 'revertir_riesgo', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { riesgo_id: ultimo.id, nivel_anterior: ultimo.nivel, puntaje_anterior: ultimo.puntaje, justificacion: parsed.data.justificacion },
    criticidad: 'alta',
  });

  return NextResponse.json({ ok: true, riesgo_id: ultimo.id, nivel_anterior: ultimo.nivel });
}
