// db/seed.ts — Datos iniciales conforme al documento académico (Parcial ISA 4 V2.0)
// Ejecutar: npm run db:seed
// Cumple Ley 81/2019: las personas_mock representan datos sintéticos. En el
// portal público SOLO se expone el nombre tras verificación (RF-06).

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = process.env.DB_PATH ?? './db/sagaf.db';
const schemaPath = resolve(process.cwd(), 'db/schema.sql');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Aplicar schema si la tabla principal no existe aún
const hasUsuario = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuario'")
  .get();
if (!hasUsuario && existsSync(schemaPath)) {
  db.exec(readFileSync(schemaPath, 'utf8'));
}

// Preserva secretos MFA antes de limpiar (evita invalidar QR ya escaneados en dev)
const mfaBackup = db.prepare(
  'SELECT id, mfa_secret, mfa_activo FROM usuario WHERE mfa_secret IS NOT NULL AND mfa_activo = 1',
).all() as Array<{ id: string; mfa_secret: string; mfa_activo: number }>;

// Limpieza idempotente (en orden inverso de FK)
const tables = [
  'evento_auditoria',
  'solicitud_subsanacion',
  'vinculo_intersectorial',
  'riesgo_caso',
  'caso_analisis',
  'reporte_inteligencia',
  'documento_adjunto',
  'operacion_sospechosa',
  'parte_involucrada',
  'ros',
  'documento_requerido',
  'campo_plantilla',
  'sujeto_obligado_plantilla',
  'plantilla_ros',
  'usuario',
  'sujeto_obligado',
  'rol_permiso',
  'permiso',
  'rol',
];
db.exec('PRAGMA foreign_keys = OFF');
db.exec('BEGIN');
// Deshabilita triggers de inmutabilidad temporalmente para la limpieza del seed
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_update');
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_delete');
for (const t of tables) db.exec(`DELETE FROM ${t}`);
db.exec('COMMIT');
db.exec('PRAGMA foreign_keys = ON');
// Recrea los triggers de inmutabilidad (RF-03 RE-01)
db.exec(`CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_update BEFORE UPDATE ON evento_auditoria BEGIN SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)'); END`);
db.exec(`CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_delete BEFORE DELETE ON evento_auditoria BEGIN SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)'); END`);

// =====================================================================
// 1. Roles y permisos (CU-05, RF-05)
// =====================================================================
const insertRol = db.prepare('INSERT INTO rol (id, nombre, descripcion) VALUES (?, ?, ?)');
const roles = [
  ['rol_sujeto_obligado', 'sujeto_obligado', 'Banco, inmobiliaria u otro sujeto obligado reportante'],
  ['rol_analista',        'analista',        'Analista de la UAF — revisa y clasifica ROS'],
  ['rol_supervisor',      'supervisor',      'Supervisor UAF — valida acciones críticas y aprueba cierres'],
  ['rol_auditor',         'auditor',         'Auditor interno — solo lectura del log de auditoría'],
  ['rol_admin',           'admin',           'Administrador del sistema — gestiona usuarios, roles y plantillas'],
];
for (const r of roles) insertRol.run(r);

const insertPermiso = db.prepare(
  'INSERT INTO permiso (id, codigo, modulo, accion) VALUES (?, ?, ?, ?)',
);
const permisos: Array<[string, string, string, string]> = [
  ['p_ros_create',      'ros:create',      'ros',         'Registrar ROS'],
  ['p_ros_read_own',    'ros:read_own',    'ros',         'Consultar ROS propios'],
  ['p_ros_read_all',    'ros:read_all',    'ros',         'Consultar todos los ROS'],
  ['p_ros_classify',    'ros:classify',    'ros',         'Clasificar riesgo'],
  ['p_ros_close',       'ros:close',       'ros',         'Cerrar caso'],
  ['p_doc_upload',      'doc:upload',      'documentos',  'Cargar documentos'],
  ['p_doc_validate',    'doc:validate',    'documentos',  'Validar/observar documentos'],
  ['p_subsanacion',     'subsanacion',     'documentos',  'Solicitar/atender subsanación'],
  ['p_reporte_gen',     'reporte:generar', 'reportes',    'Generar reportes'],
  ['p_reporte_export',  'reporte:exportar','reportes',    'Exportar reportes'],
  ['p_usuario_admin',   'usuario:admin',   'admin',       'Gestionar usuarios y roles'],
  ['p_sujeto_admin',    'sujeto:admin',    'admin',       'Gestionar sujetos obligados'],
  ['p_audit_read',      'audit:read',      'auditoria',   'Consultar log de auditoría'],
  ['p_vinculo',         'vinculo',         'vinculos',    'Confirmar vinculaciones'],
];
for (const p of permisos) insertPermiso.run(...p);

const insertRolPermiso = db.prepare(
  'INSERT INTO rol_permiso (rol_id, permiso_id) VALUES (?, ?)',
);
const rolPermisoMap: Record<string, string[]> = {
  rol_sujeto_obligado: ['p_ros_create', 'p_ros_read_own', 'p_doc_upload'],
  rol_analista:        ['p_ros_read_all', 'p_ros_classify', 'p_doc_validate', 'p_subsanacion', 'p_vinculo', 'p_reporte_gen', 'p_audit_read'],
  rol_supervisor:      ['p_ros_read_all', 'p_ros_classify', 'p_ros_close', 'p_doc_validate', 'p_subsanacion', 'p_vinculo', 'p_reporte_gen', 'p_reporte_export', 'p_audit_read'],
  rol_auditor:         ['p_audit_read'],
  rol_admin:           ['p_usuario_admin', 'p_sujeto_admin', 'p_audit_read'],
};
for (const [rol, perms] of Object.entries(rolPermisoMap)) {
  for (const p of perms) insertRolPermiso.run(rol, p);
}

