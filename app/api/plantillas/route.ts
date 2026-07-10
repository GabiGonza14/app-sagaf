// POST /api/plantillas — Crear plantilla ROS (CU-06 RE-02)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(2),
  tipo_sujeto_obligado: z.string().min(2),
  sector: z.string().min(2),
  version: z.string().min(1).default('1.0'),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'admin')
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const existe = db.prepare(
    'SELECT 1 FROM plantilla_ros WHERE nombre = ? AND tipo_sujeto_obligado = ?',
  ).get(parsed.data.nombre, parsed.data.tipo_sujeto_obligado);
  if (existe)
    return NextResponse.json({ error: 'Ya existe una plantilla con ese nombre para ese tipo' }, { status: 409 });

  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO plantilla_ros (id, nombre, version, tipo_sujeto_obligado, sector, activa)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, parsed.data.nombre, parsed.data.version, parsed.data.tipo_sujeto_obligado, parsed.data.sector);

    const sujetos = db.prepare<[string, string, string], { id: string }>(
      'SELECT id FROM sujeto_obligado WHERE tipo = ? AND sector = ? AND estado = ?',
    ).all(parsed.data.tipo_sujeto_obligado, parsed.data.sector, 'activo');
    for (const s of sujetos) {
      db.prepare(
        'INSERT OR IGNORE INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)',
      ).run(s.id, id);
    }
  });
  tx();

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'crear_plantilla_ros', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: parsed.data.nombre, tipo: parsed.data.tipo_sujeto_obligado, sector: parsed.data.sector },
    criticidad: 'normal',
  });

  return NextResponse.json({ id }, { status: 201 });
}
