// lib/supervision/parse-oficio.ts — Heurísticas para prellenar campos desde texto OCR
export interface OficioHints {
  numero_oficio?: string;
  asunto?: string;
}

export function hintsFromOcrText(text: string): OficioHints {
  const hints: OficioHints = {};
  const oficioMatch = text.match(
    /(?:oficio|ref\.?|referencia)\s*(?:n[°º.]?\s*)?([A-Z]{2,5}[-/][A-Z0-9][\w./-]{4,40})/i,
  );
  if (oficioMatch) hints.numero_oficio = oficioMatch[1].trim();

  const sbpMatch = text.match(/\b(SBP[-/][\w./-]{4,40})\b/i);
  if (!hints.numero_oficio && sbpMatch) hints.numero_oficio = sbpMatch[1];

  const asuntoLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^asunto\s*:/i.test(l));
  if (asuntoLine) {
    hints.asunto = asuntoLine.replace(/^asunto\s*:\s*/i, '').slice(0, 200);
  }

  return hints;
}
