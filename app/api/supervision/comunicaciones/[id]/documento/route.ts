// GET /api/supervision/comunicaciones/[id]/documento — Visualización del oficio cargado
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, join } from 'node:path';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { requireSupervisionSo } from '@/lib/supervision/auth';

interface Params { params: Promise<{ id: string }> }

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET(req: Request, { params }: Params) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;
  const { id } = await params;

  const row = db.prepare(
    `SELECT archivo_path, numero_oficio, texto_ocr
       FROM comunicacion_supervision
      WHERE id = ? AND sujeto_obligado_id = ?`,
  ).get(id, soId) as {
    archivo_path: string;
    numero_oficio: string | null;
    texto_ocr: string | null;
  } | undefined;

  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const filePath = isAbsolute(row.archivo_path)
    ? row.archivo_path
    : join(process.cwd(), row.archivo_path.replace(/^\.\//, ''));

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no disponible en el servidor' }, { status: 404 });
  }

  let nombre = row.numero_oficio ? `${row.numero_oficio}.pdf` : 'oficio.pdf';
  try {
    const meta = JSON.parse(row.texto_ocr ?? '{}') as { nombre_archivo?: string };
    if (meta.nombre_archivo) nombre = meta.nombre_archivo;
  } catch {
    /* ignore */
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  const buf = await readFile(filePath);
  const ctx = extractRequestContext(req);

  audit({
    modulo: 'supervision',
    accion: 'ver_documento_comunicacion',
    resultado: 'exito',
    usuario_id: guard.session.user.id,
    usuario_correo: guard.session.user.email,
    rol: guard.session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: row.numero_oficio ?? id,
    detalle: { archivo: nombre },
    criticidad: 'normal',
  });

  const safe = nombre.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, '_');
  return new NextResponse(buf, {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename="${safe}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
