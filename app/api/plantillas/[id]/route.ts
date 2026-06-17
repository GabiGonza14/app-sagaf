// PATCH/DELETE /api/plantillas/[id] — Editar o eliminar plantilla ROS (CU-06, RE-02/RE-03)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(2).optional(),
  version: z.string().min(1).optional(),
  sector: z.string().min(2).optional(),
  tipo_sujeto_obligado: z.string().min(2).optional(),
  activa: z.boolean().optional(),
});

type Data = z.infer<typeof schema>;

function buildUpdate(d: Data): { fields: string[]; vals: unknown[] } {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (d.nombre !== undefined)               { fields.push('nombre = ?');               vals.push(d.nombre); }
  if (d.version !== undefined)              { fields.push('version = ?');              vals.push(d.version); }
  if (d.sector !== undefined)               { fields.push('sector = ?');               vals.push(d.sector); }
  if (d.tipo_sujeto_obligado !== undefined) { fields.push('tipo_sujeto_obligado = ?'); vals.push(d.tipo_sujeto_obligado); }
  if (d.activa !== undefined)               { fields.push('activa = ?');               vals.push(d.activa ? 1 : 0); }
  return { fields, vals };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'admin')
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const isToggle = payload && Object.keys(payload).length === 1 && 'activa' in payload;
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const pl = db.prepare<[string], { nombre: string; tipo_sujeto_obligado: string }>(
    'SELECT nombre, tipo_sujeto_obligado FROM plantilla_ros WHERE id = ?',
  ).get(id);
  if (!pl) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });

  const d = parsed.data;
  // Duplicidad: nombre + tipo no puede chocar con otra plantilla
  const nuevoNombre = d.nombre ?? pl.nombre;
  const nuevoTipo = d.tipo_sujeto_obligado ?? pl.tipo_sujeto_obligado;
  if (d.nombre !== undefined || d.tipo_sujeto_obligado !== undefined) {
    const existe = db.prepare(
      'SELECT 1 FROM plantilla_ros WHERE nombre = ? AND tipo_sujeto_obligado = ? AND id != ?',
    ).get(nuevoNombre, nuevoTipo, id);
    if (existe) return NextResponse.json({ error: 'Ya existe otra plantilla con ese nombre para ese tipo' }, { status: 409 });
  }

  const { fields, vals } = buildUpdate(d);
  if (fields.length > 0) {
    db.prepare(`UPDATE plantilla_ros SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  const ctx = extractRequestContext(req);
  const accion = isToggle ? (d.activa ? 'activar_plantilla_ros' : 'desactivar_plantilla_ros') : 'actualizar_plantilla_ros';
  audit({
    modulo: 'admin', accion, resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: nuevoNombre, cambios: d },
    criticidad: 'normal',
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'admin')
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const pl = db.prepare<[string], { nombre: string }>('SELECT nombre FROM plantilla_ros WHERE id = ?').get(id);
  if (!pl) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });

  // No se puede eliminar si hay ROS que la usan o sujetos asociados → sugerir desactivar
  const usadaRos = db.prepare('SELECT COUNT(*) n FROM ros WHERE plantilla_id = ?').get(id) as { n: number };
  const asociada = db.prepare('SELECT COUNT(*) n FROM sujeto_obligado_plantilla WHERE plantilla_id = ?').get(id) as { n: number };
  if (usadaRos.n > 0 || asociada.n > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${usadaRos.n} ROS y ${asociada.n} sujeto(s) la usan. Desactívela en su lugar.` },
      { status: 409 },
    );
  }

  // Eliminación atómica: campos + documentos requeridos + plantilla
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM campo_plantilla WHERE plantilla_id = ?').run(id);
    db.prepare('DELETE FROM documento_requerido WHERE plantilla_id = ?').run(id);
    db.prepare('DELETE FROM plantilla_ros WHERE id = ?').run(id);
  });
  tx();

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'eliminar_plantilla_ros', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: pl.nombre },
    criticidad: 'alta',
  });

  return NextResponse.json({ ok: true });
}
