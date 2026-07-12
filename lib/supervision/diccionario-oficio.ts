// lib/supervision/diccionario-oficio.ts — Etiquetas y patrones probables en oficios SBP / UAF / ISRNNF

/** Etiquetas explícitas de fecha del oficio (orden de prioridad). */
export const ETIQUETAS_FECHA_OFICIO = [
  'fecha del oficio',
  'fecha de oficio',
  'fecha de emisión',
  'fecha de emision',
  'fecha del documento',
  'f\\. de oficio',
  'fecha',
] as const;

/** Etiquetas de plazo o fecha límite de respuesta. */
export const ETIQUETAS_PLAZO_RESPUESTA = [
  'plazo de respuesta',
  'plazo para responder',
  'plazo de entrega',
  'fecha límite de respuesta',
  'fecha limite de respuesta',
  'fecha límite',
  'fecha limite',
  'vence el',
  'vencimiento',
  'debe remitirse antes del',
  'debe remitirse a más tardar el',
  'debe remitirse a mas tardar el',
  'a más tardar el',
  'a mas tardar el',
  'plazo',
] as const;

/** Números en palabras usados en plazos (días hábiles). */
export const NUMEROS_EN_PALABRA: Record<string, number> = {
  un: 1, uno: 1, una: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciséis: 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, 'veintidós': 22, veintidos: 22, 'veintitrés': 23, veintitres: 23,
  treinta: 30, cuarenta: 40, 'cuarenta y cinco': 45, sesenta: 60, noventa: 90,
};

/** Plazos habituales (días hábiles) por tipo si el texto solo menciona el tipo sin cifra. */
export const PLAZO_DIAS_POR_TIPO: Record<string, number> = {
  requerimiento_inicial: 20,
  requerimiento_complementario: 10,
  inspeccion_ordinaria: 20,
  citacion_funcionarios: 5,
  plan_accion: 15,
  informe_preliminar: 10,
  informe_final: 10,
  seguimiento: 10,
  cierre_supervision: 5,
};
