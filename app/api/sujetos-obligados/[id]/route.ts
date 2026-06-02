// PATCH /api/sujetos-obligados/[id] — Actualizar sujeto obligado (CU-06, RE-03)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(2).optional(),
  ruc: z.string().optional().nullable(),
  tipo: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
  organismo_supervisor: z.string().optional().nullable(),
  responsable_cumpl: z.string().optional().nullable(),
  estado: z.enum(['activo', 'inactivo']).optional(),
  plantillas: z.array(z.string()).min(1).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['admin', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Solo admin/supervisor' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const so = db.prepare<[string], { nombre: string; ruc: string | null }>(
    'SELECT nombre, ruc FROM sujeto_obligado WHERE id = ?',
  ).get(id);
  if (!so) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Verificar duplicidad de RUC si cambia
  if (parsed.data.ruc && parsed.data.ruc !== so.ruc) {
    const existe = db.prepare('SELECT 1 FROM sujeto_obligado WHERE ruc = ? AND id != ?').get(parsed.data.ruc, id);
    if (existe) return NextResponse.json({ error: 'RUC ya registrado en otro sujeto obligado' }, { status: 409 });
  }

  const d = parsed.data;
  const ctx = extractRequestContext(req);

  const tx = db.transaction(() => {
    // Actualizar campos enviados
    const fields: string[] = [];
    const vals: unknown[] = [];

    if (d.nombre !== undefined) { fields.push('nombre = ?'); vals.push(d.nombre); }
    if (d.ruc !== undefined)    { fields.push('ruc = ?');    vals.push(d.ruc ?? null); }
    if (d.tipo !== undefined)   { fields.push('tipo = ?');   vals.push(d.tipo); }
    if (d.sector !== undefined) { fields.push('sector = ?'); vals.push(d.sector); }
    if (d.organismo_supervisor !== undefined) { fields.push('organismo_supervisor = ?'); vals.push(d.organismo_supervisor ?? null); }
    if (d.responsable_cumpl !== undefined)    { fields.push('responsable_cumpl = ?');    vals.push(d.responsable_cumpl ?? null); }
    if (d.estado !== undefined) { fields.push('estado = ?'); vals.push(d.estado); }

    if (fields.length > 0) {
      db.prepare(`UPDATE sujeto_obligado SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
    }

    // Reemplazar plantillas si se enviaron
    if (d.plantillas) {
      db.prepare('DELETE FROM sujeto_obligado_plantilla WHERE sujeto_obligado_id = ?').run(id);
      for (const plId of d.plantillas) {
        db.prepare(
          'INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)',
        ).run(id, plId);
      }
    }
  });
  tx();

  audit({
    modulo: 'admin', accion: 'actualizar_sujeto_obligado', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: d.nombre ?? so.nombre, cambios: d },
    criticidad: 'normal',
  });

  return NextResponse.json({ ok: true });
}
