// POST /api/supervision/comunicaciones/ocr-preview — OCR asistido antes de registrar oficio
import { NextResponse } from 'next/server';
import { extractText } from '@/lib/ocr';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { parseOficioText } from '@/lib/supervision/parse-oficio';
import { aplicarAlcanceDesdeOficio } from '@/lib/supervision/aplicar-alcance';

function formFieldString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: Request) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await req.formData();
  const file = form.get('file');
  const tipoHint = formFieldString(form.get('tipo_comunicacion'));
  const soTipo = formFieldString(form.get('so_tipo')) || 'bank';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/pdf';

  try {
    const result = await extractText(buffer, mime);
    if (result.status !== 'ok') {
      return NextResponse.json({
        texto_extraido: null,
        fuente_ocr: result.source,
        parse: {},
        sugerencias: {},
        alcance_paquete: null,
        nota: result.status === 'empty'
          ? 'No se detectó texto legible; complete los campos manualmente.'
          : 'No se pudo procesar el archivo; complete los campos manualmente.',
      });
    }

    const parse = parseOficioText(result.text);
    if (!parse.tipo_comunicacion && tipoHint) parse.tipo_comunicacion = tipoHint;

    const tipo = parse.tipo_comunicacion ?? tipoHint ?? 'requerimiento_inicial';
    const alcance_paquete = aplicarAlcanceDesdeOficio(parse, tipo, soTipo, {
      numero_oficio: parse.numero_oficio,
      asunto: parse.asunto,
      fecha_limite_respuesta: parse.fecha_limite_respuesta,
      fecha_oficio: parse.fecha_oficio,
      organismo: parse.organismo,
    });

    return NextResponse.json({
      texto_extraido: result.text.slice(0, 4000),
      fuente_ocr: result.source,
      parse,
      sugerencias: parse,
      alcance_paquete,
    });
  } catch {
    return NextResponse.json({
      texto_extraido: null,
      parse: {},
      sugerencias: {},
      alcance_paquete: null,
      nota: 'OCR no disponible; complete los campos manualmente.',
    });
  }
}
