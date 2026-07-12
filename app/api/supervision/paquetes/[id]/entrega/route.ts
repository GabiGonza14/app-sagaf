// POST /api/supervision/paquetes/[id]/entrega — Registro de entrega externa al regulador
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { requireSupervisionSo } from '@/lib/supervision/auth';

interface Params { params: Promise<{ id: string }> }

const entregaSchema = z.object({
  canal_entrega: z.enum(['correo', 'portal_regulatorio', 'entrega_fisica', 'otro']),
  observacion: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;
  const { id: paqueteId } = await params;

  const parsed = entregaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = db.prepare(
    `SELECT p.id, s.numero_solicitud, s.sujeto_obligado_id
       FROM paquete_generado p
       JOIN solicitud_paquete s ON s.id = p.solicitud_id
      WHERE p.id = ?`,
  ).get(paqueteId) as { id: string; numero_solicitud: string; sujeto_obligado_id: string } | undefined;

  if (row?.sujeto_obligado_id !== soId) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

  const entregaId = randomUUID();
  db.prepare(
    `INSERT INTO entrega_paquete (id, paquete_id, usuario_id, accion, canal_entrega, observacion)
     VALUES (?, ?, ?, 'entrega_externa', ?, ?)`,
  ).run(
    entregaId,
    paqueteId,
    guard.session.user.id,
    parsed.data.canal_entrega,
    parsed.data.observacion ?? null,
  );

  db.prepare(`UPDATE solicitud_paquete SET estado = 'entregada' WHERE id IN (
    SELECT solicitud_id FROM paquete_generado WHERE id = ?
  )`).run(paqueteId);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'supervision',
    accion: 'registrar_entrega_paquete',
    resultado: 'exito',
    usuario_id: guard.session.user.id,
    usuario_correo: guard.session.user.email,
    rol: guard.session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: row.numero_solicitud,
    detalle: { canal: parsed.data.canal_entrega },
    criticidad: 'alta',
  });

  return NextResponse.json({ id: entregaId, estado: 'entregada' });
}
