// lib/ros/validar-documento.ts — Validación MVP de documentos ROS (hash + OCR ↔ partes)

import { extractText } from '@/lib/ocr';
import { categorizarDocumento } from './documento-categoria';
import { matchPartesEnTexto, type ParteRef } from './parse-documento';

export interface DetectadoDocumento {
  identificadores_en_texto: string[];
  partes_coincidentes: string[];
}

export interface ValidacionDocumento {
  block: boolean;
  error?: string;
  contentWarning?: string;
  detectado?: DetectadoDocumento;
}

export interface HashDuplicadoInfo {
  slotNombre: string;
  archivoNombre: string;
}

const STOP_WORDS_ES = new Set([
  'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'con', 'por', 'para',
  'a', 'al', 'se', 'que', 'su', 'sus', 'este', 'esta', 'si', 'no', 'ya', 'lo', 'le', 'es',
  'son', 'fue', 'han', 'hay', 'ser', 'tiene', 'como', 'mas', 'sin', 'muy',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS_ES.has(w));
}

function toDetectado(match: ReturnType<typeof matchPartesEnTexto>): DetectadoDocumento {
  return {
    identificadores_en_texto: match.identificadores_en_texto,
    partes_coincidentes: [
      ...match.identificadores_coincidentes,
      ...match.nombres_coincidentes,
    ],
  };
}

export function validarHashDuplicado(conflict: HashDuplicadoInfo): ValidacionDocumento {
  return {
    block: true,
    error:
      `[bloqueo] Este archivo es idéntico al ya cargado en "${conflict.slotNombre}" (${conflict.archivoNombre}). Cada sección requiere un documento distinto.`,
  };
}

function slotKeywordWarning(text: string, docNombre: string, isImage: boolean): string | null {
  const docKws = extractKeywords(docNombre);
  if (docKws.length === 0) return null;

  const docText = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const matched = docKws.filter((kw) => docText.includes(kw));
  if (matched.length > 0) return null;

  const tipo = isImage ? 'la imagen' : 'el PDF';
  return `El contenido de ${tipo} no corresponde a "${docNombre}". Palabras esperadas no encontradas: ${docKws.slice(0, 4).join(', ')}.`;
}

export function validarContenidoConPartes(
  docNombre: string,
  partes: ParteRef[],
  text: string,
): ValidacionDocumento {
  const categoria = categorizarDocumento(docNombre);
  const match = matchPartesEnTexto(text, partes);
  const detectado = toDetectado(match);
  const partesIds = partes.map((p) => p.identificador).filter(Boolean).join(', ');

  if (partes.length === 0) {
    return { block: false, detectado };
  }

  if (categoria === 'identidad') {
    if (match.identificadores_coincidentes.length === 0) {
      const detectados =
        match.identificadores_en_texto.slice(0, 3).join(', ') || 'ninguna cédula/RUC legible';
      return {
        block: true,
        error:
          `[bloqueo] El documento de identidad no contiene la cédula/RUC de ninguna parte del ROS. ` +
          `Detectado en el archivo: ${detectados}. Partes declaradas: ${partesIds || '—'}.`,
        detectado,
      };
    }
    return { block: false, detectado };
  }

  if (categoria === 'diligencia') {
    if (match.identificadores_coincidentes.length === 0 && match.nombres_coincidentes.length === 0) {
      const detectados =
        match.identificadores_en_texto.slice(0, 3).join(', ') || 'ninguna cédula/RUC legible';
      return {
        block: false,
        contentWarning:
          `La Debida Diligencia no menciona la cédula/RUC ni el nombre de las partes declaradas (${partesIds || '—'}). ` +
          `Detectado en el archivo: ${detectados}. Verifique que sea el documento correcto.`,
        detectado,
      };
    }
    return { block: false, detectado };
  }

  return { block: false, detectado };
}

export async function validarDocumentoRos(
  buffer: Buffer,
  mime: string,
  opts: {
    docNombre: string;
    partes: ParteRef[];
    hashDuplicado?: HashDuplicadoInfo | null;
    incluirSlotKeywords?: boolean;
  },
): Promise<ValidacionDocumento> {
  if (opts.hashDuplicado) {
    return validarHashDuplicado(opts.hashDuplicado);
  }

  const isImage = mime === 'image/jpeg' || mime === 'image/png';
  const result = await extractText(buffer, mime);

  if (result.status === 'error') {
    return { block: false };
  }

  if (result.status === 'empty') {
    const tipo = isImage ? 'La imagen' : 'El PDF';
    return {
      block: true,
      error:
        `[bloqueo] ${tipo} no contiene texto legible. Verifica que sea el documento correcto para "${opts.docNombre}".`,
    };
  }

  const partesResult = validarContenidoConPartes(opts.docNombre, opts.partes, result.text);
  if (partesResult.block) return partesResult;

  let contentWarning = partesResult.contentWarning;

  if (opts.incluirSlotKeywords) {
    const kwWarn = slotKeywordWarning(result.text, opts.docNombre, isImage);
    if (kwWarn) {
      contentWarning = contentWarning ? `${contentWarning} ${kwWarn}` : kwWarn;
    }
  }

  return {
    block: false,
    contentWarning: contentWarning ?? undefined,
    detectado: partesResult.detectado,
  };
}
