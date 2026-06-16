// POST /api/documentos/no-aplica — Sujeto obligado declara que un documento no aplica (A3, CU-08)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { canAccessROS } from '@/lib/permissions';

const schema = z.object({
  ros_id: z.string().min(1),
  documento_requerido_id: z.string().min(1),
  justificacion: z.string().min(10),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'sujeto_obligado')
    return NextResponse.json({ error: 'Solo el sujeto obligado puede declarar no aplica' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { ros_id, documento_requerido_id, justificacion } = parsed.data;

  const ros = db.prepare<[string], { id: string; numero_ros: string; sujeto_obligado_id: string }>(
    'SELECT id, numero_ros, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(ros_id);
  if (!ros) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });

  const subject = {
    id: session.user.id, correo: session.user.email ?? '',
    rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  if (!canAccessROS(subject, ros.sujeto_obligado_id))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const drOk = db.prepare(
    `SELECT 1 FROM documento_requerido dr
      JOIN ros r ON r.plantilla_id = dr.plantilla_id
     WHERE dr.id = ? AND r.id = ?`,
  ).get(documento_requerido_id, ros_id);
  if (!drOk) return NextResponse.json({ error: 'Documento requerido no pertenece al ROS' }, { status: 400 });

  // Reemplazar adjunto previo si existe (liberar FK antes de DELETE)
  const prev = db.prepare<[string, string], { id: string }>(
    'SELECT id FROM documento_adjunto WHERE ros_id = ? AND documento_requerido_id = ?',
  ).get(ros_id, documento_requerido_id);
  if (prev) {
    db.prepare(
      `UPDATE solicitud_subsanacion
          SET estado = 'atendida', documento_adjunto_id = NULL, fecha_respuesta = CURRENT_TIMESTAMP
        WHERE documento_adjunto_id = ? AND estado = 'pendiente'`,
    ).run(prev.id);
    db.prepare('DELETE FROM documento_adjunto WHERE id = ?').run(prev.id);
  }

  const docId = randomUUID();
  db.prepare(`
    INSERT INTO documento_adjunto
      (id, ros_id, documento_requerido_id, nombre_archivo, ruta_archivo,
       tipo_mime, hash_archivo, tamano_bytes, estado, observacion, cargado_por)
    VALUES (?, ?, ?, 'no_aplica', '', NULL, NULL, 0, 'no_aplica', ?, ?)
  `).run(docId, ros_id, documento_requerido_id, justificacion, session.user.id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'documentos', accion: 'declarar_no_aplica', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { documento_requerido_id, justificacion },
  });

  return NextResponse.json({ id: docId }, { status: 201 });
}
