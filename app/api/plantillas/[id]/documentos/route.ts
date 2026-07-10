// POST/DELETE /api/plantillas/[id]/documentos — Gestión de documentos requeridos (CU-06, RF-07)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(400).optional().nullable(),
  tipo_requerimiento: z.enum(['requerido', 'condicional', 'opcional']).default('requerido'),
  formatos_permitidos: z.string().min(1).default('pdf,jpg,png'),
  tamano_maximo_mb: z.number().int().positive().max(50).default(10),
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

  const orden = (db.prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM documento_requerido WHERE plantilla_id = ?')
    .get(id) as { n: number }).n;

  // 'requerido' es obligatorio; 'condicional'/'opcional' no bloquean el envío
  const obligatorio = parsed.data.tipo_requerimiento === 'requerido' ? 1 : 0;

  const docId = randomUUID();
  db.prepare(`
    INSERT INTO documento_requerido
      (id, plantilla_id, nombre, descripcion, obligatorio, tipo_requerimiento, formatos_permitidos, tamano_maximo_mb, orden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(docId, id, parsed.data.nombre, parsed.data.descripcion ?? null, obligatorio,
    parsed.data.tipo_requerimiento, parsed.data.formatos_permitidos, parsed.data.tamano_maximo_mb, orden);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'agregar_documento_requerido', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { plantilla_id: id, plantilla: plantilla.nombre, documento: parsed.data.nombre, tipo: parsed.data.tipo_requerimiento },
  });

  return NextResponse.json({ id: docId }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctxAuth = await requireAdminPlantilla(id);
  if (ctxAuth.error) return ctxAuth.error;
  const { session } = ctxAuth;

  const docReqId = new URL(req.url).searchParams.get('docId') ?? '';
  const doc = db.prepare<[string, string], { nombre: string }>(
    'SELECT nombre FROM documento_requerido WHERE id = ? AND plantilla_id = ?',
  ).get(docReqId, id);
  if (!doc) return NextResponse.json({ error: 'Documento requerido no encontrado' }, { status: 404 });

  // No eliminar si ya hay archivos adjuntos asociados a este requisito
  const adjuntos = db.prepare('SELECT COUNT(*) n FROM documento_adjunto WHERE documento_requerido_id = ?')
    .get(docReqId) as { n: number };
  if (adjuntos.n > 0)
    return NextResponse.json({ error: `No se puede eliminar: ${adjuntos.n} archivo(s) ya cargado(s) lo usan.` }, { status: 409 });

  db.prepare('DELETE FROM documento_requerido WHERE id = ?').run(docReqId);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'eliminar_documento_requerido', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { plantilla_id: id, documento: doc.nombre },
  });

  return NextResponse.json({ ok: true });
}
