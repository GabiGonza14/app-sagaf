// GET /api/supervision/paquetes/[id]/descargar
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { requireSupervisionSo } from '@/lib/supervision/auth';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;
  const { id } = await params;

  const row = db.prepare(
    `SELECT p.ruta_archivo, p.nombre_archivo, p.hash_sha256, s.numero_solicitud, s.sujeto_obligado_id
       FROM paquete_generado p
       JOIN solicitud_paquete s ON s.id = p.solicitud_id
      WHERE p.id = ?`,
  ).get(id) as {
    ruta_archivo: string;
    nombre_archivo: string;
    hash_sha256: string;
    numero_solicitud: string;
    sujeto_obligado_id: string;
  } | undefined;

  if (row?.sujeto_obligado_id !== soId) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  if (!existsSync(row.ruta_archivo)) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 410 });
  }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'supervision',
    accion: 'descargar_paquete',
    resultado: 'exito',
    usuario_id: guard.session.user.id,
    usuario_correo: guard.session.user.email,
    rol: guard.session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: row.numero_solicitud,
    detalle: { hash: row.hash_sha256 },
    criticidad: 'alta',
  });

  const body = readFileSync(row.ruta_archivo);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${row.nombre_archivo}"`,
      'X-Package-Hash': row.hash_sha256,
    },
  });
}
