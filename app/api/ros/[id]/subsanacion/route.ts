// /api/ros/[id]/subsanacion — Solicitar subsanación (CU-08)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  documento_adjunto_id: z.string().nullable().optional(),
  documento_requerido_id: z.string().nullable().optional(),
  motivo: z.string().min(10),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const ros = db.prepare<[string], { numero_ros: string }>('SELECT numero_ros FROM ros WHERE id = ?').get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const subId = randomUUID();
  db.prepare(`
    INSERT INTO solicitud_subsanacion (id, ros_id, documento_adjunto_id, documento_requerido_id, motivo, estado, solicitada_por, fecha_limite)
    VALUES (?, ?, ?, ?, ?, 'pendiente', ?, date('now', '+5 days'))
  `).run(subId, id, parsed.data.documento_adjunto_id ?? null, parsed.data.documento_requerido_id ?? null, parsed.data.motivo, session.user.id);

  // El ROS pasa a estado 'subsanacion' (RF-02)
  db.prepare('UPDATE ros SET estado = ? WHERE id = ?').run('subsanacion', id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'documentos', accion: 'solicitar_subsanacion', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { motivo: parsed.data.motivo, documento: parsed.data.documento_adjunto_id ?? null },
    criticidad: 'normal',
  });

  return NextResponse.json({ id: subId }, { status: 201 });
}
