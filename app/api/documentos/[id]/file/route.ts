// GET /api/documentos/[id]/file — Sirve el binario con validación de acceso (RNF-05).
// El archivo se almacena en UPLOADS_DIR y NUNCA se expone directamente desde /public.
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { canAccessROS } from '@/lib/permissions';

interface Row {
  ros_id: string;
  sujeto_obligado_id: string;
  nombre_archivo: string;
  ruta_archivo: string;
  tipo_mime: string | null;
  numero_ros: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const row = db.prepare<[string], Row>(
    `
    SELECT da.ros_id, r.sujeto_obligado_id, r.numero_ros,
           da.nombre_archivo, da.ruta_archivo, da.tipo_mime
      FROM documento_adjunto da
      JOIN ros r ON r.id = da.ros_id
     WHERE da.id = ?
    `,
  ).get(id);
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const subject = {
    id: session.user.id, correo: session.user.email ?? '',
    rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  if (!canAccessROS(subject, row.sujeto_obligado_id)) {
    audit({
      modulo: 'documentos', accion: 'descarga_documento', resultado: 'bloqueado',
      usuario_id: subject.id, usuario_correo: subject.correo, rol: subject.rol,
      recurso_afectado: row.numero_ros, criticidad: 'alta',
      detalle: { documento_adjunto_id: id },
    });
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (!existsSync(row.ruta_archivo)) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
  }

  const buf = await readFile(row.ruta_archivo);
  const ctx = extractRequestContext(req);
  audit({
    modulo: 'documentos', accion: 'descarga_documento', resultado: 'exito',
    usuario_id: subject.id, usuario_correo: subject.correo, rol: subject.rol,
    recurso_afectado: row.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { documento_adjunto_id: id, archivo: row.nombre_archivo },
  });

  const safeFilename = row.nombre_archivo.replace(/[^\w.\-]/g, '_');
  const encodedFilename = encodeURIComponent(row.nombre_archivo);

  return new NextResponse(buf, {
    headers: {
      'Content-Type': row.tipo_mime ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
