// GET /api/supervision/paquetes/[id]/reporte — Informe PDF de respuesta a supervisión
import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import {
  generateReportePdf,
  pdfPathFromJsonPath,
  pdfNombreFromJsonNombre,
  type PaqueteManifest,
} from '@/lib/supervision/reporte-pdf';

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

  const jsonPath = isAbsolute(row.ruta_archivo)
    ? row.ruta_archivo
    : join(process.cwd(), row.ruta_archivo.replace(/^\.\//, ''));

  if (!existsSync(jsonPath)) {
    return NextResponse.json({ error: 'Manifiesto no disponible' }, { status: 410 });
  }

  const rutaPdf = pdfPathFromJsonPath(jsonPath);
  const nombrePdf = pdfNombreFromJsonNombre(row.nombre_archivo);

  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8')) as PaqueteManifest;
  const body = await generateReportePdf(manifest, row.hash_sha256);
  try {
    writeFileSync(rutaPdf, body);
  } catch {
    /* caché opcional */
  }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'supervision',
    accion: 'descargar_reporte_paquete',
    resultado: 'exito',
    usuario_id: guard.session.user.id,
    usuario_correo: guard.session.user.email,
    rol: guard.session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: row.numero_solicitud,
    detalle: { formato: 'pdf', hash: row.hash_sha256 },
    criticidad: 'alta',
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombrePdf}"`,
      'X-Package-Hash': row.hash_sha256,
    },
  });
}
