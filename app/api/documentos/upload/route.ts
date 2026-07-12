// POST /api/documentos/upload — Carga individualizada de documentos (RF-07, CU-08)
import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { canAccessROS } from '@/lib/permissions';
import { UPLOADS_DIR } from '@/lib/uploads';
import { validarDocumentoRos } from '@/lib/ros/validar-documento';
import type { ParteRef } from '@/lib/ros/parse-documento';

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

function loadPartesRos(rosId: string): ParteRef[] {
  return db.prepare(
    `SELECT identificador, nombre_visible, rol_en_operacion AS rol
       FROM parte_involucrada
      WHERE ros_id = ?`,
  ).all(rosId) as ParteRef[];
}

function findHashDuplicado(
  rosId: string,
  hash: string,
  docReqId: string | null,
): { slotNombre: string; archivoNombre: string } | null {
  const row = db.prepare(
    `SELECT da.nombre_archivo,
            COALESCE(dr.nombre, 'Evidencia adicional') AS slot_nombre
       FROM documento_adjunto da
       LEFT JOIN documento_requerido dr ON dr.id = da.documento_requerido_id
      WHERE da.ros_id = ?
        AND da.hash_archivo = ?
        AND (
          ? IS NULL
          OR da.documento_requerido_id IS NULL
          OR da.documento_requerido_id != ?
        )
      LIMIT 1`,
  ).get(rosId, hash, docReqId, docReqId) as { nombre_archivo: string; slot_nombre: string } | undefined;

  if (!row) return null;
  return { slotNombre: row.slot_nombre, archivoNombre: row.nombre_archivo };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data requerido' }, { status: 400 });

  const file = form.get('file');
  const rosId = String(form.get('ros_id') ?? '');
  const docReqId = (form.get('documento_requerido_id') ?? '') as string;

  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
  if (!rosId) return NextResponse.json({ error: 'ros_id requerido' }, { status: 400 });

  const ros = db.prepare<[string], { id: string; numero_ros: string; sujeto_obligado_id: string }>(
    'SELECT id, numero_ros, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(rosId);
  if (!ros) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });

  const subject = {
    id: session.user.id,
    correo: session.user.email ?? '',
    rol: session.user.rol,
    sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  if (!canAccessROS(subject, ros.sujeto_obligado_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (session.user.rol !== 'sujeto_obligado') {
    return NextResponse.json({ error: 'Solo el sujeto obligado puede cargar documentos' }, { status: 403 });
  }

  if (docReqId) {
    const ok = db.prepare(
      `SELECT 1 FROM documento_requerido dr
        JOIN ros r ON r.plantilla_id = dr.plantilla_id
       WHERE dr.id = ? AND r.id = ?`,
    ).get(docReqId, rosId);
    if (!ok) return NextResponse.json({ error: 'documento_requerido_id no pertenece al ROS' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: `Archivo supera el límite de ${MAX_BYTES / (1024 * 1024)} MB` }, { status: 400 });
  }

  const mime = file.type;
  const fileName = file.name ?? '';
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.test(fileName)) {
    return NextResponse.json({ error: 'Solo se permiten archivos PDF, JPG o PNG.' }, { status: 400 });
  }

  const hash = createHash('sha256').update(buffer).digest('hex');
  const hashDuplicado = findHashDuplicado(rosId, hash, docReqId || null);

  const docReqRow = docReqId
    ? db.prepare<[string], { nombre: string }>('SELECT nombre FROM documento_requerido WHERE id = ?').get(docReqId)
    : undefined;

  const partes = loadPartesRos(rosId);
  const validacion = await validarDocumentoRos(buffer, mime, {
    docNombre: docReqRow?.nombre ?? 'Documento adjunto',
    partes,
    hashDuplicado,
    incluirSlotKeywords: Boolean(docReqId),
  });

  if (validacion.block) {
    return NextResponse.json(
      {
        error: validacion.error?.replace(/^\[bloqueo\]\s*/, '') ?? 'Documento no válido',
        detectado: validacion.detectado,
      },
      { status: 400 },
    );
  }

  const subdir = join(UPLOADS_DIR, ros.id);
  if (!existsSync(subdir)) await mkdir(subdir, { recursive: true });

  const original = (file as File).name || 'documento.bin';
  const safeName = original.replace(/[^A-Za-z0-9._-]/g, '_');
  const docId = randomUUID();
  const finalName = `${docId}__${safeName}`;
  const finalPath = join(subdir, finalName);

  await writeFile(finalPath, buffer);

  let prevSubsIds: string[] = [];
  if (docReqId) {
    const prev = db.prepare<[string, string], { id: string; ruta_archivo: string }>(
      'SELECT id, ruta_archivo FROM documento_adjunto WHERE ros_id = ? AND documento_requerido_id = ?',
    ).get(rosId, docReqId);
    if (prev) {
      prevSubsIds = (db.prepare<[string], { id: string }>(
        `SELECT id FROM solicitud_subsanacion WHERE documento_adjunto_id = ? AND estado = 'pendiente'`,
      ).all(prev.id) as Array<{ id: string }>).map((r) => r.id);

      db.prepare(
        `UPDATE solicitud_subsanacion SET documento_adjunto_id = NULL WHERE documento_adjunto_id = ?`,
      ).run(prev.id);
      try {
        if (existsSync(prev.ruta_archivo)) await unlink(prev.ruta_archivo);
      } catch {
        /* noop */
      }
      db.prepare('DELETE FROM documento_adjunto WHERE id = ?').run(prev.id);
    }
  }

  db.prepare(`
    INSERT INTO documento_adjunto (id, ros_id, documento_requerido_id, nombre_archivo, ruta_archivo,
                                   tipo_mime, hash_archivo, tamano_bytes, estado, cargado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cargado', ?)
  `).run(
    docId, rosId, docReqId || null, original, finalPath,
    mime || null, hash, buffer.byteLength, session.user.id,
  );

  if (docReqId) {
    db.prepare(`
      UPDATE solicitud_subsanacion
         SET estado = 'atendida', documento_adjunto_id = ?, fecha_respuesta = CURRENT_TIMESTAMP
       WHERE ros_id = ? AND documento_requerido_id = ? AND estado = 'pendiente'
    `).run(docId, rosId, docReqId);
  }
  if (prevSubsIds.length > 0) {
    const placeholders = prevSubsIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE solicitud_subsanacion
         SET estado = 'atendida', documento_adjunto_id = ?, fecha_respuesta = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders}) AND estado = 'pendiente'
    `).run(docId, ...prevSubsIds);
  }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'documentos',
    accion: 'cargar_documento',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: ros.numero_ros,
    detalle: {
      documento_requerido_id: docReqId || null,
      hash_sha256: hash,
      tamano: buffer.byteLength,
      mime,
      validacion_ocr: validacion.detectado ?? null,
    },
  });

  return NextResponse.json(
    {
      id: docId,
      contentWarning: validacion.contentWarning ?? null,
      detectado: validacion.detectado ?? null,
    },
    { status: 201 },
  );
}
