// lib/supervision/parse-oficio.ts — Extracción estructurada desde texto OCR / capa PDF
import type { TipoComunicacionId } from './constants';
import {
  ETIQUETAS_FECHA_OFICIO,
  ETIQUETAS_PLAZO_RESPUESTA,
  NUMEROS_EN_PALABRA,
  PLAZO_DIAS_POR_TIPO,
} from './diccionario-oficio';

const MESES_NOMBRE_RE =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|sept(?:iembre)?|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic';

const PALABRAS_NUMERO_RE = Object.keys(NUMEROS_EN_PALABRA)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const RE_VERBAL_DATE_PARTS = new RegExp(
  String.raw`^(\d{1,2})\s+de\s+(${MESES_NOMBRE_RE})\s+de\s+(\d{4})$`,
  'i',
);

const RE_VERBAL_DATE_START = /\d{1,2}\s+de\s+/i;

const RE_RANGO_FECHAS_NUM = new RegExp(
  String.raw`(?:entre|de)\s*(?:el\s*)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*(?:y|a|al|hasta)\s*(?:el\s*)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})`,
  'i',
);

const RE_RANGO_FECHAS_TXT = new RegExp(
  String.raw`(?:entre|de)\s*(?:el\s*)?(\d{1,2}[-/](?:${MESES_NOMBRE_RE})[-/]\d{4})\s*(?:y|a|al|hasta)\s*(?:el\s*)?(\d{1,2}[-/](?:${MESES_NOMBRE_RE})[-/]\d{4})`,
  'i',
);

const RE_PERIODO_MESES = new RegExp(
  String.raw`(?:periodo\s+)?(${MESES_NOMBRE_RE})\s*[-–a]\s*(${MESES_NOMBRE_RE})\s+(?:de\s+)?(\d{4})`,
  'i',
);

const RE_ENTRE_MESES = new RegExp(
  String.raw`entre\s+(?:el\s+)?(\d{1,2})[-/](${MESES_NOMBRE_RE})[-/](\d{4})\s+y\s+(?:el\s+)?(\d{1,2})[-/](${MESES_NOMBRE_RE})[-/](\d{4})`,
  'i',
);

const RE_DIAS_PALABRA_PAREN = new RegExp(
  String.raw`(${PALABRAS_NUMERO_RE})\s*\(\d{1,3}\)\s*d[ií]as?\s*h[aá]biles`,
  'i',
);

const RE_DIAS_PALABRA = new RegExp(
  String.raw`(${PALABRAS_NUMERO_RE})\s+d[ií]as?\s+h[aá]biles`,
  'i',
);

function extractVenceDate(source: string): string | undefined {
  const hit = /vence\s+(?:el\s+)?/i.exec(source);
  if (hit?.index == null) return undefined;
  const verbal = extractVerbalDateFragment(source.slice(hit.index + hit[0].length));
  return verbal ? parseFlexibleDate(verbal) : undefined;
}

export interface OficioParse {
  numero_oficio?: string;
  asunto?: string;
  organismo?: 'sbp' | 'isrnnf' | 'otro';
  tipo_comunicacion?: TipoComunicacionId | string;
  fecha_oficio?: string;
  fecha_limite_respuesta?: string;
  periodo?: { desde: string; hasta: string };
  lista_ros?: string[];
  items_solicitados?: string[];
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthFromName(nombre: string): number | undefined {
  const key = nombre.toLowerCase();
  return MESES[key] ?? MESES[key.slice(0, 3)];
}

export function parseFlexibleDate(raw: string): string | undefined {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return undefined;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  const ymdSlash = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s);
  if (ymdSlash) return iso(+ymdSlash[1], +ymdSlash[2], +ymdSlash[3]);

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return iso(+dmy[3], +dmy[2], +dmy[1]);

  const dmyShort = new RegExp(String.raw`^(\d{1,2})[-/](${MESES_NOMBRE_RE})[-/](\d{4})$`, 'i').exec(s);
  if (dmyShort) {
    const key = dmyShort[2].toLowerCase();
    const m = MESES[key] ?? MESES[key.slice(0, 3)];
    if (m) return iso(+dmyShort[3], m, +dmyShort[1]);
  }

  const verbal = RE_VERBAL_DATE_PARTS.exec(s);
  if (verbal) {
    const m = monthFromName(verbal[2]);
    if (m) return iso(+verbal[3], m, +verbal[1]);
  }
  return undefined;
}

