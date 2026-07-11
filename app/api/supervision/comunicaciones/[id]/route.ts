// GET /api/supervision/comunicaciones/[id]
import { NextResponse } from 'next/server';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { db } from '@/lib/db';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;
  const { id } = await params;

  const row = db.prepare(
    `SELECT id, organismo, tipo_comunicacion, numero_oficio, asunto, estado,
            fecha_oficio, fecha_limite_respuesta, texto_ocr, fecha_registro
       FROM comunicacion_supervision
      WHERE id = ? AND sujeto_obligado_id = ?`,
  ).get(id, soId);

  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(row);
}
