// POST/DELETE /api/plantillas/[id]/campos — Gestión de campos dinámicos (CU-06, RF-01)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(1).max(120),
  tipo_dato: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  obligatorio: z.boolean().default(false),
  regla_validacion: z.string().max(200).optional().nullable(),
});

async function requireAdminPlantilla(id: string) {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  if (session.user.rol !== 'admin')
    return { error: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }) };
  const pl = db.prepare<[string], { nombre: string }>('SELECT nombre FROM plantilla_ros WHERE id = ?').get(id);
  if (!pl) return { error: NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 }) };
  return { session, plantilla: pl };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctxAuth = await requireAdminPlantilla(id);
  if (ctxAuth.error) return ctxAuth.error;
  const { session, plantilla } = ctxAuth;

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const orden = (db.prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM campo_plantilla WHERE plantilla_id = ?')
    .get(id) as { n: number }).n;

  const campoId = randomUUID();
  db.prepare(`
    INSERT INTO campo_plantilla (id, plantilla_id, nombre, tipo_dato, obligatorio, orden, regla_validacion)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(campoId, id, parsed.data.nombre, parsed.data.tipo_dato,
    parsed.data.obligatorio ? 1 : 0, orden, parsed.data.regla_validacion ?? null);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'agregar_campo_plantilla', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { plantilla_id: id, plantilla: plantilla.nombre, campo: parsed.data.nombre, tipo: parsed.data.tipo_dato },
  });

  return NextResponse.json({ id: campoId }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctxAuth = await requireAdminPlantilla(id);
  if (ctxAuth.error) return ctxAuth.error;
  const { session } = ctxAuth;

  const campoId = new URL(req.url).searchParams.get('campoId') ?? '';
  const campo = db.prepare<[string, string], { nombre: string }>(
    'SELECT nombre FROM campo_plantilla WHERE id = ? AND plantilla_id = ?',
  ).get(campoId, id);
  if (!campo) return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 });

  db.prepare('DELETE FROM campo_plantilla WHERE id = ?').run(campoId);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'eliminar_campo_plantilla', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { plantilla_id: id, campo: campo.nombre },
  });

  return NextResponse.json({ ok: true });
}
