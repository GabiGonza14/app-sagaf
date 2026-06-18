// PATCH /api/usuarios/[id] — Actualizar usuario (CU-05)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(2).optional(),
  correo: z.string().email().optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
  rol_id: z.string().optional(),
  sujeto_obligado_id: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  if (id === session.user.id) {
    return NextResponse.json({ error: 'No puedes modificar tu propia cuenta desde aquí' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const u = db.prepare<[string], { correo: string; rol_id: string }>('SELECT correo, rol_id FROM usuario WHERE id = ?').get(id);
  if (!u) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Validar correo único si se está cambiando
  if (parsed.data.correo && parsed.data.correo !== u.correo) {
    const existe = db.prepare('SELECT 1 FROM usuario WHERE correo = ?').get(parsed.data.correo);
    if (existe) return NextResponse.json({ error: 'Correo ya registrado' }, { status: 409 });
  }

  // Validar rol si se cambia
  if (parsed.data.rol_id) {
    const rol = db.prepare<[string], { nombre: string }>('SELECT nombre FROM rol WHERE id = ?').get(parsed.data.rol_id);
    if (!rol) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    // Si el nuevo rol es sujeto_obligado, sujeto_obligado_id es obligatorio
    if (rol.nombre === 'sujeto_obligado' && !parsed.data.sujeto_obligado_id) {
      return NextResponse.json({ error: 'Sujeto obligado requerido para este rol' }, { status: 400 });
    }
    // Si el nuevo rol NO es sujeto_obligado, limpiar sujeto_obligado_id
    if (rol.nombre !== 'sujeto_obligado') {
      db.prepare('UPDATE usuario SET sujeto_obligado_id = NULL WHERE id = ?').run(id);
    }
  }

  // Construir UPDATE dinámico
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (parsed.data.nombre) { sets.push('nombre = ?'); vals.push(parsed.data.nombre); }
  if (parsed.data.correo) { sets.push('correo = ?'); vals.push(parsed.data.correo); }
  if (parsed.data.estado) { sets.push('estado = ?'); vals.push(parsed.data.estado); }
  if (parsed.data.rol_id) { sets.push('rol_id = ?'); vals.push(parsed.data.rol_id); }
  if (parsed.data.sujeto_obligado_id !== undefined) { sets.push('sujeto_obligado_id = ?'); vals.push(parsed.data.sujeto_obligado_id); }

  if (sets.length > 0) {
    vals.push(id);
    db.prepare(`UPDATE usuario SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'actualizar_usuario', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { usuario_id: id, correo_afectado: u.correo, cambios: parsed.data },
    criticidad: 'alta',
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/usuarios/[id] — Eliminar usuario (CU-05)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  if (id === session.user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
  }

  const u = db.prepare<[string], { correo: string }>('SELECT correo FROM usuario WHERE id = ?').get(id);
  if (!u) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  db.prepare('DELETE FROM usuario WHERE id = ?').run(id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'eliminar_usuario', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { usuario_id: id, correo_afectado: u.correo },
    criticidad: 'critica',
  });

  return NextResponse.json({ ok: true });
}
