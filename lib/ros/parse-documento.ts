// lib/ros/parse-documento.ts — Extracción de identificadores y nombres desde texto OCR

export interface ParteRef {
  identificador: string;
  nombre_visible?: string | null;
  rol?: string;
}

export interface CoincidenciaPartes {
  identificadores_en_texto: string[];
  identificadores_coincidentes: string[];
  nombres_coincidentes: string[];
}

export function normalizeIdentificador(id: string): string {
  return id.trim().replace(/\s+/g, '').replaceAll('-', '').replaceAll('.', '').toUpperCase();
}

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

const STOP_NAME = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'en', 'da', 'do', 'dos', 'das',
]);

function nameTokens(nombre: string): string[] {
  return normalizeForSearch(nombre)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_NAME.has(w));
}

/** Extrae cédulas/RUC detectados en texto (formato panameño y variantes OCR). */
export function extractIdentificadores(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\b(\d{1,2}-\d{1,4}-\d{1,6})\b/gi,
    /\b([A-Z]{1,3}-\d{1,4}-\d{1,6})\b/gi,
    /\b(\d{2,3}-\d{1,4}-\d{1,6})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const raw = m[1]?.trim();
      if (!raw) continue;
      const norm = normalizeIdentificador(raw);
      if (norm.length >= 6) found.add(raw);
    }
  }

  return [...found];
}

/** Cruza texto OCR con las partes declaradas en el ROS. */
export function matchPartesEnTexto(text: string, partes: ParteRef[]): CoincidenciaPartes {
  const identificadores_en_texto = extractIdentificadores(text);
  const textoNorm = normalizeIdentificador(text);
  const textoBusqueda = normalizeForSearch(text);

  const identificadores_coincidentes: string[] = [];
  const nombres_coincidentes: string[] = [];

  for (const parte of partes) {
    const partyNorm = normalizeIdentificador(parte.identificador);
    if (!partyNorm || partyNorm.length < 3) continue;

    const idMatch =
      textoNorm.includes(partyNorm) ||
      identificadores_en_texto.some((id) => normalizeIdentificador(id) === partyNorm);

    if (idMatch) {
      identificadores_coincidentes.push(parte.identificador);
      continue;
    }

    const nombre = (parte.nombre_visible ?? '').trim();
    if (nombre.length < 3) continue;

    const tokens = nameTokens(nombre);
    if (tokens.length === 0) continue;

    const hits = tokens.filter((t) => textoBusqueda.includes(t));
    const minHits = tokens.length >= 2 ? 2 : 1;
    if (hits.length >= minHits) {
      nombres_coincidentes.push(nombre);
    }
  }

  return {
    identificadores_en_texto,
    identificadores_coincidentes,
    nombres_coincidentes,
  };
}
