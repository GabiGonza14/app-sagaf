// /api/ros/[id]/riesgo — Clasificar nivel de riesgo (CU-02, RF-02)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const RANGO_RIESGO = { bajo: [0, 33], medio: [34, 66], alto: [67, 100] } as const;

const schema = z.object({
  nivel: z.enum(['bajo', 'medio', 'alto']),
  puntaje: z.number().int().min(0).max(100),
  justificacion: z.string().min(15, 'La justificación debe tener al menos 15 caracteres'),
}).refine(
  ({ nivel, puntaje }) => {
    const [min, max] = RANGO_RIESGO[nivel];
    return puntaje >= min && puntaje <= max;
  },
  { message: 'El puntaje no corresponde al nivel de riesgo seleccionado (bajo: 0–33, medio: 34–66, alto: 67–100)' },
);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  // Si es analista, solo puede clasificar ROS que le hayan sido asignados
  if (session.user.rol === 'analista') {
    const asignado = db.prepare<[string, string], { id: string }>(
      'SELECT id FROM asignacion_ros WHERE ros_id = ? AND analista_id = ? AND activa = 1',
    ).get(id, session.user.id);
    if (!asignado) {
      return NextResponse.json({ error: 'Solo el analista asignado puede clasificar este ROS' }, { status: 403 });
    }
  }

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const ros = db.prepare<[string], { numero_ros: string; plantilla_id: string }>(
    'SELECT numero_ros, plantilla_id FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Workflow: no se puede clasificar riesgo si hay obligatorios sin resolver.
  // Resuelto = validado o no aplica. Observado/cargado/pendiente siguen bloqueando.
  const { total: reqTotal, validated: reqValid } = db.prepare<[string, string], { total: number; validated: number }>(
    `SELECT
      (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = ? AND tipo_requerimiento = 'requerido') AS total,
      (SELECT COUNT(DISTINCT dr.id) FROM documento_adjunto da
        JOIN documento_requerido dr ON dr.id = da.documento_requerido_id
       WHERE da.ros_id = ? AND dr.tipo_requerimiento = 'requerido' AND da.estado IN ('validado', 'no_aplica')) AS validated`,
  ).get(ros.plantilla_id, id) ?? { total: 0, validated: 0 };
  if (reqTotal > 0 && reqValid < reqTotal) {
    return NextResponse.json({
      error: `No puede clasificar riesgo hasta validar o marcar como no aplica todos los documentos obligatorios (${reqValid}/${reqTotal}).`,
    }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO riesgo_caso (id, ros_id, nivel, puntaje, justificacion, clasificado_por)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), id, parsed.data.nivel, parsed.data.puntaje, parsed.data.justificacion, session.user.id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'ros', accion: 'clasificar_riesgo', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { nivel: parsed.data.nivel, puntaje: parsed.data.puntaje },
    criticidad: parsed.data.nivel === 'alto' ? 'alta' : 'normal',
  });

  return NextResponse.json({ ok: true });
}