// =====================================================================
// 2. Sujetos obligados (CU-06)
// =====================================================================
const insertSO = db.prepare(`
  INSERT INTO sujeto_obligado (id, nombre, ruc, tipo, sector, organismo_supervisor, estado, responsable_cumpl)
  VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)
`);
insertSO.run(
  'so_banco_nacional',
  'Banco Nacional de Panamá',
  'RUC-155123456-2-2018',
  'bank',
  'financiero',
  'Superintendencia de Bancos de Panamá',
  'Lic. Roberto Mendoza',
);
insertSO.run(
  'so_inmob_istmo',
  'Inmobiliaria Istmo',
  'RUC-155789123-1-2020',
  'realestate',
  'no_financiero',
  'Intendencia de Supervisión y Regulación de Sujetos No Financieros',
  'Lic. Patricia Vásquez',
);

// =====================================================================
// 3. Plantillas ROS dinámicas y sus documentos requeridos (RF-01, RF-07)
//    Listas tomadas literalmente del Prototipo.html del Parcial 1.
// =====================================================================
const insertPlantilla = db.prepare(`
  INSERT INTO plantilla_ros (id, nombre, version, tipo_sujeto_obligado, sector, activa)
  VALUES (?, ?, '1.0', ?, ?, 1)
`);
insertPlantilla.run('pl_bank_natural', 'ROS Banco · Persona Natural',   'bank',       'financiero');
insertPlantilla.run('pl_bank_legal',   'ROS Banco · Persona Jurídica',  'bank',       'financiero');
insertPlantilla.run('pl_realestate',   'ROS Inmobiliaria / Promotora',  'realestate', 'no_financiero');
insertPlantilla.run('pl_casino',       'ROS Sector Casino',             'casino',     'no_financiero');
insertPlantilla.run('pl_notarios',     'ROS Sector Notarios',           'notarios',   'actividad_profesional');

// Asociación automática: vincula plantillas con sujetos obligados por tipo y sector
const linkSOPL = db.prepare(
  'INSERT OR IGNORE INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)',
);
const sujetosParaPlantilla = db.prepare<[string, string], { id: string }>(
  'SELECT id FROM sujeto_obligado WHERE tipo = ? AND sector = ?',
);
const todasPlantillas = db.prepare<[], { id: string; tipo_sujeto_obligado: string; sector: string | null }>(
  'SELECT id, tipo_sujeto_obligado, sector FROM plantilla_ros',
).all();
for (const pl of todasPlantillas) {
  if (!pl.sector) continue;
  const sujetos = sujetosParaPlantilla.all(pl.tipo_sujeto_obligado, pl.sector);
  for (const s of sujetos) linkSOPL.run(s.id, pl.id);
}

const insertDocReq = db.prepare(`
  INSERT INTO documento_requerido (id, plantilla_id, nombre, tipo_requerimiento, obligatorio, orden)
  VALUES (?, ?, ?, ?, ?, ?)
`);

type DocEntry = string | { nombre: string; tipo: 'requerido' | 'condicional' | 'opcional' };

const bankNatural: DocEntry[] = [
  // REQUERIDOS — base KYC y sustento del ROS, bloquean el envío
  { nombre: 'Documentos de Apertura de la Cuenta',                                       tipo: 'requerido' },
  { nombre: 'Contrato de Servicios Bancarios',                                            tipo: 'requerido' },
  { nombre: 'Documento de identidad personal (Cédula y/o pasaporte)',                     tipo: 'requerido' },
  { nombre: 'Debida Diligencia del Cliente incluyendo actualizaciones',                   tipo: 'requerido' },
  { nombre: 'Perfil Transaccional del cliente',                                           tipo: 'requerido' },
  { nombre: 'Perfil de Ingresos y Egresos declarados',                                   tipo: 'requerido' },
  { nombre: 'Comunicaciones internas y externas para descartar hechos inusuales',         tipo: 'requerido' },
  { nombre: 'Comunicaciones enviadas y recibidas sobre gestiones de descarte',            tipo: 'requerido' },
  // CONDICIONALES — dependen del perfil del cliente, generan advertencia si faltan
  { nombre: 'Tarjeta de Firmas (si aplica según tipo de cuenta)',                         tipo: 'condicional' },
  { nombre: 'Constancia de Ingresos (Declaraciones, Ficha o Talonario de Cheque)',       tipo: 'condicional' },
  { nombre: 'Carta de Trabajo (si el cliente es empleado)',                               tipo: 'condicional' },
  { nombre: 'Historial de Crédito (si tiene productos crediticios)',                      tipo: 'condicional' },
  // OPCIONALES — complementarios, no generan bloqueo ni advertencia
  { nombre: 'Referencias Bancarias',                                                      tipo: 'opcional' },
  { nombre: 'Referencias Comerciales y/o Profesionales',                                  tipo: 'opcional' },
];

const bankLegal: DocEntry[] = [
  // REQUERIDOS — base KYC corporativo y sustento del ROS, bloquean el envío
  { nombre: 'Contrato de los Servicios Bancarios',                                                                           tipo: 'requerido' },
  { nombre: 'Documentos de Apertura',                                                                                        tipo: 'requerido' },
  { nombre: 'Identificación del Representante Legal, Dignatarios, Directores, Apoderados, Accionistas y Beneficiarios Finales', tipo: 'requerido' },
  { nombre: 'Debida Diligencia de personas vinculadas a la Persona Jurídica',                                                tipo: 'requerido' },
  { nombre: 'Perfiles de Ingresos y Egresos transaccionales',                                                                tipo: 'requerido' },
  { nombre: 'Pacto social o documento constitutivo, poderes, etc.',                                                          tipo: 'requerido' },
  { nombre: 'Aviso de Operación o documento equivalente a Licencia Comercial',                                               tipo: 'requerido' },
  { nombre: 'Declaraciones de Rentas obtenidas desde la apertura de la relación',                                            tipo: 'requerido' },
  { nombre: 'Dignatarios y Directores de la Persona Jurídica y actualizaciones',                                             tipo: 'requerido' },
  { nombre: 'Estados Financieros de la persona jurídica',                                                                    tipo: 'requerido' },
  { nombre: 'Información obtenida sobre Beneficiarios Finales',                                                              tipo: 'requerido' },
  { nombre: 'Identificación de Beneficiarios Finales',                                                                       tipo: 'requerido' },
  { nombre: 'Comunicaciones de descarte de la inusualidad',                                                                  tipo: 'requerido' },
  { nombre: 'Estado de cuenta de los 2 últimos años en PDF y Excel',                                                         tipo: 'requerido' },
  { nombre: 'Volante de depósitos y retiros de cuenta',                                                                      tipo: 'requerido' },
  // CONDICIONALES — dependen del tipo de operación sospechosa, generan advertencia si faltan
  { nombre: 'Historial de Crédito (si tiene productos crediticios)',                                                         tipo: 'condicional' },
  { nombre: 'Información sobre titular de acciones emitidas y custodios (si aplica)',                                        tipo: 'condicional' },
  { nombre: 'Evidencia de acciones emitidas, tenedores y/o custodios (si aplica)',                                           tipo: 'condicional' },
  { nombre: '80% de los Créditos recibidos durante el último año (si aplica)',                                               tipo: 'condicional' },
  { nombre: '80% de los Débitos realizados durante el último año (si aplica)',                                               tipo: 'condicional' },
  { nombre: 'Copia de cheques con anversos y reversos (si hubo cheques involucrados)',                                       tipo: 'condicional' },
  { nombre: 'Copia completa de transferencias internacionales (mensaje Swift)',                                               tipo: 'condicional' },
  { nombre: 'Datos de ACH enviados y/o recibidos (si hay movimientos ACH)',                                                  tipo: 'condicional' },
  // OPCIONALES — complementarios, no generan bloqueo ni advertencia
  { nombre: 'Referencias Bancarias',                                                                                         tipo: 'opcional' },
  { nombre: 'Referencias Comerciales y/o Profesionales',                                                                     tipo: 'opcional' },
];

