// types/index.ts — Tipos compartidos del dominio SAGAF

export type Role = 'sujeto_obligado' | 'analista' | 'supervisor' | 'auditor' | 'admin';

export type RosEstado =
  | 'borrador'
  | 'recibido'
  | 'en_analisis'
  | 'en_revision_vinculo'
  | 'revision_documental'
  | 'subsanacion'
  | 'riesgo_clasificado'
  | 'cerrado';

export type RiesgoNivel = 'bajo' | 'medio' | 'alto';

export type DocumentoEstado = 'pendiente' | 'cargado' | 'observado' | 'validado' | 'no_aplica';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
  sujeto_obligado_id: string | null;
  estado: 'activo' | 'inactivo';
  mfa_activo: number;
}

export interface SujetoObligado {
  id: string;
  nombre: string;
  ruc: string | null;
  tipo: string;
  sector: string;
  organismo_supervisor: string | null;
  estado: 'activo' | 'inactivo';
  responsable_cumpl: string | null;
}

export interface PlantillaROS {
  id: string;
  nombre: string;
  version: string;
  tipo_sujeto_obligado: string;
  sector: string | null;
  activa: number;
}

export interface DocumentoRequerido {
  id: string;
  plantilla_id: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: number;
  formatos_permitidos: string;
  tamano_maximo_mb: number;
  orden: number;
}

export interface ROS {
  id: string;
  numero_ros: string;
  sujeto_obligado_id: string;
  plantilla_id: string;
  oficial_cumplimiento: string;
  correo_oficial: string | null;
  fecha_deteccion: string;
  fecha_recepcion: string;
  estado: RosEstado;
  descripcion: string;
  canal_recepcion: string;
  creado_por: string;
}

export interface ParteInvolucrada {
  id: string;
  ros_id: string;
  rol_en_operacion: string;
  tipo_persona: 'natural' | 'juridica';
  identificador: string;
  identificador_enmascarado: string;
  nombre_visible: string | null;
  datos_sensibles_bloqueados: number;
}

export interface OperacionSospechosa {
  id: string;
  ros_id: string;
  monto: number;
  moneda: string;
  jurisdiccion: string | null;
  producto_servicio: string | null;
  tipo_operacion: string | null;
  senal_alerta: string;
  bien_inmueble: string | null;
  forma_pago: string | null;
}

export interface DocumentoAdjunto {
  id: string;
  ros_id: string;
  documento_requerido_id: string | null;
  nombre_archivo: string;
  ruta_archivo: string;
  tipo_mime: string | null;
  hash_archivo: string | null;
  tamano_bytes: number;
  estado: DocumentoEstado;
  observacion: string | null;
  cargado_por: string;
  fecha_carga: string;
}

export interface RiesgoCaso {
  id: string;
  ros_id: string;
  nivel: RiesgoNivel;
  puntaje: number;
  justificacion: string;
  clasificado_por: string;
  fecha_clasificacion: string;
}

export interface VinculoIntersectorial {
  id: string;
  ros_origen_id: string;
  ros_destino_id: string;
  tipo_vinculo: string;
  descripcion: string | null;
  confirmado: number;
  decidido_por: string | null;
  fecha_deteccion: string;
  fecha_decision: string | null;
}

export interface SolicitudSubsanacion {
  id: string;
  ros_id: string;
  documento_adjunto_id: string | null;
  motivo: string;
  estado: 'pendiente' | 'atendida';
  solicitada_por: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  respuesta: string | null;
}

export interface EventoAuditoria {
  id: string;
  fecha_hora_servidor: string;
  usuario_id: string | null;
  usuario_correo: string | null;
  rol: string | null;
  modulo: string;
  accion: string;
  resultado: 'exito' | 'fallo' | 'bloqueado';
  ip: string | null;
  user_agent: string | null;
  recurso_afectado: string | null;
  detalle: string | null;
  criticidad: 'normal' | 'alta' | 'critica';
}
