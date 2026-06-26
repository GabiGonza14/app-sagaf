import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extractText } from '@/lib/ocr';

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ contentWarning: null });

  const file = form.get('file');
  const docNombre = String(form.get('doc_nombre') ?? '');

  if (!file || typeof file === 'string') return NextResponse.json({ contentWarning: null });

  if ((file as File).size === 0) {
    return NextResponse.json({ contentWarning: 'El archivo está vacío (0 bytes). Sube el documento correcto.' });
  }

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const mime = (file as File).type;

  // Analizamos PDFs e imágenes (JPG/PNG). El OCR de imágenes usa preprocesado.
  const isImage = mime === 'image/jpeg' || mime === 'image/png';
  if (mime !== 'application/pdf' && !isImage) return NextResponse.json({ contentWarning: null });

  const tipo = isImage ? 'La imagen' : 'El PDF';
  const result = await extractText(buffer, mime);

  if (result.status === 'empty') {
    return NextResponse.json({
      contentWarning: `${tipo} no contiene texto legible. Puede estar en blanco o no ser un documento con texto. Verifica que sea el documento correcto para "${docNombre}".`,
    });
  }

  // Match de palabras clave para detectar documentos equivocados. Aplica tanto a
  // la capa de texto del PDF como al OCR de imágenes: el preprocesado (sustracción
  // de fondo) hace el OCR de cédulas lo bastante fiable para validar el contenido.
  if (result.status === 'ok' && docNombre) {
    const docKws = extractKeywords(docNombre);
    if (docKws.length > 0) {
      const textLower = result.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const matched = docKws.filter((kw) => textLower.includes(kw));
      if (matched.length === 0) {
        return NextResponse.json({
          contentWarning: `El contenido de ${isImage ? 'la imagen' : 'el PDF'} no parece corresponder a "${docNombre}". Palabras esperadas: ${docKws.slice(0, 3).join(', ')}.`,
        });
      }
    }
  }

  return NextResponse.json({ contentWarning: null });
}
