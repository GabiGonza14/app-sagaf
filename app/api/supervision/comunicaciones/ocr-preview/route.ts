// POST /api/supervision/comunicaciones/ocr-preview — OCR asistido antes de registrar oficio
import { NextResponse } from 'next/server';
import { extractText } from '@/lib/ocr';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { hintsFromOcrText } from '@/lib/supervision/parse-oficio';

export async function POST(req: Request) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await req.formData();
  const file = form.get('file');
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
        sugerencias: {},
        nota: result.status === 'empty'
          ? 'No se detectó texto legible; complete los campos manualmente.'
          : 'No se pudo procesar el archivo; complete los campos manualmente.',
      });
    }
    const hints = hintsFromOcrText(result.text);
    return NextResponse.json({
      texto_extraido: result.text.slice(0, 4000),
      fuente_ocr: result.source,
      sugerencias: hints,
    });
  } catch {
    return NextResponse.json({
      texto_extraido: null,
      sugerencias: {},
      nota: 'OCR no disponible; complete los campos manualmente.',
    });
  }
}
