// PATCH /api/documentos/[id] — Observar / validar / revertir documento (CU-08)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const VALID_FORWARD = new Set(['validado', 'observado', 'no_aplica']);
const VALID_REVERSE: Record<string, Set<string>> = {
  validado:  new Set(['cargado', 'observado']),
  no_aplica: new Set(['cargado']),
  observado: new Set(['cargado', 'validado']),
  cargado:   new Set(['validado', 'observado', 'no_aplica']),
};

const schema = z.object({
  estado: z.enum(['cargado', 'observado', 'validado', 'no_aplica']),
  observacion: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['analista', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const adj = db.prepare<[string], { ros_id: string; nombre_archivo: string; estado: string }>(
    'SELECT ros_id, nombre_archivo, estado FROM documento_adjunto WHERE id = ?',
  ).get(id);
  if (!adj) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const desde = adj.estado;
  const hacia = parsed.data.estado;
  const permitidos = VALID_REVERSE[desde];
  if (!permitidos?.has(hacia) && !(desde === 'cargado' && VALID_FORWARD.has(hacia))) {
    return NextResponse.json({
      error: `Transición no permitida: no puede pasar de "${desde}" a "${hacia}".`,
    }, { status: 400 });
  }

  const esReversion = desde === 'validado' || desde === 'no_aplica' || (desde === 'observado' && hacia === 'cargado');

  db.prepare('UPDATE documento_adjunto SET estado = ?, observacion = ? WHERE id = ?')
    .run(hacia, parsed.data.observacion ?? null, id);

  const numero = db.prepare<[string], { numero_ros: string }>('SELECT numero_ros FROM ros WHERE id = ?').get(adj.ros_id)?.numero_ros;
  const ctx = extractRequestContext(req);
  const accion = esReversion ? `revertir_${desde}` : `marcar_${hacia}`;

  audit({
    modulo: 'documentos', accion, resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: numero ?? adj.ros_id, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { documento_adjunto_id: id, archivo: adj.nombre_archivo, desde, hacia, observacion: parsed.data.observacion ?? null },
    criticidad: esReversion ? 'alta' : 'normal',
  });

  return NextResponse.json({ ok: true, accion, desde, hacia });
}
