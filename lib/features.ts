/**
 * Banderas de funcionalidad — PRD flujo-auditoria (MVP).
 * El código de auditoría/logs se conserva; la UI se oculta cuando la bandera es false.
 */
export const FEATURES = {
  /** Rol /auditor y cuenta auditor@ — deshabilitado en MVP visual */
  AUDITOR_UI: false,
  /** /uaf/auditoria, /admin/auditoria, pestaña Auditoría en expediente UAF */
  AUDIT_LOG_UI: false,
  /** Módulo atención a supervisión (SBP/ISRNNF) en /portal/supervision */
  SUPERVISION_SO: true,
} as const;
