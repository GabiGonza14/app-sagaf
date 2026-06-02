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

type Data = z.infer<typeof schema>;

function buildUpdateFields(d: Data): { fields: string[]; vals: unknown[] } {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (d.nombre !== undefined)               { fields.push('nombre = ?');               vals.push(d.nombre); }
  if (d.ruc !== undefined)                  { fields.push('ruc = ?');                  vals.push(d.ruc ?? null); }
  if (d.tipo !== undefined)                 { fields.push('tipo = ?');                 vals.push(d.tipo); }
  if (d.sector !== undefined)               { fields.push('sector = ?');               vals.push(d.sector); }
  if (d.organismo_supervisor !== undefined) { fields.push('organismo_supervisor = ?'); vals.push(d.organismo_supervisor ?? null); }
  if (d.responsable_cumpl !== undefined)    { fields.push('responsable_cumpl = ?');    vals.push(d.responsable_cumpl ?? null); }
  if (d.estado !== undefined)               { fields.push('estado = ?');               vals.push(d.estado); }
  return { fields, vals };
}

function resolveAuditAction(isStatusToggle: boolean, estado: string | undefined): string {
  if (!isStatusToggle) return 'actualizar_sujeto_obligado';
  return estado === 'inactivo' ? 'desactivar_sujeto_obligado' : 'activar_sujeto_obligado';
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['admin', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Solo admin/supervisor' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const isStatusToggle = payload && Object.keys(payload).length === 1 && 'estado' in payload;
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

  // A2 — Duplicidad por nombre cuando el sujeto resultante no tendrá RUC
  const effectiveRuc = parsed.data.ruc === undefined ? so.ruc : (parsed.data.ruc || null);
  if (!effectiveRuc && parsed.data.nombre && parsed.data.nombre !== so.nombre) {
    const existeNombre = db.prepare(
      'SELECT 1 FROM sujeto_obligado WHERE nombre = ? AND (ruc IS NULL OR ruc = "") AND id != ?',
    ).get(parsed.data.nombre, id);
    if (existeNombre) return NextResponse.json({ error: 'Ya existe un sujeto obligado sin RUC con ese nombre' }, { status: 409 });
  }

  const d = parsed.data;
  const ctx = extractRequestContext(req);
  const { fields, vals } = buildUpdateFields(d);

  const tx = db.transaction(() => {
    if (fields.length > 0) {
      db.prepare(`UPDATE sujeto_obligado SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
    }
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

  const accionAudit = resolveAuditAction(isStatusToggle, d.estado);

  audit({
    modulo: 'admin', accion: accionAudit, resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: d.nombre ?? so.nombre, cambios: d },
    criticidad: 'normal',
  });

  return NextResponse.json({ ok: true });
}
