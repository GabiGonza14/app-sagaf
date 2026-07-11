// lib/supervision/catalogo.ts — Sugerencias de contenido según tipo de comunicación × tipo SO (PRD §14)
import type { TipoComunicacionId } from './constants';

export type TipoSo = 'bank' | 'realestate' | string;

export interface SugerenciaPaquete {
  resumen: string;
  items: string[];
  alcance_tipo: 'periodo' | 'lista_ros' | 'muestra';
  tamano_muestra?: number;
  nivel_contenido: 'metadatos' | 'resumido' | 'completo';
  incluir_documentos: boolean;
  incluir_log: boolean;
  incluir_partes: boolean;
  incluir_riesgo: boolean;
  incluir_subsanaciones: boolean;
  incluir_indice_cumplimiento: boolean;
  fuera_de_sagaf?: string[];
}

const DEFAULT: SugerenciaPaquete = {
  resumen: 'Paquete acotado a los expedientes ROS indicados en el oficio o en el alcance definido.',
  items: [
    'Listado de ROS en el alcance acordado',
    'Estado y fechas de cada expediente',
    'Índice de documentación cargada por ROS',
  ],
  alcance_tipo: 'periodo',
  nivel_contenido: 'resumido',
  incluir_documentos: true,
  incluir_log: false,
  incluir_partes: false,
  incluir_riesgo: true,
  incluir_subsanaciones: true,
  incluir_indice_cumplimiento: true,
};

const BANK: Partial<Record<TipoComunicacionId, SugerenciaPaquete>> = {
  inspeccion_ordinaria: {
    resumen: 'Muestra representativa de ROS + índice de cumplimiento documental (inspección ordinaria SBP).',
    items: [
      'Muestra aleatoria de ROS del periodo de inspección',
      'Metadatos y estado de cada expediente',
      'Índice de documentos obligatorios cargados vs. plantilla',
      'Trazabilidad de acciones sobre los ROS incluidos (si el oficio lo requiere)',
    ],
    alcance_tipo: 'muestra',
    tamano_muestra: 10,
    nivel_contenido: 'resumido',
    incluir_documentos: true,
    incluir_log: true,
    incluir_partes: false,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
    fuera_de_sagaf: ['Manual AML / políticas internas', 'Organigrama de cumplimiento', 'EEFF auditados'],
  },
  requerimiento_inicial: {
    resumen: 'ROS del periodo solicitado + checklist documental según plantilla banco.',
    items: [
      'ROS recibidos en el periodo del requerimiento',
      'Narrativa resumida y montos (nivel resumido)',
      'Checklist de documentos por plantilla bank',
      'Clasificación de riesgo UAF cuando aplique',
    ],
    alcance_tipo: 'periodo',
    nivel_contenido: 'resumido',
    incluir_documentos: true,
    incluir_log: false,
    incluir_partes: true,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
    fuera_de_sagaf: ['Matrices de riesgo', 'Manuales de procedimiento', 'Actas de comité'],
  },
  requerimiento_complementario: {
    resumen: 'Lista explícita de ROS citados en el oficio + adjuntos/metadata.',
    items: [
      'Expedientes ROS citados literalmente en el oficio',
      'Documentos adjuntos o metadatos según nivel de contenido',
      'Subsanaciones pendientes o atendidas sobre esos casos',
    ],
    alcance_tipo: 'lista_ros',
    nivel_contenido: 'completo',
    incluir_documentos: true,
    incluir_log: true,
    incluir_partes: true,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
  },
  seguimiento: {
    resumen: 'ROS posteriores a hallazgos + estados de cierre o subsanación.',
    items: [
      'ROS registrados después de la fecha del informe preliminar',
      'Estado actual y clasificación de riesgo',
      'Evidencia de atención a observaciones previas',
    ],
    alcance_tipo: 'periodo',
    nivel_contenido: 'resumido',
    incluir_documentos: true,
    incluir_log: false,
    incluir_partes: false,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
  },
};

const REALESTATE: Partial<Record<TipoComunicacionId, SugerenciaPaquete>> = {
  requerimiento_inicial: {
    resumen: 'ROS inmobiliarios del periodo + documentación de debida diligencia.',
    items: [
      'ROS de operaciones inmobiliarias en el periodo',
      'Metadatos de comprador / inmueble / forma de pago',
      'Checklist documental plantilla inmobiliaria',
    ],
    alcance_tipo: 'periodo',
    nivel_contenido: 'resumido',
    incluir_documentos: true,
    incluir_log: false,
    incluir_partes: true,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
  },
  requerimiento_complementario: {
    resumen: 'Casos citados en el oficio con detalle de operación inmobiliaria.',
    items: [
      'ROS listados en el requerimiento complementario',
      'Partes involucradas (identificadores enmascarados)',
      'Documentos de sustento de fondos y contrato',
    ],
    alcance_tipo: 'lista_ros',
    nivel_contenido: 'completo',
    incluir_documentos: true,
    incluir_log: false,
    incluir_partes: true,
    incluir_riesgo: true,
    incluir_subsanaciones: true,
    incluir_indice_cumplimiento: true,
  },
};

export function sugerenciaPaquete(
  tipoComunicacion: string,
  tipoSo: TipoSo,
): SugerenciaPaquete {
  const map = tipoSo === 'realestate' ? REALESTATE : BANK;
  const specific = map[tipoComunicacion as TipoComunicacionId];
  return specific ? { ...DEFAULT, ...specific } : { ...DEFAULT };
}
