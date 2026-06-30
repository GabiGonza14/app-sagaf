// POST /api/documentos/upload — Carga individualizada de documentos (RF-07, CU-08)
// Cada archivo se asocia a UN solo `documento_requerido_id`, evitando DEF-15.
// Si el sujeto obligado re-sube un archivo para el mismo requisito, se reemplaza
// el adjunto anterior (queda en el log).
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
import { extractText } from '@/lib/ocr';

// ── Validación de relevancia de contenido ────────────────────────────────────
const STOP_WORDS_ES = new Set([
  'de','del','el','la','los','las','un','una','y','o','en','con','por','para',
  'a','al','se','que','su','sus','este','esta','si','no','ya','lo','le','es',
  'son','fue','han','hay','ser','tiene','como','mas','sin','muy',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS_ES.has(w));
}

async function checkContentRelevance(buffer: Buffer, mime: string, docNombre: string): Promise<string | null> {
  const result = await extractText(buffer, mime);

  if (result.status === 'error') return null; // parser falló (compresión incompatible) → sin falsos positivos

  const isImage = mime === 'image/jpeg' || mime === 'image/png';
  const tipo = isImage ? 'la imagen' : 'el PDF';

  if (result.status === 'empty') {
    // Legible pero sin texto: está en blanco o no es un documento con texto
    return `${isImage ? 'La imagen' : 'El PDF'} no contiene texto legible. Verifica que sea el documento correcto para "${docNombre}".`;
  }

  // Hay texto (capa de texto del PDF u OCR con preprocesado) — verificar tipo
  const docText = result.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const docKws = extractKeywords(docNombre);
  if (docKws.length === 0) return null;

  const matched = docKws.filter((kw) => docText.includes(kw));
  if (matched.length === 0) {
    return `El contenido de ${tipo} no corresponde a "${docNombre}". Palabras esperadas no encontradas: ${docKws.slice(0, 4).join(', ')}.`;
  }
  return null;
}

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  console.log('[UPLOAD] handler ejecutado — versión con OCR');
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData().catch((e) => {
    console.error('[API Upload] Error parsing form data:', e);
    return null;
  });
  if (!form) return NextResponse.json({ error: 'multipart/form-data requerido' }, { status: 400 });

  const file = form.get('file');
  const rosId = String(form.get('ros_id') ?? '');
  const docReqId = (form.get('documento_requerido_id') ?? '') as string;

  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
  if (!rosId) return NextResponse.json({ error: 'ros_id requerido' }, { status: 400 });

  // Defensa profunda: pertenencia (DEF-05)
  const ros = db.prepare<[string], { id: string; numero_ros: string; sujeto_obligado_id: string }>(
    'SELECT id, numero_ros, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(rosId);
  if (!ros) return NextResponse.json({ error: 'ROS no encontrado' }, { status: 404 });

  const subject = {
    id: session.user.id, correo: session.user.email ?? '',
    rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  if (!canAccessROS(subject, ros.sujeto_obligado_id)) {
    console.error('[API Upload] No autorizado:', { subject, ros_so: ros.sujeto_obligado_id });
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Solo el sujeto obligado puede subir; UAF observa/valida pero no sube.
  if (session.user.rol !== 'sujeto_obligado') {
    return NextResponse.json({ error: 'Solo el sujeto obligado puede cargar documentos' }, { status: 403 });
  }

  // Validar documento_requerido_id pertenece a la plantilla del ROS
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
    console.error('[API Upload] MIME o extensión no permitida:', { mime, fileName });
    return NextResponse.json({ error: 'Solo se permiten archivos PDF, JPG o PNG.' }, { status: 400 });
  }

  const subdir = join(UPLOADS_DIR, ros.id);
  if (!existsSync(subdir)) await mkdir(subdir, { recursive: true });

  const original = (file as File).name || 'documento.bin';
  const safeName = original.replace(/[^A-Za-z0-9._-]/g, '_');
  const docId = randomUUID();
  const finalName = `${docId}__${safeName}`;
  const finalPath = join(subdir, finalName);

  await writeFile(finalPath, buffer);

  const hash = createHash('sha256').update(buffer).digest('hex');

  // Si existe un adjunto previo para este documento_requerido, lo reemplazamos
  let prevSubsIds: string[] = [];
  if (docReqId) {
    const prev = db.prepare<[string, string], { id: string; ruta_archivo: string }>(
      'SELECT id, ruta_archivo FROM documento_adjunto WHERE ros_id = ? AND documento_requerido_id = ?',
    ).get(rosId, docReqId);
    if (prev) {
      // Capturar subsanaciones pendientes antes de limpiar el link, para resolverlas luego
      prevSubsIds = (db.prepare<[string], { id: string }>(
        `SELECT id FROM solicitud_subsanacion WHERE documento_adjunto_id = ? AND estado = 'pendiente'`,
      ).all(prev.id) as Array<{ id: string }>).map((r) => r.id);

      db.prepare(
        `UPDATE solicitud_subsanacion SET documento_adjunto_id = NULL WHERE documento_adjunto_id = ?`,
      ).run(prev.id);
      try { if (existsSync(prev.ruta_archivo)) await unlink(prev.ruta_archivo); } catch {}
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

  // Resolver solicitudes pendientes: por documento_requerido_id (nuevas) o por IDs capturados (antiguas)
  if (docReqId) {
    db.prepare(`
      UPDATE solicitud_subsanacion
         SET estado = 'atendida', documento_adjunto_id = ?, fecha_respuesta = CURRENT_TIMESTAMP
       WHERE ros_id = ? AND documento_requerido_id = ? AND estado = 'pendiente'
    `).run(docId, rosId, docReqId);
  }
  // Fallback: subsanaciones que apuntaban al adjunto anterior (sin documento_requerido_id)
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
    modulo: 'documentos', accion: 'cargar_documento', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    recurso_afectado: ros.numero_ros,
    detalle: { documento_requerido_id: docReqId || null, hash_sha256: hash, tamano: buffer.byteLength, mime },
  });

  // Verificación de contenido — funciona con PDFs digitales, PDFs escaneados e imágenes
  let contentWarning: string | null = null;
  if (docReqId) {
    const docReqRow = db.prepare<[string], { nombre: string }>(
      'SELECT nombre FROM documento_requerido WHERE id = ?'
    ).get(docReqId);
    console.log('[OCR] docReqId:', docReqId, '| docReqRow:', docReqRow);
    if (docReqRow) {
      try {
        contentWarning = await checkContentRelevance(buffer, mime, docReqRow.nombre);
      } catch (err) {
        console.error('[OCR] checkContentRelevance lanzó error:', err);
      }
    }
  }
  console.log('[OCR] contentWarning final:', contentWarning);

  return NextResponse.json({ id: docId, contentWarning }, { status: 201 });
}