function extractVerbalDateFragment(text: string): string | undefined {
  const start = text.search(RE_VERBAL_DATE_START);
  if (start < 0) return undefined;
  const line = text.slice(start).split('\n')[0]?.trim().slice(0, 40) ?? '';
  return RE_VERBAL_DATE_PARTS.exec(line)?.[0];
}

function extractDateFromFragment(fragment: string): string | undefined {
  const cleaned = fragment.trim().replace(/[.;]+$/, '');
  const verbal = extractVerbalDateFragment(cleaned);
  const dmyInline = /\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.exec(cleaned)?.[0];
  const isoInline = /\d{4}-\d{2}-\d{2}/.exec(cleaned)?.[0];
  return parseFlexibleDate(cleaned)
    ?? (verbal ? parseFlexibleDate(verbal) : undefined)
    ?? (dmyInline ? parseFlexibleDate(dmyInline) : undefined)
    ?? (isoInline ? parseFlexibleDate(isoInline) : undefined);
}

function extractLabeledDate(text: string, labels: readonly string[]): string | undefined {
  const lower = text.toLowerCase();
  for (const label of labels) {
    const pos = lower.indexOf(label.toLowerCase());
    if (pos < 0) continue;
    const fragment = text.slice(pos + label.length).replace(/^\s*[:-—]?\s*/, '');
    const d = extractDateFromFragment(fragment.slice(0, 55));
    if (d) return d;
  }
  return undefined;
}

function extractFechaCiudadVerbal(text: string): string | undefined {
  const markers = [/ciudad\s+de\s+panam[aá]\s*,/i, /panam[aá]\s*,/i];
  for (const marker of markers) {
    const hit = marker.exec(text);
    if (hit?.index != null) {
      const rest = text.slice(hit.index + hit[0].length).split('\n')[0]?.trim().slice(0, 40) ?? '';
      const verbal = RE_VERBAL_DATE_PARTS.exec(rest);
      if (verbal) {
        const d = parseFlexibleDate(verbal[0]);
        if (d) return d;
      }
    }
  }
  const verbal = extractVerbalDateFragment(text.slice(0, 900));
  if (verbal) return parseFlexibleDate(verbal);
  return undefined;
}

function extractFechaOficio(text: string, flat: string): string | undefined {
  return extractLabeledDate(text, ETIQUETAS_FECHA_OFICIO)
    ?? extractLabeledDate(flat, ETIQUETAS_FECHA_OFICIO)
    ?? extractFechaCiudadVerbal(text)
    ?? extractFechaCiudadVerbal(flat);
}

function extractNumeroOficio(text: string): string | undefined {
  const patterns = [
    /(?:oficio|ref\.?|referencia)\s*(?:n[°º.]?\s*)?([A-Z]{2,5}[-/][A-Z0-9][A-Z0-9._/-]{4,40})/i,
    /\b(SBP[-/][A-Z0-9._/-]{4,40})\b/i,
    /\b(UAF[-/][A-Z0-9._/-]{4,40})\b/i,
    /\b(ISRNNF[-/][A-Z0-9._/-]{4,40})\b/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractAsunto(text: string): string | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.toLowerCase().startsWith('asunto')) continue;
    const rest = line.slice(6).replace(/^\s*[:-—]\s*/, '');
    if (rest) return rest.slice(0, 220);
  }
  const idx = text.toLowerCase().indexOf('asunto');
  if (idx < 0) return undefined;
  const rest = text.slice(idx + 6).replace(/^\s*[:-—]\s*/, '');
  const chunk = rest.split('\n')[0]?.trim() ?? '';
  return chunk.length >= 8 ? chunk.slice(0, 220) : undefined;
}

function resolveMes(nombre: string): number | undefined {
  return monthFromName(nombre);
}

function extractPeriodoRangoFechas(text: string): { desde: string; hasta: string } | undefined {
  const rango = RE_RANGO_FECHAS_NUM.exec(text) ?? RE_RANGO_FECHAS_TXT.exec(text);
  if (!rango) return undefined;
  const desde = parseFlexibleDate(rango[1]);
  const hasta = parseFlexibleDate(rango[2]);
  return desde && hasta ? { desde, hasta } : undefined;
}