const casino: DocEntry[] = [
  // SUSTENTO DOCUMENTAL
  { nombre: 'Identificación personal y/o pasaporte de los clientes',                                                                           tipo: 'requerido' },
  { nombre: 'Debida Diligencia realizada al cliente',                                                                                          tipo: 'requerido' },
  { nombre: 'Información obtenida en cuanto a la procedencia y origen de los fondos que permiten un alto nivel de juego en monto y frecuencia', tipo: 'requerido' },
  // SUSTENTO OPERACIONAL
  { nombre: 'Detalle de las fichas canjeadas y premios cobrados',                                                                              tipo: 'requerido' },
  { nombre: 'Montos invertidos en los juegos, fecha del juego, frecuencia y locación',                                                         tipo: 'requerido' },
];

const notarios: DocEntry[] = [
  // SUSTENTOS DOCUMENTALES
  { nombre: 'Identidad personal — Cédula y/o Pasaporte de los actores',                                                                        tipo: 'requerido' },
  { nombre: 'Debida Diligencia realizada al cliente',                                                                                          tipo: 'requerido' },
  { nombre: 'Contratos suscritos o firmados entre las partes objeto del reporte',                                                              tipo: 'requerido' },
  { nombre: 'Copias de las Escrituras públicas protocolizadas',                                                                                tipo: 'requerido' },
  { nombre: 'Documentación y comunicaciones tendientes a verificar el trámite que se pretende realizar (Compra Venta)',                         tipo: 'requerido' },
  { nombre: 'Forma de pago de los gastos notariales (Efectivo, Cheque, Tarjeta de Crédito o Débito, ACH, Transferencia Bancaria)',             tipo: 'requerido' },
  // SUSTENTOS OPERACIONALES
  { nombre: 'Sustento de los pagos realizados',                                                                                                tipo: 'requerido' },
  { nombre: 'Cheque (anverso y reverso)',                                                                                                      tipo: 'condicional' },
  { nombre: 'Recibo de pagos realizados por los servicios recibidos',                                                                         tipo: 'requerido' },
];

const realEstate: DocEntry[] = [
  // REQUERIDOS — bloquean el envío si no se adjuntan
  { nombre: 'Contrato de Promesa de Compra Venta',                        tipo: 'requerido' },
  { nombre: 'Debida Diligencia del Cliente Comprador',                     tipo: 'requerido' },
  { nombre: 'Identificación personal y/o pasaporte del Comprador',         tipo: 'requerido' },
  { nombre: 'Perfil transaccional del comprador',                          tipo: 'requerido' },
  { nombre: 'Detalle del bien objeto del contrato',                        tipo: 'requerido' },
  { nombre: 'Forma de pago del Bien Inmueble',                             tipo: 'requerido' },
  { nombre: 'Sustento de procedencia de fondos',                           tipo: 'requerido' },
  // CONDICIONALES — generan advertencia si faltan, pero no bloquean
  { nombre: 'Carta de Trabajo (persona natural con empleo)',               tipo: 'condicional' },
  { nombre: 'Ficha/Declaración de Renta (persona natural)',                tipo: 'condicional' },
  { nombre: 'Escritura Pública (si ya fue firmada)',                       tipo: 'condicional' },
  { nombre: 'Financiamiento bancario (si hay préstamo)',                   tipo: 'condicional' },
  { nombre: 'Avalúos (si hay financiamiento)',                             tipo: 'condicional' },
  { nombre: 'Recibo abono inicial (si hubo abono)',                        tipo: 'condicional' },
  { nombre: 'Recibos pagos parciales (si hay pagos parciales)',            tipo: 'condicional' },
  { nombre: 'Sustento cheques/ACH/transferencias (si aplica)',             tipo: 'condicional' },
  // OPCIONALES — complementarios, no generan bloqueo ni advertencia
  { nombre: 'Referencias Bancarias',                                       tipo: 'opcional' },
  { nombre: 'Referencias Comerciales',                                     tipo: 'opcional' },
];

function seedDocs(plantillaId: string, lista: DocEntry[], prefix: string) {
  lista.forEach((entry, i) => {
    const nombre      = typeof entry === 'string' ? entry : entry.nombre;
    const tipo        = typeof entry === 'string' ? 'requerido' : entry.tipo;
    const obligatorio = tipo === 'requerido' ? 1 : 0;
    insertDocReq.run(`${prefix}_${i + 1}`, plantillaId, nombre, tipo, obligatorio, i + 1);
  });
}
seedDocs('pl_bank_natural', bankNatural, 'dr_bn');
seedDocs('pl_bank_legal',   bankLegal,   'dr_bl');
seedDocs('pl_realestate',   realEstate,  'dr_re');
seedDocs('pl_casino',       casino,      'dr_ca');
seedDocs('pl_notarios',     notarios,    'dr_no');

