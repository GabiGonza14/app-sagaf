// POST /api/ros/[id]/asignar — Supervisor asigna ROS a un analista
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  analista_id: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'supervisor')
    return NextResponse.json({ error: 'Solo el Supervisor puede asignar ROS' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json({ error: 'analista_id requerido' }, { status: 400 });

  const ros = db.prepare<[string], { numero_ros: string; estado: string }>(
    `SELECT numero_ros, estado FROM ros WHERE id = ?`,
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });
  if (ros.estado === 'borrador')
    return NextResponse.json({ error: 'No se puede asignar un ROS en estado borrador' }, { status: 400 });

  const analista = db.prepare<[string], { id: string; nombre: string }>(
    `SELECT u.id, u.nombre FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE u.id = ? AND r.nombre IN ('analista', 'supervisor') AND u.estado = 'activo'`,
  ).get(parsed.data.analista_id);
  if (!analista)
    return NextResponse.json({ error: 'Usuario no válido o inactivo' }, { status: 400 });

  const ctx = extractRequestContext(req);

  db.transaction(() => {
    db.prepare(`UPDATE asignacion_ros SET activa = 0 WHERE ros_id = ? AND activa = 1`).run(id);
    db.prepare(`
      INSERT INTO asignacion_ros (id, ros_id, analista_id, asignado_por, activa)
      VALUES (?, ?, ?, ?, 1)
    `).run(randomUUID(), id, analista.id, session.user.id);
  })();

  audit({
    modulo: 'ros', accion: 'asignar_analista', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { analista_id: analista.id, analista_nombre: analista.nombre },
    criticidad: 'alta',
  });

  return NextResponse.json({ ok: true, analista_nombre: analista.nombre });
}
