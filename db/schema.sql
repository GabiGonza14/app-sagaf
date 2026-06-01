-- =====================================================================
-- SAGAF — Sistema Automatizado de Gestión de Análisis Financiero
-- Schema basado en el Diagrama de Clases UML (Parcial ISA 4 V2.0, sec. 4.4)
-- Cumple Ley 23 de 2015 (PLA/FT) y Ley 81 de 2019 (Protección de Datos)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
-- Control de acceso (RF-05, RNF-02)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rol (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS permiso (
  id      TEXT PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  modulo  TEXT NOT NULL,
  accion  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id     TEXT NOT NULL,
  permiso_id TEXT NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  FOREIGN KEY (rol_id)     REFERENCES rol(id)     ON DELETE CASCADE,
  FOREIGN KEY (permiso_id) REFERENCES permiso(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- Sujetos obligados (CU-06) y sus plantillas dinámicas (RF-01)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sujeto_obligado (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  ruc                   TEXT UNIQUE,
  tipo                  TEXT NOT NULL,            -- bank | realestate | casino | abogado | ...
  sector                TEXT NOT NULL,
  organismo_supervisor  TEXT,
  estado                TEXT NOT NULL DEFAULT 'activo',  -- activo | inactivo
  responsable_cumpl     TEXT,
  fecha_registro        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plantilla_ros (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  version               TEXT NOT NULL,
  tipo_sujeto_obligado  TEXT NOT NULL,            -- bank | realestate | ...
  sector                TEXT,
  activa                INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sujeto_obligado_plantilla (
  sujeto_obligado_id TEXT NOT NULL,
  plantilla_id       TEXT NOT NULL,
  PRIMARY KEY (sujeto_obligado_id, plantilla_id),
  FOREIGN KEY (sujeto_obligado_id) REFERENCES sujeto_obligado(id) ON DELETE CASCADE,
  FOREIGN KEY (plantilla_id)       REFERENCES plantilla_ros(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campo_plantilla (
  id                TEXT PRIMARY KEY,
  plantilla_id      TEXT NOT NULL,
  nombre            TEXT NOT NULL,
  tipo_dato         TEXT NOT NULL,                -- text | number | date | select | textarea
  obligatorio       INTEGER NOT NULL DEFAULT 0,
  orden             INTEGER NOT NULL,
  regla_validacion  TEXT,
  FOREIGN KEY (plantilla_id) REFERENCES plantilla_ros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documento_requerido (
  id                  TEXT PRIMARY KEY,
  plantilla_id        TEXT NOT NULL,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  obligatorio         INTEGER NOT NULL DEFAULT 1,
  tipo_requerimiento  TEXT NOT NULL DEFAULT 'requerido',  -- requerido | condicional | opcional
  formatos_permitidos TEXT NOT NULL DEFAULT 'pdf,jpg,png,doc,docx,xls,xlsx',
  tamano_maximo_mb    INTEGER NOT NULL DEFAULT 10,
  orden               INTEGER NOT NULL,
  FOREIGN KEY (plantilla_id) REFERENCES plantilla_ros(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- Usuarios (RF-05, RNF-02). MFA obligatorio (RNF-01).
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuario (
  id                  TEXT PRIMARY KEY,
  nombre              TEXT NOT NULL,
  correo              TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  rol_id              TEXT NOT NULL,
  sujeto_obligado_id  TEXT,                       -- NULL para roles UAF/admin/auditor
  estado              TEXT NOT NULL DEFAULT 'activo', -- activo | inactivo
  mfa_secret          TEXT,                       -- secret TOTP base32 (encrypted at-rest en prod)
  mfa_activo          INTEGER NOT NULL DEFAULT 0,
  ultimo_acceso       TEXT,
  fecha_creacion      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id)             REFERENCES rol(id),
  FOREIGN KEY (sujeto_obligado_id) REFERENCES sujeto_obligado(id)
);

-- ------------------------------------------------------------------
-- ROS — Reporte de Operación Sospechosa (CU-01, RF-01)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ros (
  id                   TEXT PRIMARY KEY,
  numero_ros           TEXT NOT NULL UNIQUE,      -- ROS-2026-000248
  sujeto_obligado_id   TEXT NOT NULL,
  plantilla_id         TEXT NOT NULL,
  oficial_cumplimiento TEXT NOT NULL,
  correo_oficial       TEXT,
  fecha_deteccion      TEXT NOT NULL,
  fecha_recepcion      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado               TEXT NOT NULL DEFAULT 'recibido',
  -- borrador | recibido | en_analisis | revision_documental | subsanacion | escalado | cerrado | vinculado
  descripcion          TEXT NOT NULL,
  canal_recepcion      TEXT NOT NULL DEFAULT 'portal_publico',
  creado_por           TEXT NOT NULL,
  FOREIGN KEY (sujeto_obligado_id) REFERENCES sujeto_obligado(id),
  FOREIGN KEY (plantilla_id)       REFERENCES plantilla_ros(id),
  FOREIGN KEY (creado_por)         REFERENCES usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_ros_estado     ON ros(estado);
CREATE INDEX IF NOT EXISTS idx_ros_sujeto     ON ros(sujeto_obligado_id);
CREATE INDEX IF NOT EXISTS idx_ros_recepcion  ON ros(fecha_recepcion);

-- Partes involucradas: ordenante / beneficiario / comprador / vendedor / etc. (RF-06)
CREATE TABLE IF NOT EXISTS parte_involucrada (
  id                          TEXT PRIMARY KEY,
  ros_id                      TEXT NOT NULL,
  rol_en_operacion            TEXT NOT NULL,      -- ordenante | beneficiario | comprador | vendedor | beneficiario_final | representante_legal | apoderado
  tipo_persona                TEXT NOT NULL,      -- natural | juridica
  identificador               TEXT NOT NULL,      -- cédula / pasaporte / RUC
  identificador_enmascarado   TEXT NOT NULL,      -- ***-***-482
  nombre_visible              TEXT,               -- SOLO el nombre, Ley 81
  datos_sensibles_bloqueados  INTEGER NOT NULL DEFAULT 1,  -- 1 = no se autocompletaron datos en portal
  FOREIGN KEY (ros_id) REFERENCES ros(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parte_id ON parte_involucrada(identificador);

-- Operación sospechosa
CREATE TABLE IF NOT EXISTS operacion_sospechosa (
  id                TEXT PRIMARY KEY,
  ros_id            TEXT NOT NULL,
  monto             REAL NOT NULL,
  moneda            TEXT NOT NULL DEFAULT 'USD',
  jurisdiccion      TEXT,
  producto_servicio TEXT,
  tipo_operacion    TEXT,
  senal_alerta      TEXT NOT NULL,
  bien_inmueble     TEXT,                         -- aplica a inmobiliaria
  forma_pago        TEXT,                         -- aplica a inmobiliaria
  FOREIGN KEY (ros_id) REFERENCES ros(id) ON DELETE CASCADE
);

-- Documento adjunto: cada archivo asociado a UN documento_requerido (RF-07, CU-08)
CREATE TABLE IF NOT EXISTS documento_adjunto (
  id                       TEXT PRIMARY KEY,
  ros_id                   TEXT NOT NULL,
  documento_requerido_id   TEXT,                  -- NULL = evidencia adicional no catalogada
  nombre_archivo           TEXT NOT NULL,
  ruta_archivo             TEXT NOT NULL,
  tipo_mime                TEXT,
  hash_archivo             TEXT,
  tamano_bytes             INTEGER NOT NULL,
  estado                   TEXT NOT NULL DEFAULT 'cargado',
  -- pendiente | cargado | observado | validado | no_aplica
  observacion              TEXT,
  cargado_por              TEXT NOT NULL,
  fecha_carga              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ros_id)                 REFERENCES ros(id) ON DELETE CASCADE,
  FOREIGN KEY (documento_requerido_id) REFERENCES documento_requerido(id),
  FOREIGN KEY (cargado_por)            REFERENCES usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_doc_ros ON documento_adjunto(ros_id);

-- ------------------------------------------------------------------
-- Análisis y clasificación (CU-02)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS caso_analisis (
  id              TEXT PRIMARY KEY,
  codigo_caso     TEXT NOT NULL UNIQUE,
  ros_id          TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'abierto',
  fecha_apertura  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre    TEXT,
  FOREIGN KEY (ros_id) REFERENCES ros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS riesgo_caso (
  id                  TEXT PRIMARY KEY,
  ros_id              TEXT NOT NULL,
  nivel               TEXT NOT NULL,              -- bajo | medio | alto
  puntaje             INTEGER NOT NULL,
  justificacion       TEXT NOT NULL,              -- obligatoria (RF-02)
  clasificado_por     TEXT NOT NULL,
  fecha_clasificacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ros_id)          REFERENCES ros(id) ON DELETE CASCADE,
  FOREIGN KEY (clasificado_por) REFERENCES usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_riesgo_ros ON riesgo_caso(ros_id, fecha_clasificacion);

-- Vinculación intersectorial (CU-07) — confirmación humana requerida
CREATE TABLE IF NOT EXISTS vinculo_intersectorial (
  id              TEXT PRIMARY KEY,
  ros_origen_id   TEXT NOT NULL,
  ros_destino_id  TEXT NOT NULL,
  tipo_vinculo    TEXT NOT NULL,                  -- persona | beneficiario | sociedad | cuenta | inmueble | documento | direccion
  descripcion     TEXT,
  confirmado      INTEGER NOT NULL DEFAULT 0,
  decidido_por    TEXT,
  fecha_deteccion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_decision  TEXT,
  FOREIGN KEY (ros_origen_id)  REFERENCES ros(id) ON DELETE CASCADE,
  FOREIGN KEY (ros_destino_id) REFERENCES ros(id) ON DELETE CASCADE,
  FOREIGN KEY (decidido_por)   REFERENCES usuario(id)
);

-- Solicitud de subsanación (CU-08)
CREATE TABLE IF NOT EXISTS solicitud_subsanacion (
  id              TEXT PRIMARY KEY,
  ros_id          TEXT NOT NULL,
  documento_adjunto_id TEXT,                      -- documento observado, si aplica
  motivo          TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | atendida | vencida
  solicitada_por  TEXT NOT NULL,
  fecha_solicitud TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta TEXT,
  respuesta       TEXT,
  FOREIGN KEY (ros_id)               REFERENCES ros(id) ON DELETE CASCADE,
  FOREIGN KEY (documento_adjunto_id) REFERENCES documento_adjunto(id),
  FOREIGN KEY (solicitada_por)       REFERENCES usuario(id)
);

-- ------------------------------------------------------------------
-- Reportes (CU-04)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reporte_inteligencia (
  id                   TEXT PRIMARY KEY,
  tipo_reporte         TEXT NOT NULL,             -- operativo | documental | estadistico | inteligencia
  periodo              TEXT,
  parametros           TEXT,                      -- JSON
  nivel_confidencialidad TEXT NOT NULL DEFAULT 'restringido',
  generado_por         TEXT NOT NULL,
  fecha_generacion     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exportado            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (generado_por) REFERENCES usuario(id)
);

-- ------------------------------------------------------------------
-- Auditoría inmutable (RF-03, RNF-03, CU-03)
-- Nota: el log es de SOLO LECTURA. Cualquier UPDATE/DELETE debe ser bloqueado por trigger.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS evento_auditoria (
  id                  TEXT PRIMARY KEY,
  fecha_hora_servidor TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id          TEXT,                       -- NULL en intentos fallidos pre-login
  usuario_correo      TEXT,                       -- snapshot — sobrevive aunque se borre el usuario
  rol                 TEXT,
  modulo              TEXT NOT NULL,
  accion              TEXT NOT NULL,
  resultado           TEXT NOT NULL,              -- exito | fallo | bloqueado
  ip                  TEXT,
  user_agent          TEXT,
  recurso_afectado    TEXT,                       -- ej. ROS-2026-000248
  detalle             TEXT,                       -- JSON con contexto extra
  criticidad          TEXT NOT NULL DEFAULT 'normal' -- normal | alta | critica
);

CREATE INDEX IF NOT EXISTS idx_audit_fecha   ON evento_auditoria(fecha_hora_servidor);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON evento_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_recurso ON evento_auditoria(recurso_afectado);
CREATE INDEX IF NOT EXISTS idx_audit_critic  ON evento_auditoria(criticidad);

-- Trigger: el log de auditoría no se puede modificar ni eliminar (RF-03 RE-01)
CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_update
BEFORE UPDATE ON evento_auditoria
BEGIN
  SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)');
END;

CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_delete
BEFORE DELETE ON evento_auditoria
BEGIN
  SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)');
END;

-- ------------------------------------------------------------------
-- Mock de personas (datos sintéticos para verificación Ley 81)
-- El portal público SOLO retorna 'nombre' cuando hay coincidencia.
-- Los demás campos están aquí solo para la vista UAF interna autorizada.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS persona_mock (
  identificador      TEXT PRIMARY KEY,            -- 8-888-888 | PE-8891 | RUC-77
  tipo_documento     TEXT NOT NULL,               -- cedula | pasaporte | ruc
  nombre             TEXT NOT NULL,
  -- Campos NO expuestos en portal público:
  direccion          TEXT,
  telefono           TEXT,
  actividad_economica TEXT,
  nacionalidad       TEXT
);
