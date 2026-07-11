// POST /api/supervision/comunicaciones — Registrar oficio + OCR asistido
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { z } from 'zod';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { UPLOADS_DIR } from '@/lib/uploads';
import { extractText } from '@/lib/ocr';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { hintsFromOcrText } from '@/lib/supervision/parse-oficio';

const metaSchema = z.object({
  organismo: z.enum(['sbp', 'isrnnf', 'otro']),
  tipo_comunicacion: z.string().min(1),
  numero_oficio: z.string().optional(),
  asunto: z.string().optional(),
  fecha_oficio: z.string().optional(),
  fecha_limite_respuesta: z.string().optional(),
});

export async function GET() {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;

  const rows = db.prepare(
    `SELECT id, organismo, tipo_comunicacion, numero_oficio, asunto, estado, fecha_registro, fecha_limite_respuesta
       FROM comunicacion_supervision
      WHERE sujeto_obligado_id = ?
      ORDER BY fecha_registro DESC`,
  ).all(soId);

  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { session } = guard;
  const soId = session.user.sujetoObligadoId;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  const parsed = metaSchema.safeParse({
    organismo: form.get('organismo'),
    tipo_comunicacion: form.get('tipo_comunicacion'),
    numero_oficio: form.get('numero_oficio') || undefined,
    asunto: form.get('asunto') || undefined,
    fecha_oficio: form.get('fecha_oficio') || undefined,
    fecha_limite_respuesta: form.get('fecha_limite_respuesta') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = join(UPLOADS_DIR, 'supervision');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const id = randomUUID();
  const ext = extname(file.name) || '.pdf';
  const archivoPath = join(dir, `${id}${ext}`);
  writeFileSync(archivoPath, buffer);

  let textoOcr: Record<string, unknown> = { nombre_archivo: file.name };
  try {
    const result = await extractText(buffer, file.type || 'application/pdf');
    const texto = result.status === 'ok' ? result.text.slice(0, 8000) : null;
    const hints = texto ? hintsFromOcrText(texto) : {};
    textoOcr = {
      ...textoOcr,
      texto_extraido: texto,
      fuente_ocr: result.source,
      sugerencias: hints,
    };
  } catch {
    textoOcr = { ...textoOcr, texto_extraido: null, nota: 'OCR no disponible; completar manualmente' };
  }

  const estadoInicial = textoOcr.texto_extraido ? 'en_analisis' : 'recibida';

  db.prepare(
    `INSERT INTO comunicacion_supervision
      (id, sujeto_obligado_id, organismo, tipo_comunicacion, numero_oficio, asunto,
       fecha_oficio, fecha_limite_respuesta, archivo_path, texto_ocr, estado, registrado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    soId,
    parsed.data.organismo,
    parsed.data.tipo_comunicacion,
    parsed.data.numero_oficio ?? null,
    parsed.data.asunto ?? null,
    parsed.data.fecha_oficio ?? null,
    parsed.data.fecha_limite_respuesta ?? null,
    archivoPath,
    JSON.stringify(textoOcr),
    estadoInicial,
    session.user.id,
  );

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'supervision',
    accion: 'registrar_comunicacion',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: parsed.data.numero_oficio ?? id,
    detalle: { tipo: parsed.data.tipo_comunicacion, organismo: parsed.data.organismo },
    criticidad: 'alta',
  });

  return NextResponse.json({ id, texto_ocr: textoOcr });
}