function extractPeriodoMesesNombre(text: string): { desde: string; hasta: string } | undefined {
  const mesesRango = RE_PERIODO_MESES.exec(text);
  if (!mesesRango) return undefined;

  const m1 = monthFromName(mesesRango[1]);
  const m2 = monthFromName(mesesRango[2]);
  const y = +mesesRango[3];
  if (!m1 || !m2) return undefined;

  const desde = iso(y, m1, 1);
  const hasta = iso(y, m2, new Date(y, m2, 0).getDate());
  return desde && hasta ? { desde, hasta } : undefined;
}

function extractPeriodoEntreMeses(text: string): { desde: string; hasta: string } | undefined {
  const entreMeses = RE_ENTRE_MESES.exec(text);
  if (!entreMeses) return undefined;

  const m1 = monthFromName(entreMeses[2]);
  const m2 = monthFromName(entreMeses[5]);
  if (!m1 || !m2) return undefined;

  const desde = iso(+entreMeses[3], m1, +entreMeses[1]);
  const hasta = iso(+entreMeses[6], m2, +entreMeses[4]);
  return desde && hasta ? { desde, hasta } : undefined;
}

function extractPeriodo(text: string): { desde: string; hasta: string } | undefined {
  return extractPeriodoRangoFechas(text)
    ?? extractPeriodoMesesNombre(text)
    ?? extractPeriodoEntreMeses(text);
}

function extractRosList(text: string): string[] {
  const found = new Set<string>();
  const re = /\b(ROS-\d{4}-\d{5,6})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toUpperCase());
  }
  return [...found];
}

function extractItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    const num = /^(\d{1,2})[.)]\s+(.{8,500})$/.exec(t);
    if (num) items.push(num[2].trim());
    const bullet = /^[•*-]\s+(.{8,500})$/.exec(t);
    if (bullet) items.push(bullet[1].trim());
  }
  return items.slice(0, 15);
}

function inferOrganismo(text: string): OficioParse['organismo'] {
  const u = text.toUpperCase();
  if (u.includes('SUPERINTENDENCIA DE BANCOS') || /\bSBP\b/.test(u)) return 'sbp';
  if (u.includes('ISRNNF') || u.includes('NO FINANCIER')) return 'isrnnf';
  if (u.includes('UNIDAD DE ANÁLISIS FINANCIERO') || u.includes('UNIDAD DE ANALISIS FINANCIERO') || /\bUAF\b/.test(u)) return 'otro';
  return undefined;
}

function inferTipo(text: string): string | undefined {
  const u = text.toLowerCase();
  if (u.includes('requerimiento complementario') || u.includes('complementando el requerimiento')) {
    return 'requerimiento_complementario';
  }
  if (u.includes('requerimiento inicial')) return 'requerimiento_inicial';
  if (u.includes('inspección ordinaria') || u.includes('inspeccion ordinaria')) return 'inspeccion_ordinaria';
  if (u.includes('citación') || u.includes('citacion')) return 'citacion_funcionarios';
  if (u.includes('plan de acción') || u.includes('plan de accion')) return 'plan_accion';
  if (u.includes('informe preliminar')) return 'informe_preliminar';
  if (u.includes('informe final')) return 'informe_final';
  if (u.includes('seguimiento')) return 'seguimiento';
  if (u.includes('cierre de supervisión') || u.includes('cierre de supervision')) return 'cierre_supervision';
  return undefined;
}

