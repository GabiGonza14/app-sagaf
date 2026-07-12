// GET /api/supervision/comunicaciones/[id]
import { NextResponse } from 'next/server';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { db } from '@/lib/db';
import { parseFromTextoOcrJson, fechasEfectivasComunicacion } from '@/lib/supervision/parse-oficio';
import { aplicarAlcanceDesdeOficio } from '@/lib/supervision/aplicar-alcance';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;
  const { id } = await params;

  const row = db.prepare(
    `SELECT c.id, c.organismo, c.tipo_comunicacion, c.numero_oficio, c.asunto, c.estado,
            c.fecha_oficio, c.fecha_limite_respuesta, c.texto_ocr, c.fecha_registro,
            s.tipo AS so_tipo
       FROM comunicacion_supervision c
       JOIN sujeto_obligado s ON s.id = c.sujeto_obligado_id
      WHERE c.id = ? AND c.sujeto_obligado_id = ?`,
  ).get(id, soId) as {
    id: string;
    organismo: string;
    tipo_comunicacion: string;
    numero_oficio: string | null;
    asunto: string | null;
    estado: string;
    fecha_oficio: string | null;
    fecha_limite_respuesta: string | null;
    texto_ocr: string | null;
    fecha_registro: string;
    so_tipo: string;
  } | undefined;

  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const parse = parseFromTextoOcrJson(row.texto_ocr);
  const alcance_paquete = aplicarAlcanceDesdeOficio(parse, row.tipo_comunicacion, row.so_tipo, {
    numero_oficio: row.numero_oficio,
    asunto: row.asunto,
    fecha_limite_respuesta: row.fecha_limite_respuesta ?? parse.fecha_limite_respuesta,
    fecha_oficio: row.fecha_oficio ?? parse.fecha_oficio,
    organismo: row.organismo,
  });

  const fechas = fechasEfectivasComunicacion(row, parse);

  return NextResponse.json({
    ...row,
    fecha_oficio: fechas.fecha_oficio,
    fecha_limite_respuesta: fechas.fecha_limite_respuesta,
    parse,
    alcance_paquete,
  });
}
