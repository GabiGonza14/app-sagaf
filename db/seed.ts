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
db.exec('BEGIN');
// Deshabilita triggers de inmutabilidad temporalmente para la limpieza del seed
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_update');
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_delete');
for (const t of tables) db.exec(`DELETE FROM ${t}`);
db.exec('COMMIT');
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

const linkSOPL = db.prepare(
  'INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)',
);
linkSOPL.run('so_banco_nacional', 'pl_bank_natural');
linkSOPL.run('so_banco_nacional', 'pl_bank_legal');
linkSOPL.run('so_inmob_istmo', 'pl_realestate');

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
  // CONDICIONALES — dependen del tipo de operación sospechosa, generan advertencia si faltan
  { nombre: 'Historial de Crédito (si tiene productos crediticios)',                                                         tipo: 'condicional' },
  { nombre: 'Información sobre titular de acciones emitidas y custodios (si aplica)',                                        tipo: 'condicional' },
  { nombre: 'Evidencia de acciones emitidas, tenedores y/o custodios (si aplica)',                                           tipo: 'condicional' },
  { nombre: '80% de los Créditos recibidos durante el último año (si aplica)',                                               tipo: 'condicional' },
  { nombre: '80% de los Débitos realizados durante el último año (si aplica)',                                               tipo: 'condicional' },
  { nombre: 'Copia de cheques con anversos y reversos (si hubo cheques involucrados)',                                       tipo: 'condicional' },
  { nombre: 'Copia completa de transferencias internacionales (mensaje Swift)',                                               tipo: 'condicional' },
  { nombre: 'Datos de ACH enviados y/o recibidos (si hay movimientos ACH)',                                                  tipo: 'condicional' },
  { nombre: 'Volante de depósitos y retiros de cuenta',                                                                      tipo: 'requerido' },
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
// 5. ROS — SIN PRECARGA (la BD arranca sin ningún ROS)
// =====================================================================
// Por diseño, el seed NO inserta ROS demo: los reportes se registran
// manualmente desde el portal autenticado (CU-01). Solo se cargan los
// datos fundamentales (roles, permisos, sujetos obligados, plantillas,
// documentos requeridos y usuarios) necesarios para operar el sistema.

// =====================================================================
// 6. Eventos de auditoría — semilla del log
// =====================================================================
function uid(): string { return randomUUID(); }

const insertAudit = db.prepare(`
  INSERT INTO evento_auditoria
    (id, usuario_id, usuario_correo, rol, modulo, accion, resultado, recurso_afectado, detalle, criticidad)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertAudit.run(uid(), null, 'system', 'system', 'system', 'seed_inicial', 'exito', null, 'Datos iniciales cargados al iniciar el sistema', 'normal');

console.log(`[SAGAF] Seed completo:`);
console.log(`  • ${roles.length} roles, ${permisos.length} permisos`);
console.log(`  • 2 sujetos obligados, 5 plantillas ROS (banco x2, inmobiliaria, casino, notarios)`);
console.log(`  • ${bankNatural.length + bankLegal.length + realEstate.length + casino.length + notarios.length} documentos requeridos`);
console.log(`  • ${usuariosDemo.length} usuarios`);
console.log(`  • 0 ROS — la BD arranca sin ROS; se registran manualmente (CU-01)`);
console.log(`[SAGAF] Credenciales: password123 (todos los usuarios)`);

db.close();