export function plazoFromDiasHabiles(fechaOficio: string, dias: number): string {
  const d = new Date(fechaOficio + 'T12:00:00');
  let added = 0;
  const limit = Math.min(Math.max(dias, 1), 90);
  while (added < limit) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function parseDiasHabilesMencionados(text: string): number | undefined {
  const paren = /\((\d{1,3})\)\s*d[ií]as?\s*h[aá]biles/i.exec(text);
  if (paren) return Math.min(+paren[1], 90);

  const num = /(\d{1,3})\s+d[ií]as?\s+h[aá]biles/i.exec(text);
  if (num) return Math.min(+num[1], 90);

  const wordParen = RE_DIAS_PALABRA_PAREN.exec(text);
  if (wordParen) return NUMEROS_EN_PALABRA[wordParen[1].trim().toLowerCase()];

  const wordSimple = RE_DIAS_PALABRA.exec(text);
  if (wordSimple) return NUMEROS_EN_PALABRA[wordSimple[1].trim().toLowerCase()];

  return undefined;
}

function extractPlazo(
  text: string,
  flat: string,
  fechaOficio?: string,
  tipoComunicacion?: string,
): string | undefined {
  const explicit = extractLabeledDate(text, ETIQUETAS_PLAZO_RESPUESTA)
    ?? extractLabeledDate(flat, ETIQUETAS_PLAZO_RESPUESTA);
  if (explicit) return explicit;

  const vence = extractVenceDate(text) ?? extractVenceDate(flat);
  if (vence) return vence;

  const dias = parseDiasHabilesMencionados(text) ?? parseDiasHabilesMencionados(flat);
  if (dias && fechaOficio) {
    return plazoFromDiasHabiles(fechaOficio, dias);
  }

  if (fechaOficio && tipoComunicacion && PLAZO_DIAS_POR_TIPO[tipoComunicacion]) {
    const hint = text.toLowerCase().includes('plazo de respuesta')
      || flat.toLowerCase().includes('plazo de respuesta')
      || text.toLowerCase().includes('días hábiles')
      || text.toLowerCase().includes('dias habiles');
    if (hint) {
      return plazoFromDiasHabiles(fechaOficio, PLAZO_DIAS_POR_TIPO[tipoComunicacion]);
    }
  }
  return undefined;
}

/** Análisis completo del texto del oficio (OCR o capa PDF). */
export function parseOficioText(text: string): OficioParse {
  const parse: OficioParse = {};
  const flat = text.replaceAll('\r\n', '\n').replaceAll('\n', ' ').replace(/\s+/g, ' ');

  parse.numero_oficio = extractNumeroOficio(text);
  parse.asunto = extractAsunto(text);
  parse.organismo = inferOrganismo(text);
  parse.tipo_comunicacion = inferTipo(text);

  parse.fecha_oficio = extractFechaOficio(text, flat);
  parse.fecha_limite_respuesta = extractPlazo(
    text,
    flat,
    parse.fecha_oficio,
    parse.tipo_comunicacion,
  );

  parse.periodo = extractPeriodo(flat) ?? extractPeriodo(text.replace(/\n/g, ' '));
  parse.lista_ros = extractRosList(text);
  const items = extractItems(text);
  if (items.length > 0) parse.items_solicitados = items;

  return parse;
}

/** Combina valores guardados con re-parse; prioriza fechas detectadas en texto. */
export function mergeOficioParse(stored: OficioParse, fresh: OficioParse): OficioParse {
  return {
    ...stored,
    ...fresh,
    periodo: fresh.periodo ?? stored.periodo,
    lista_ros: fresh.lista_ros?.length ? fresh.lista_ros : stored.lista_ros,
    items_solicitados: fresh.items_solicitados?.length ? fresh.items_solicitados : stored.items_solicitados,
    numero_oficio: fresh.numero_oficio ?? stored.numero_oficio,
    asunto: fresh.asunto ?? stored.asunto,
    organismo: fresh.organismo ?? stored.organismo,
    tipo_comunicacion: fresh.tipo_comunicacion ?? stored.tipo_comunicacion,
    fecha_oficio: fresh.fecha_oficio ?? stored.fecha_oficio,
    fecha_limite_respuesta: fresh.fecha_limite_respuesta ?? stored.fecha_limite_respuesta,
  };
}

/** Fechas efectivas: columna BD o parse OCR. */
export function fechasEfectivasComunicacion(
  row: { fecha_oficio?: string | null; fecha_limite_respuesta?: string | null },
  parse: OficioParse,
): { fecha_oficio: string | null; fecha_limite_respuesta: string | null } {
  return {
    fecha_oficio: row.fecha_oficio?.slice(0, 10) ?? parse.fecha_oficio ?? null,
    fecha_limite_respuesta: row.fecha_limite_respuesta?.slice(0, 10) ?? parse.fecha_limite_respuesta ?? null,
  };
}

/** @deprecated usar parseOficioText */
export function hintsFromOcrText(text: string): OficioParse {
  return parseOficioText(text);
}

export function parseFromTextoOcrJson(raw: string | null | undefined): OficioParse {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as {
      parse?: OficioParse;
      sugerencias?: OficioParse;
      texto_extraido?: string;
    };
    const texto = j.texto_extraido;
    const stored = (j.parse ?? j.sugerencias) as OficioParse | undefined;
    if (texto) {
      const fresh = parseOficioText(texto);
      if (stored && typeof stored === 'object') return mergeOficioParse(stored, fresh);
      return fresh;
    }
    if (stored && typeof stored === 'object') return stored;
  } catch {
    /* ignore */
  }
  return {};
}