// =====================================================================
// 4. Usuarios del sistema — todos con password "password123" (bcrypt)
// =====================================================================
const hash = bcrypt.hashSync('password123', 10);
const insertUser = db.prepare(`
  INSERT INTO usuario (id, nombre, correo, password_hash, rol_id, sujeto_obligado_id, estado, mfa_activo)
  VALUES (?, ?, ?, ?, ?, ?, 'activo', 0)
`);

const usuariosDemo: Array<[string, string, string, string, string | null]> = [
  ['u_so_banco',     'Banco Nacional de Panamá · Cumplimiento', 'cumplimiento@banconacional.com.pa',    'rol_sujeto_obligado', 'so_banco_nacional'],
  ['u_so_inmob',     'Inmobiliaria Istmo · Cumplimiento',       'cumplimiento@inmobiliariaistmo.com.pa', 'rol_sujeto_obligado', 'so_inmob_istmo'],
  ['u_analista',     'Analista UAF',                            'analista@uaf.gob.pa',               'rol_analista',        null],
  ['u_supervisor',   'Supervisor UAF',                          'supervisor@uaf.gob.pa',             'rol_supervisor',      null],
  ['u_auditor',      'Auditor Interno',                         'auditor@uaf.gob.pa',                'rol_auditor',         null],
  ['u_admin',        'Administrador del Sistema',               'admin@uaf.gob.pa',                  'rol_admin',           null],
];
for (const [id, nombre, correo, rolId, soId] of usuariosDemo) {
  insertUser.run(id, nombre, correo, hash, rolId, soId);
}

// Restaura secretos MFA para no invalidar QR ya configurados en dev
if (mfaBackup.length > 0) {
  const restoreMfa = db.prepare(
    'UPDATE usuario SET mfa_secret = ?, mfa_activo = 1 WHERE id = ?',
  );
  for (const u of mfaBackup) restoreMfa.run(u.mfa_secret, u.id);
  console.log(`  • MFA restaurado para ${mfaBackup.length} usuario(s) — QR sin cambios`);
}


// =====================================================================
// 5. ROS — Datos de demostración (ROS ficticios con fines de exhibición)
// =====================================================================
function uid(): string { return randomUUID(); }
db.exec('PRAGMA foreign_keys = OFF');
const now = new Date();
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
};
const deteccion = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n - Math.floor(Math.random() * 15));
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

const insertROS = db.prepare(`
  INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id, oficial_cumplimiento, correo_oficial, fecha_deteccion, fecha_recepcion, estado, descripcion, canal_recepcion, creado_por)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertParte = db.prepare(`
  INSERT INTO parte_involucrada (id, ros_id, rol_en_operacion, tipo_persona, identificador, identificador_enmascarado, nombre_visible, datos_sensibles_bloqueados)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1)
`);
const insertOperacion = db.prepare(`
  INSERT INTO operacion_sospechosa (id, ros_id, monto, moneda, jurisdiccion, producto_servicio, tipo_operacion, senal_alerta, bien_inmueble, forma_pago)
  VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
`);
const insertDocAdjunto = db.prepare(`
  INSERT INTO documento_adjunto (id, ros_id, documento_requerido_id, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes, estado, cargado_por, fecha_carga)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertRiesgo = db.prepare(`
  INSERT INTO riesgo_caso (id, ros_id, nivel, puntaje, justificacion, clasificado_por, fecha_clasificacion)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertAsignacion = db.prepare(`
  INSERT INTO asignacion_ros (id, ros_id, analista_id, asignado_por, fecha_asignacion, activa)
  VALUES (?, ?, ?, 'u_supervisor', ?, 1)
`);
const insertCasoAnalisis = db.prepare(`
  INSERT INTO caso_analisis (id, codigo_caso, ros_id, estado, fecha_apertura)
  VALUES (?, ?, ?, 'abierto', ?)
`);
const insertSubsanacion = db.prepare(`
  INSERT INTO solicitud_subsanacion (id, ros_id, documento_adjunto_id, documento_requerido_id, motivo, estado, solicitada_por, fecha_solicitud, fecha_limite)
  VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
`);
const insertAudit = db.prepare(`
  INSERT INTO evento_auditoria (id, usuario_id, usuario_correo, rol, modulo, accion, resultado, recurso_afectado, detalle, criticidad)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Mapa de documentos requeridos por plantilla (extraído de seedDocs arriba)
const reqDocs: Record<string, string[]> = {
  pl_bank_natural: ['dr_bn_1','dr_bn_2','dr_bn_3','dr_bn_4','dr_bn_5','dr_bn_6','dr_bn_7','dr_bn_8'],
  pl_bank_legal:   ['dr_bl_1','dr_bl_2','dr_bl_3','dr_bl_4','dr_bl_5','dr_bl_6','dr_bl_7','dr_bl_8','dr_bl_9','dr_bl_10','dr_bl_11','dr_bl_12','dr_bl_13','dr_bl_14','dr_bl_15'],
  pl_realestate:   ['dr_re_1','dr_re_2','dr_re_3','dr_re_4','dr_re_5','dr_re_6','dr_re_7'],
};
const docEstado = (rosEstado: string) => rosEstado === 'riesgo_clasificado' || rosEstado === 'cerrado' ? 'validado' : 'cargado';
function fillRequiredDocs(rosId: string, plantillaId: string, rosEstado: string, creadoPor: string, fechaRef: string, overrides: Record<string, string> = {}) {
  const docs = reqDocs[plantillaId] || [];
  const defaultEstado = docEstado(rosEstado);
  for (const docId of docs) {
    const estado = overrides[docId] || defaultEstado;
    insertDocAdjunto.run(uid(), rosId, docId, `doc_${docId}.pdf`, `/var/uploads/auto/${docId}.pdf`, 'application/pdf', 100000 + Math.floor(Math.random() * 500000), estado, creadoPor, fechaRef);
  }
}

// ---- ROS-001: Banco Nacional - Transferencia internacional sospechosa (recibido) ----
const r1 = uid();
db.exec('BEGIN');
insertROS.run(r1, 'ROS-2026-000001', 'so_banco_nacional', 'pl_bank_natural',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(5), daysAgo(3), 'recibido',
  'Transferencia internacional por USD 450,000 proveniente de jurisdicción de alto riesgo (Dubái) sin justificación comercial aparente. El cliente realizó la operación desde una cuenta con perfil transaccional bajo.',
  'portal_publico', 'u_so_banco');
insertParte.run(uid(), r1, 'ordenante', 'natural', '8-987-654', '***-***-654', 'Carlos E. Martínez');
insertParte.run(uid(), r1, 'beneficiario', 'juridica', 'RUC-155789012-1-2021', '***-***-012', 'Al Nuaimi Trading FZE');
insertOperacion.run(uid(), r1, 450000, 'Dubái, EAU', 'Transferencia internacional Swift', 'transferencia_saliente', 'Transferencia a jurisdicción de alto riesgo sin relación comercial', null, 'Wire Transfer');
fillRequiredDocs(r1, 'pl_bank_natural', 'recibido', 'u_so_banco', daysAgo(3));
insertCasoAnalisis.run(uid(), r1, 'CASO-2026-000001', daysAgo(3));
insertAudit.run(uid(), 'u_so_banco', 'cumplimiento@banconacional.com.pa', 'sujeto_obligado', 'ros', 'ros_creado', 'exito', 'ROS-2026-000001', 'ROS recibido vía portal público', 'normal');
db.exec('COMMIT');

// ---- ROS-002: Banco Nacional - Depósitos fraccionados (en_analisis, asignado a analista) ----
const r2 = uid();
db.exec('BEGIN');
insertROS.run(r2, 'ROS-2026-000002', 'so_banco_nacional', 'pl_bank_natural',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(10), daysAgo(8), 'en_analisis',
  'Cliente realizó 12 depósitos en efectivo por montos inferiores a USD 10,000 en un período de 5 días hábiles, sumando USD 87,500. El patrón de fraccionamiento (smurfing) sugiere intento de evadir controles de prevención de LA/FT.',
  'portal_publico', 'u_so_banco');
fillRequiredDocs(r2, 'pl_bank_natural', 'en_analisis', 'u_so_banco', daysAgo(8));
// Asignado a analista
insertAsignacion.run(uid(), r2, 'u_analista', daysAgo(6));
insertCasoAnalisis.run(uid(), r2, 'CASO-2026-000002', daysAgo(8));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'asignacion', 'exito', 'ROS-2026-000002', 'ROS asignado a analista UAF', 'normal');
db.exec('COMMIT');

