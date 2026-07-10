// /api/sujetos-obligados — Crear sujeto obligado (CU-06)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  nombre: z.string().min(2),
  ruc: z.string().optional().nullable(),
  tipo: z.string().min(1),
  sector: z.string().min(1),
  estado: z.enum(['activo', 'inactivo']).default('activo'),
  organismo_supervisor: z.string().min(1, 'El organismo supervisor es obligatorio'),
  responsable_cumpl: z.string().min(1, 'El responsable de cumplimiento es obligatorio'),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['admin', 'supervisor'].includes(session.user.rol))
    return NextResponse.json({ error: 'Solo admin/supervisor' }, { status: 403 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });

  // Duplicidad por RUC
  if (parsed.data.ruc) {
    const existe = db.prepare('SELECT 1 FROM sujeto_obligado WHERE ruc = ?').get(parsed.data.ruc);
    if (existe) return NextResponse.json({ error: 'RUC ya registrado' }, { status: 409 });
  }

  // A2 — Duplicidad por nombre cuando no hay RUC (el nombre actúa como identificador)
  if (!parsed.data.ruc) {
    const existeNombre = db.prepare(
      'SELECT 1 FROM sujeto_obligado WHERE nombre = ? AND (ruc IS NULL OR ruc = "")',
    ).get(parsed.data.nombre);
    if (existeNombre) return NextResponse.json({ error: 'Ya existe un sujeto obligado sin RUC con ese nombre' }, { status: 409 });
  }

  const plantillasAuto = db.prepare<[string, string], { id: string }>(
    'SELECT id FROM plantilla_ros WHERE tipo_sujeto_obligado = ? AND sector = ? AND activa = 1',
  ).all(parsed.data.tipo, parsed.data.sector);
  if (plantillasAuto.length === 0) {
    return NextResponse.json(
      { error: 'No hay plantillas activas para el tipo y sector seleccionados. Cree una primero.' },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO sujeto_obligado (id, nombre, ruc, tipo, sector, organismo_supervisor, responsable_cumpl, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, parsed.data.nombre, parsed.data.ruc ?? null, parsed.data.tipo, parsed.data.sector,
      parsed.data.organismo_supervisor, parsed.data.responsable_cumpl, parsed.data.estado,
    );
    for (const pl of plantillasAuto) {
      db.prepare(
        'INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)',
      ).run(id, pl.id);
    }
  });
  tx();

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'admin', accion: 'crear_sujeto_obligado', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id, nombre: parsed.data.nombre, tipo: parsed.data.tipo, plantillas: plantillasAuto.map((p) => p.id) },
    criticidad: 'normal',
  });

  return NextResponse.json({ id }, { status: 201 });
}
