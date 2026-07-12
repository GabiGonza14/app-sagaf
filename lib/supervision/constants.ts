// lib/supervision/constants.ts — Tipos de comunicación referenciales (no oficiales SBP)

export const TIPOS_COMUNICACION = [
  { id: 'inspeccion_ordinaria', label: 'Notificación de inspección ordinaria' },
  { id: 'requerimiento_inicial', label: 'Requerimiento inicial de información' },
  { id: 'requerimiento_complementario', label: 'Requerimiento complementario' },
  { id: 'citacion_funcionarios', label: 'Citación de funcionarios' },
  { id: 'plan_accion', label: 'Solicitud de plan de acción' },
  { id: 'informe_preliminar', label: 'Informe preliminar' },
  { id: 'informe_final', label: 'Informe final' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'cierre_supervision', label: 'Cierre de supervisión' },
] as const;

export type TipoComunicacionId = (typeof TIPOS_COMUNICACION)[number]['id'];

export const ORGANISMOS_SUPERVISION = [
  { id: 'sbp', label: 'Superintendencia de Bancos de Panamá (SBP)' },
  { id: 'isrnnf', label: 'ISRNNF (sujetos no financieros)' },
  { id: 'otro', label: 'Otro organismo supervisor' },
] as const;

export const NIVELES_CONTENIDO = [
  { id: 'metadatos', label: 'Metadatos (números, fechas, estados)' },
  { id: 'resumido', label: 'Expediente resumido (+ narrativa enmascarada)' },
  { id: 'completo', label: 'Expediente completo (+ documentos adjuntos)' },
] as const;

export function labelTipoComunicacion(id: string): string {
  return TIPOS_COMUNICACION.find((t) => t.id === id)?.label ?? id;
}