// ---- ROS-003: Banco Nacional - Cliente PEP con transacciones atípicas (riesgo_clasificado - alto) ----
const r3 = uid();
db.exec('BEGIN');
insertROS.run(r3, 'ROS-2026-000003', 'so_banco_nacional', 'pl_bank_legal',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(25), daysAgo(22), 'riesgo_clasificado',
  'Persona jurídica vinculada a Persona Expuesta Políticamente (PEP) extranjera realizó movimientos por USD 1,200,000 en los últimos 30 días, muy por encima de su perfil transaccional histórico de USD 50,000 mensuales.',
  'portal_publico', 'u_so_banco');
insertParte.run(uid(), r3, 'representante_legal', 'natural', '8-123-789', '***-***-789', 'Ricardo A. Pérez');
insertParte.run(uid(), r3, 'beneficiario_final', 'natural', 'PE-12345678', '***-***-678', null);
insertParte.run(uid(), r3, 'ordenante', 'juridica', 'RUC-155456789-2-2019', '***-***-789', 'Inversiones del Caribe S.A.');
insertOperacion.run(uid(), r3, 1200000, 'Panamá / Islas Caimán', 'Transferencias múltimas y compra de valores', 'transferencias_multiples', 'Incremento súbito de actividad en cuenta corporativa vinculada a PEP', null, 'ACH / Wire Transfer');
fillRequiredDocs(r3, 'pl_bank_legal', 'riesgo_clasificado', 'u_so_banco', daysAgo(22));
// Riesgo clasificado - ALTO
insertRiesgo.run(uid(), r3, 'alto', 92, 'Puntaje elevado: (1) PEP extranjero como beneficiario final, (2) incremento patrimonial injustificado del 2,400%, (3) operaciones hacia jurisdicción no cooperante (Islas Caimán), (4) múltiples cuentas involucradas sin justificación comercial.', 'u_supervisor', daysAgo(15));
// Asignado
insertAsignacion.run(uid(), r3, 'u_analista', daysAgo(20));
insertCasoAnalisis.run(uid(), r3, 'CASO-2026-000003', daysAgo(22));
insertAudit.run(uid(), 'u_supervisor', 'supervisor@uaf.gob.pa', 'supervisor', 'ros', 'clasificacion_riesgo', 'exito', 'ROS-2026-000003', 'Riesgo clasificado como ALTO (puntaje: 92)', 'alta');
db.exec('COMMIT');

// ---- ROS-004: Banco Nacional - Reporte mensual de operaciones (cerrado - bajo) ----
const r4 = uid();
db.exec('BEGIN');
insertROS.run(r4, 'ROS-2026-000004', 'so_banco_nacional', 'pl_bank_natural',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(45), daysAgo(40), 'cerrado',
  'Reporte rutinario de operación que inicialmente parecía inusual: cliente recibió USD 15,000 mediante transferencia internacional. Verificado el origen (herencia familiar) y la documentación presentada, se descartó la sospecha.',
  'portal_publico', 'u_so_banco');
