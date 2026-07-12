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
import { parseOficioText } from '@/lib/supervision/parse-oficio';
import { aplicarAlcanceDesdeOficio } from '@/lib/supervision/aplicar-alcance';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (use AAAA-MM-DD)').optional();

const metaSchema = z.object({
  organismo: z.enum(['sbp', 'isrnnf', 'otro']),
  tipo_comunicacion: z.string().min(1),
  numero_oficio: z.string().max(80).optional(),
  asunto: z.string().max(300).optional(),
  fecha_oficio: isoDate,
  fecha_limite_respuesta: isoDate,
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
  let parse = {};
  try {
    const result = await extractText(buffer, file.type || 'application/pdf');
    const texto = result.status === 'ok' ? result.text.slice(0, 8000) : null;
    parse = texto ? parseOficioText(texto) : {};
    textoOcr = {
      ...textoOcr,
      texto_extraido: texto,
      fuente_ocr: result.source,
      parse,
      sugerencias: parse,
    };
  } catch {
    textoOcr = { ...textoOcr, texto_extraido: null, nota: 'OCR no disponible; completar manualmente' };
  }

  const p = parse as ReturnType<typeof parseOficioText>;
  const soRow = db.prepare<[string], { tipo: string }>(
    'SELECT tipo FROM sujeto_obligado WHERE id = ?',
  ).get(soId);
  const organismo = parsed.data.organismo || p.organismo || 'sbp';
  const tipo = parsed.data.tipo_comunicacion || p.tipo_comunicacion || 'requerimiento_inicial';
  const numero = parsed.data.numero_oficio || p.numero_oficio || null;
  const asunto = parsed.data.asunto || p.asunto || null;
  const fechaOficio = parsed.data.fecha_oficio || p.fecha_oficio || null;
  const plazo = parsed.data.fecha_limite_respuesta || p.fecha_limite_respuesta || null;

  const parseGuardado: ReturnType<typeof parseOficioText> = {
    ...p,
    fecha_oficio: fechaOficio ?? undefined,
    fecha_limite_respuesta: plazo ?? undefined,
  };
  textoOcr.parse = parseGuardado;
  textoOcr.sugerencias = parseGuardado;

  const alcance_paquete = aplicarAlcanceDesdeOficio(p, tipo, soRow?.tipo ?? 'bank', {
    numero_oficio: numero,
    asunto,
    fecha_limite_respuesta: plazo,
    fecha_oficio: fechaOficio,
    organismo,
  });
  textoOcr.alcance_paquete = alcance_paquete;

  const estadoInicial = textoOcr.texto_extraido ? 'en_analisis' : 'recibida';

  db.prepare(
    `INSERT INTO comunicacion_supervision
      (id, sujeto_obligado_id, organismo, tipo_comunicacion, numero_oficio, asunto,
       fecha_oficio, fecha_limite_respuesta, archivo_path, texto_ocr, estado, registrado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    soId,
    organismo,
    tipo,
    numero,
    asunto,
    fechaOficio,
    plazo,
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
