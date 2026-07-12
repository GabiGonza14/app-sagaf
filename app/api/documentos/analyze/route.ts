import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validarDocumentoRos } from '@/lib/ros/validar-documento';
import type { ParteRef } from '@/lib/ros/parse-documento';

function parsePartes(raw: FormDataEntryValue | null): ParteRef[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{
      identificador?: string;
      nombre_visible?: string | null;
      rol?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => typeof p.identificador === 'string' && p.identificador.trim().length >= 3)
      .map((p) => ({
        identificador: p.identificador!.trim(),
        nombre_visible: p.nombre_visible ?? null,
        rol: p.rol,
      }));
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ contentWarning: null, contentError: null, detectado: null });
  }

  const file = form.get('file');
  const docNombre = String(form.get('doc_nombre') ?? '');
  const partes = parsePartes(form.get('partes'));

  if (!file || typeof file === 'string') {
    return NextResponse.json({ contentWarning: null, contentError: null, detectado: null });
  }

  if ((file as File).size === 0) {
    return NextResponse.json({
      contentWarning: null,
      contentError: 'El archivo está vacío (0 bytes). Sube el documento correcto.',
      detectado: null,
    });
  }

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const mime = (file as File).type;
  const isImage = mime === 'image/jpeg' || mime === 'image/png';
  if (mime !== 'application/pdf' && !isImage) {
    return NextResponse.json({ contentWarning: null, contentError: null, detectado: null });
  }

  const validacion = await validarDocumentoRos(buffer, mime, {
    docNombre: docNombre || 'Documento',
    partes,
    incluirSlotKeywords: Boolean(docNombre),
  });

  if (validacion.block) {
    return NextResponse.json({
      contentWarning: null,
      contentError: validacion.error?.replace(/^\[bloqueo\]\s*/, '') ?? 'Documento no válido',
      detectado: validacion.detectado ?? null,
    });
  }

  return NextResponse.json({
    contentWarning: validacion.contentWarning ?? null,
    contentError: null,
    detectado: validacion.detectado ?? null,
  });
}