insertParte.run(uid(), r4, 'beneficiario', 'natural', '8-555-123', '***-***-123', 'Ana L. Castillo');
insertParte.run(uid(), r4, 'ordenante', 'natural', '8-555-456', '***-***-456', 'Jorge A. Castillo');
insertOperacion.run(uid(), r4, 15000, 'España', 'Transferencia internacional recibida', 'transferencia_entrante', 'Transferencia del exterior no habitual en cuenta de bajo movimiento', null, 'Wire Transfer');
insertRiesgo.run(uid(), r4, 'bajo', 15, 'Operación justificada: herencia familiar documentada mediante acta notarial y declaración jurada. Origen de fondos lícito. No hay señales adicionales de alerta.', 'u_analista', daysAgo(30));
insertAsignacion.run(uid(), r4, 'u_analista', daysAgo(38));
insertCasoAnalisis.run(uid(), r4, 'CASO-2026-000004', daysAgo(40));
fillRequiredDocs(r4, 'pl_bank_natural', 'cerrado', 'u_so_banco', daysAgo(40));
// Cerrar el caso
db.prepare("UPDATE ros SET estado = 'cerrado' WHERE id = ?").run(r4);
db.prepare("UPDATE caso_analisis SET estado = 'cerrado', fecha_cierre = ? WHERE ros_id = ?").run(daysAgo(25), r4);
insertAudit.run(uid(), 'u_supervisor', 'supervisor@uaf.gob.pa', 'supervisor', 'ros', 'cierre_caso', 'exito', 'ROS-2026-000004', 'Caso cerrado: riesgo BAJO, operación justificada', 'normal');
db.exec('COMMIT');

// ---- ROS-005: Banco Nacional - Subsanación pendiente (subsanacion) ----
const r5 = uid();
db.exec('BEGIN');
insertROS.run(r5, 'ROS-2026-000005', 'so_banco_nacional', 'pl_bank_legal',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(18), daysAgo(15), 'subsanacion',
  'Persona jurídica realizó préstamo prendario por USD 350,000 utilizando como garantía vehículos de lujo importados. Los documentos de importación y propiedad presentan inconsistencias que requieren subsanación.',
  'portal_publico', 'u_so_banco');
insertParte.run(uid(), r5, 'representante_legal', 'natural', '8-777-888', '***-***-888', 'Fernando J. Quintero');
insertParte.run(uid(), r5, 'ordenante', 'juridica', 'RUC-155333444-1-2022', '***-***-444', 'Autoimport S.A.');
insertOperacion.run(uid(), r5, 350000, 'Panamá / Japón (importación)', 'Préstamo prendario sobre vehículos', 'prestamo_garantia', 'Inconsistencias en documentos de importación de vehículos de lujo', null, 'Cheque certificado');
fillRequiredDocs(r5, 'pl_bank_legal', 'subsanacion', 'u_so_banco', daysAgo(15), { dr_bl_11: 'observado', dr_bl_14: 'observado' });
// Solicitud de subsanación pendiente (por los documentos observados)
const subsId5 = uid();
const docReqSubs5 = 'dr_bl_11';
insertSubsanacion.run(uid(), r5, null, docReqSubs5,
  'Los estados financieros presentados (2025) no incluyen las notas explicativas ni la firma del contador público autorizado. Favor subsanar con documento completo.',
  'u_analista', daysAgo(10), daysAgo(3));
insertAsignacion.run(uid(), r5, 'u_analista', daysAgo(13));
insertCasoAnalisis.run(uid(), r5, 'CASO-2026-000005', daysAgo(15));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'solicitud_subsanacion', 'exito', 'ROS-2026-000005', 'Solicitud de subsanación enviada: estados financieros incompletos', 'normal');
db.exec('COMMIT');

// ---- ROS-006: Inmobiliaria Istmo - Compra con fondos no declarados (recibido) ----
const r6 = uid();
db.exec('BEGIN');
insertROS.run(r6, 'ROS-2026-000006', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(4), daysAgo(2), 'recibido',
  'Comprador adquiere propiedad valorada en USD 850,000 en el sector de Punta Pacífica. Declara ingresos mensuales de USD 3,500 y no presenta sustentos de financiamiento externo. La forma de pago incluye USD 300,000 en efectivo.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r6, 'comprador', 'natural', '8-234-567', '***-***-567', 'José A. Delgado');
insertParte.run(uid(), r6, 'vendedor', 'juridica', 'RUC-155888999-1-2015', '***-***-999', 'Desarrollos Pacífico S.A.');
insertOperacion.run(uid(), r6, 850000, 'Panamá', 'Compraventa de bien inmueble residencial', 'compra_inmueble', 'Disparidad entre ingresos declarados y monto de la operación. Pago parcial en efectivo.',
  'Apartamento PH, Torre Oceanic, Punta Pacífica, 280m², 3 estacionamientos', 'Efectivo USD 300,000 + Cheque de gerencia USD 550,000');
fillRequiredDocs(r6, 'pl_realestate', 'recibido', 'u_so_inmob', daysAgo(2));
insertCasoAnalisis.run(uid(), r6, 'CASO-2026-000006', daysAgo(2));
insertAudit.run(uid(), 'u_so_inmob', 'cumplimiento@inmobiliariaistmo.com.pa', 'sujeto_obligado', 'ros', 'ros_creado', 'exito', 'ROS-2026-000006', 'ROS recibido vía portal público', 'normal');
db.exec('COMMIT');

// ---- ROS-007: Inmobiliaria Istmo - Venta rápida de propiedades (en_analisis) ----
const r7 = uid();
db.exec('BEGIN');
insertROS.run(r7, 'ROS-2026-000007', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(14), daysAgo(12), 'en_analisis',
  'Mismo vendedor (persona natural) coloca 3 propiedades en venta en un lapso de 60 días, todas recibiendo ofertas en efectivo por montos cercanos al valor de avalúo. Total de operaciones: USD 620,000.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r7, 'comprador', 'natural', '8-111-222', '***-***-222', 'Luis E. Montenegro');
insertParte.run(uid(), r7, 'comprador', 'natural', '8-333-444', '***-***-444', 'Carmen R. de León');
insertParte.run(uid(), r7, 'vendedor', 'natural', '8-555-666', '***-***-666', 'Alberto J. Navarro');
insertOperacion.run(uid(), r7, 620000, 'Panamá', 'Compraventa múltiple de bienes inmuebles', 'venta_multiple', 'Venta acelerada de múltiples propiedades por el mismo vendedor en periodo corto',
  '3 propiedades: Casa San Francisco (USD 210,000), Apto Costa del Este (USD 280,000), Local comercial Calle 50 (USD 130,000)', 'Efectivo / Cheque de gerencia');
fillRequiredDocs(r7, 'pl_realestate', 'en_analisis', 'u_so_inmob', daysAgo(12));
// Asignado
insertAsignacion.run(uid(), r7, 'u_analista', daysAgo(10));
insertCasoAnalisis.run(uid(), r7, 'CASO-2026-000007', daysAgo(12));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'asignacion', 'exito', 'ROS-2026-000007', 'ROS asignado a analista UAF', 'normal');
db.exec('COMMIT');

// ---- ROS-008: Inmobiliaria Istmo - Revisión documental ----
const r8 = uid();
db.exec('BEGIN');
insertROS.run(r8, 'ROS-2026-000008', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(20), daysAgo(17), 'revision_documental',
  'Compra de lote comercial por USD 175,000. El comprador presenta identificación vencida y el contrato de promesa de compraventa no está autenticado. Los documentos de debida diligencia están incompletos.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r8, 'comprador', 'natural', '8-999-000', '***-***-000', 'Héctor M. Ríos');
insertParte.run(uid(), r8, 'vendedor', 'natural', '8-777-111', '***-***-111', 'Sociedad Inversora del Istmo');
insertOperacion.run(uid(), r8, 175000, 'Panamá', 'Compraventa de lote comercial', 'compra_inmueble', 'Documentación incompleta e identificación vencida del comprador',
  'Lote comercial 500m², Vía España, frente a Multicentro', 'Cheque de gerencia');
fillRequiredDocs(r8, 'pl_realestate', 'revision_documental', 'u_so_inmob', daysAgo(17), { dr_re_1: 'observado', dr_re_3: 'observado' });
insertAsignacion.run(uid(), r8, 'u_analista', daysAgo(15));
insertCasoAnalisis.run(uid(), r8, 'CASO-2026-000008', daysAgo(17));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'revision_documental', 'exito', 'ROS-2026-000008', 'Documentos en revisión: identificación vencida y contrato no autenticado', 'normal');
db.exec('COMMIT');

// ---- ROS-009: Inmobiliaria Istmo - Múltiples compras en efectivo (riesgo_clasificado - medio) ----
const r9 = uid();
db.exec('BEGIN');
insertROS.run(r9, 'ROS-2026-000009', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(35), daysAgo(30), 'riesgo_clasificado',
  'Comprador adquiere 2 apartamentos en proyecto de lujo por USD 95,000 cada uno, pagando ambos en efectivo. No tiene historial crediticio ni relación bancaria previa en Panamá.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r9, 'comprador', 'natural', 'E-12345678', '***-***-678', 'David S. Cohen');
insertOperacion.run(uid(), r9, 95000, 'Panamá / Extranjero', 'Compraventa de apartamentos', 'compra_inmueble', 'Comprador extranjero sin historial bancario local, pago total en efectivo por 2 unidades',
  '2 apartamentos Torres del Mar, 80m² c/u, Playa Bonita', 'Efectivo');
fillRequiredDocs(r9, 'pl_realestate', 'riesgo_clasificado', 'u_so_inmob', daysAgo(30));
insertRiesgo.run(uid(), r9, 'medio', 58, 'Riesgo medio: (1) comprador extranjero sin referencias bancarias locales, (2) pago en efectivo por montos significativos, (3) múltiples unidades adquiridas simultáneamente. No se identificaron vínculos PEP ni listas restrictivas.', 'u_analista', daysAgo(20));
insertAsignacion.run(uid(), r9, 'u_analista', daysAgo(28));
insertCasoAnalisis.run(uid(), r9, 'CASO-2026-000009', daysAgo(30));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'clasificacion_riesgo', 'exito', 'ROS-2026-000009', 'Riesgo clasificado como MEDIO (puntaje: 58)', 'normal');
db.exec('COMMIT');

// ---- ROS-010: Inmobiliaria Istmo - Investigación externa (cerrado - alto) ----
const r10 = uid();
db.exec('BEGIN');
insertROS.run(r10, 'ROS-2026-000010', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(60), daysAgo(55), 'cerrado',
  'Venta de terreno de alto valor (USD 2,100,000) a sociedad offshore constituida en paraíso fiscal. La operación fue derivada a la Fiscalía Especializada contra el Lavado de Dinero por posible vinculación con organización de tráfico internacional.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r10, 'comprador', 'juridica', 'OFFSHORE-BVI-8842', '***-***-842', 'Sunset Holdings BVI Ltd');
insertParte.run(uid(), r10, 'vendedor', 'natural', '8-123-456', '***-***-456', 'Inversiones Panamá Properties');
insertOperacion.run(uid(), r10, 2100000, 'Panamá / Islas Vírgenes Británicas', 'Venta de terreno urbano premium', 'venta_inmueble', 'Comprador offshore sin presencia real, monto excepcionalmente alto para el sector, posible vinculación con actividades ilícitas',
  'Terreno 5,000m², Calle 50, zona bancaria', 'Transferencia internacional');
fillRequiredDocs(r10, 'pl_realestate', 'cerrado', 'u_so_inmob', daysAgo(55));
insertRiesgo.run(uid(), r10, 'alto', 95, 'Riesgo crítico: (1) sociedad offshore en BVI sin actividad comercial conocida, (2) monto extraordinario USD 2.1M, (3) posible vinculación con OCLAEDF según nota de inteligencia financiera, (4) caso derivado a Fiscalía.', 'u_supervisor', daysAgo(40));
insertAsignacion.run(uid(), r10, 'u_analista', daysAgo(53));
insertCasoAnalisis.run(uid(), r10, 'CASO-2026-000010', daysAgo(55));
// Cerrado por derivación externa
db.prepare("UPDATE ros SET estado = 'cerrado' WHERE id = ?").run(r10);
db.prepare("UPDATE caso_analisis SET estado = 'cerrado', fecha_cierre = ? WHERE ros_id = ?").run(daysAgo(30), r10);
insertAudit.run(uid(), 'u_supervisor', 'supervisor@uaf.gob.pa', 'supervisor', 'ros', 'cierre_caso', 'exito', 'ROS-2026-000010', 'Caso cerrado: derivado a Fiscalía Especializada contra el Lavado de Dinero', 'critica');
db.exec('COMMIT');

// ---- ROS-011: Inmobiliaria Istmo - En revisión de vínculo ----
const r11 = uid();
db.exec('BEGIN');
insertROS.run(r11, 'ROS-2026-000011', 'so_inmob_istmo', 'pl_realestate',
  'Lic. Patricia Vásquez', 'cumplimiento@inmobiliariaistmo.com.pa',
  deteccion(7), daysAgo(5), 'en_revision_vinculo',
  'El comprador de esta propiedad (USD 430,000) aparece como beneficiario final en otro ROS registrado por Banco Nacional (ROS-2026-000003). Se requiere determinar si existe vinculación intersectorial.',
  'portal_publico', 'u_so_inmob');
insertParte.run(uid(), r11, 'comprador', 'natural', 'PE-12345678', '***-***-678', null); // Mismo PEP que ROS-003
insertParte.run(uid(), r11, 'vendedor', 'juridica', 'RUC-155222333-1-2018', '***-***-333', 'Bienes Raíces del Pacífico S.A.');
insertOperacion.run(uid(), r11, 430000, 'Panamá', 'Compraventa de propiedad vacacional', 'compra_inmueble', 'Comprador vinculado a PEP extranjero identificado en ROS-2026-000003',
  'Casa vacacional 150m², Playa Blanca, Coclé', 'Transferencia bancaria');
fillRequiredDocs(r11, 'pl_realestate', 'en_revision_vinculo', 'u_so_inmob', daysAgo(5));
insertAsignacion.run(uid(), r11, 'u_analista', daysAgo(3));
insertCasoAnalisis.run(uid(), r11, 'CASO-2026-000011', daysAgo(5));
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'vinculos', 'vinculo_detectado', 'exito', 'ROS-2026-000011', 'Vínculo potencial detectado con ROS-2026-000003 (mismo PEP como beneficiario final)', 'alta');
db.exec('COMMIT');

// ---- ROS-012: Banco Nacional - Subsanación vencida ----
const r12 = uid();
db.exec('BEGIN');
insertROS.run(r12, 'ROS-2026-000012', 'so_banco_nacional', 'pl_bank_natural',
  'Lic. Roberto Mendoza', 'cumplimiento@banconacional.com.pa',
  deteccion(30), daysAgo(28), 'subsanacion',
  'Cliente realizó retiros significativos en ventanilla por un total de USD 67,000 durante 3 días consecutivos, superando el umbral de reporte. Se requiere documentación de origen de fondos.',
  'portal_publico', 'u_so_banco');
insertParte.run(uid(), r12, 'ordenante', 'natural', '8-345-678', '***-***-678', 'Rosa M. Sandoval');
insertOperacion.run(uid(), r12, 67000, 'Panamá', 'Retiros en ventanilla', 'retiro_fraccionado',   'Retiros múltiples en ventanilla por montos elevados en periodo corto', null, 'Efectivo');
fillRequiredDocs(r12, 'pl_bank_natural', 'subsanacion', 'u_so_banco', daysAgo(28));
insertSubsanacion.run(uid(), r12, null, 'dr_bn_6',
  'Favor presentar documentos que sustenten el origen de los fondos retirados: certificación de ingresos, declaración de renta del último periodo, y/o constancia de venta de bienes.',
  'u_analista', daysAgo(25), daysAgo(10));
insertAsignacion.run(uid(), r12, 'u_analista', daysAgo(26));
insertCasoAnalisis.run(uid(), r12, 'CASO-2026-000012', daysAgo(28));
db.exec('COMMIT');
db.exec('PRAGMA foreign_keys = ON');

// =====================================================================
// 6. Eventos de auditoría adicionales — registro de actividad
// =====================================================================
// Eventos del sistema
insertAudit.run(uid(), null, 'system', 'system', 'system', 'seed_inicial', 'exito', null, 'Datos iniciales cargados al iniciar el sistema (incluye 12 ROS demo)', 'normal');

// Eventos de usuarios UAF
insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'ros', 'consulta_listado', 'exito', null, 'Analista consultó listado completo de ROS', 'normal');

insertAudit.run(uid(), 'u_supervisor', 'supervisor@uaf.gob.pa', 'supervisor', 'reportes', 'reporte_generado', 'exito', null, 'Reporte trimestral de operaciones sospechosas generado (Q1 2026)', 'alta');

insertAudit.run(uid(), 'u_auditor', 'auditor@uaf.gob.pa', 'auditor', 'auditoria', 'consulta_log', 'exito', null, 'Auditor consultó el log completo de auditoría', 'normal');

insertAudit.run(uid(), 'u_admin', 'admin@uaf.gob.pa', 'admin', 'admin', 'usuario_creado', 'exito', 'u_analista2', 'Nuevo usuario analista creado: "Analista UAF 2" con correo analista2@uaf.gob.pa', 'normal');

insertAudit.run(uid(), 'u_analista', 'analista@uaf.gob.pa', 'analista', 'vinculos', 'vinculo_confirmado', 'exito', 'ROS-2026-000011', 'Vínculo intersectorial confirmado entre ROS-2026-000011 e Inversiones del Caribe S.A.', 'alta');

console.log(`[SAGAF] Seed completo:`);
console.log(`  • ${roles.length} roles, ${permisos.length} permisos`);
console.log(`  • 2 sujetos obligados, 5 plantillas ROS (banco x2, inmobiliaria, casino, notarios)`);
console.log(`  • ${bankNatural.length + bankLegal.length + realEstate.length + casino.length + notarios.length} documentos requeridos`);
console.log(`  • ${usuariosDemo.length} usuarios`);
console.log(`  • 12 ROS demo:`);
console.log(`    - Banco Nacional: ROS-001 (recibido), ROS-002 (en_analisis), ROS-003 (riesgo_clasificado-alto), ROS-004 (cerrado-bajo), ROS-005 (subsanacion), ROS-012 (subsanacion)`);
console.log(`    - Inmobiliaria Istmo: ROS-006 (recibido), ROS-007 (en_analisis), ROS-008 (revision_documental), ROS-009 (riesgo_clasificado-medio), ROS-010 (cerrado-alto), ROS-011 (en_revision_vinculo)`);
console.log(`  • 2 solicitudes de subsanación (2 pendientes)`);
console.log(`[SAGAF] Credenciales: password123 (todos los usuarios)`);

db.close();
