// e2e/setup-test-db.ts — Inicializa la DB de prueba para E2E
import Database from 'better-sqlite3';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const dbPath = process.env.DB_PATH || './db/sagaf.test.db';
const totpSecret = process.env.E2E_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

if (existsSync(dbPath)) unlinkSync(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(resolve('db/schema.sql'), 'utf-8');
db.exec(schema);

// DROP triggers for seeding
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_update');
db.exec('DROP TRIGGER IF EXISTS evento_auditoria_no_delete');

// Roles
const roles: [string, string, string][] = [
  ['rol_sujeto_obligado', 'sujeto_obligado', 'Sujeto obligado'],
  ['rol_analista', 'analista', 'Analista UAF'],
  ['rol_supervisor', 'supervisor', 'Supervisor UAF'],
  ['rol_auditor', 'auditor', 'Auditor interno'],
  ['rol_admin', 'admin', 'Administrador'],
];
for (const [id, nombre, desc] of roles) {
  db.prepare('INSERT OR IGNORE INTO rol (id, nombre, descripcion) VALUES (?,?,?)').run(id, nombre, desc);
}

// Permisos
const permisos: [string, string, string, string][] = [
  ['p_ros_create', 'ros:create', 'ros', 'Registrar ROS'],
  ['p_ros_read_own', 'ros:read_own', 'ros', 'Consultar ROS propios'],
  ['p_ros_read_all', 'ros:read_all', 'ros', 'Consultar todos los ROS'],
  ['p_ros_classify', 'ros:classify', 'ros', 'Clasificar riesgo'],
  ['p_ros_close', 'ros:close', 'ros', 'Cerrar caso'],
  ['p_doc_upload', 'doc:upload', 'documentos', 'Cargar documentos'],
  ['p_doc_validate', 'doc:validate', 'documentos', 'Validar/observar documentos'],
  ['p_subsanacion', 'subsanacion', 'documentos', 'Solicitar/atender subsanación'],
  ['p_reporte_gen', 'reporte:generar', 'reportes', 'Generar reportes'],
  ['p_reporte_export', 'reporte:exportar', 'reportes', 'Exportar reportes'],
  ['p_usuario_admin', 'usuario:admin', 'admin', 'Gestionar usuarios y roles'],
  ['p_sujeto_admin', 'sujeto:admin', 'admin', 'Gestionar sujetos obligados'],
  ['p_audit_read', 'audit:read', 'auditoria', 'Consultar log de auditoría'],
  ['p_vinculo', 'vinculo', 'vinculos', 'Confirmar vinculaciones'],
];
for (const p of permisos) {
  db.prepare('INSERT OR IGNORE INTO permiso (id, codigo, modulo, accion) VALUES (?,?,?,?)').run(...p);
}

const rolPermisoMap: Record<string, string[]> = {
  rol_sujeto_obligado: ['p_ros_create', 'p_ros_read_own', 'p_doc_upload'],
  rol_analista: ['p_ros_read_all', 'p_ros_classify', 'p_doc_validate', 'p_subsanacion', 'p_vinculo', 'p_reporte_gen', 'p_audit_read'],
  rol_supervisor: ['p_ros_read_all', 'p_ros_classify', 'p_ros_close', 'p_doc_validate', 'p_subsanacion', 'p_vinculo', 'p_reporte_gen', 'p_reporte_export', 'p_audit_read'],
  rol_auditor: ['p_audit_read'],
  rol_admin: ['p_usuario_admin', 'p_sujeto_admin', 'p_audit_read'],
};
for (const [rol, perms] of Object.entries(rolPermisoMap)) {
  for (const p of perms) db.prepare('INSERT OR IGNORE INTO rol_permiso (rol_id, permiso_id) VALUES (?,?)').run(rol, p);
}

// Sujetos obligados
const so1 = randomUUID();
const so2 = randomUUID();
db.prepare(`INSERT INTO sujeto_obligado (id, nombre, ruc, tipo, sector, organismo_supervisor, estado) VALUES (?,?,?,?,?,?,?)`)
  .run(so1, 'Banco Nacional de Panamá', 'RUC-123456', 'bank', 'Bancario', 'Superintendencia de Bancos', 'activo');
db.prepare(`INSERT INTO sujeto_obligado (id, nombre, ruc, tipo, sector, organismo_supervisor, estado) VALUES (?,?,?,?,?,?,?)`)
  .run(so2, 'Inmobiliaria Istmo', 'RUC-789012', 'realestate', 'Inmobiliario', 'MIVIOT', 'activo');

// Plantillas
const pl1 = randomUUID();
const pl2 = randomUUID();
db.prepare(`INSERT INTO plantilla_ros (id, nombre, version, tipo_sujeto_obligado, activa) VALUES (?,?,?,?,?)`)
  .run(pl1, 'Plantilla Banco Persona Natural', '1.0', 'bank', 1);
db.prepare(`INSERT INTO plantilla_ros (id, nombre, version, tipo_sujeto_obligado, activa) VALUES (?,?,?,?,?)`)
  .run(pl2, 'Plantilla Inmobiliaria', '1.0', 'realestate', 1);
db.prepare(`INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?,?)`).run(so1, pl1);
db.prepare(`INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?,?)`).run(so2, pl2);

// Documentos requeridos
db.prepare(`INSERT INTO documento_requerido (id, plantilla_id, nombre, orden, tipo_requerimiento) VALUES (?,?,?,?,?)`)
  .run(randomUUID(), pl1, 'Formulario de Declaración de Origen de Fondos', 1, 'obligatorio');
db.prepare(`INSERT INTO documento_requerido (id, plantilla_id, nombre, orden, tipo_requerimiento) VALUES (?,?,?,?,?)`)
  .run(randomUUID(), pl1, 'Copia de cédula del ordenante', 2, 'obligatorio');
db.prepare(`INSERT INTO documento_requerido (id, plantilla_id, nombre, orden, tipo_requerimiento) VALUES (?,?,?,?,?)`)
  .run(randomUUID(), pl1, 'Estado de cuenta bancaria', 3, 'obligatorio');
db.prepare(`INSERT INTO documento_requerido (id, plantilla_id, nombre, orden, tipo_requerimiento) VALUES (?,?,?,?,?)`)
  .run(randomUUID(), pl2, 'Copia de contrato de compraventa', 1, 'obligatorio');
db.prepare(`INSERT INTO documento_requerido (id, plantilla_id, nombre, orden, tipo_requerimiento) VALUES (?,?,?,?,?)`)
  .run(randomUUID(), pl2, 'Avaluó del bien inmueble', 2, 'obligatorio');

// Usuarios con MFA pre-configurado
const pwdHash = bcrypt.hashSync('password123', 8);
const users: [string, string, string, string, string, string, string | null, number, string][] = [
  [randomUUID(), 'cumplimiento@banconacional.com.pa', 'Oficial Banco', pwdHash, 'activo', 'rol_sujeto_obligado', so1, 1, totpSecret],
  [randomUUID(), 'cumplimiento@inmobiliariaistmo.com.pa', 'Oficial Inmobiliaria', pwdHash, 'activo', 'rol_sujeto_obligado', so2, 1, totpSecret],
  [randomUUID(), 'analista@uaf.gob.pa', 'Analista UAF', pwdHash, 'activo', 'rol_analista', null, 1, totpSecret],
  [randomUUID(), 'supervisor@uaf.gob.pa', 'Supervisor UAF', pwdHash, 'activo', 'rol_supervisor', null, 1, totpSecret],
  [randomUUID(), 'auditor@uaf.gob.pa', 'Auditor Interno', pwdHash, 'activo', 'rol_auditor', null, 1, totpSecret],
  [randomUUID(), 'admin@uaf.gob.pa', 'Administrador', pwdHash, 'activo', 'rol_admin', null, 1, totpSecret],
];
for (const u of users) {
  db.prepare(`INSERT INTO usuario (id, correo, nombre, password_hash, estado, rol_id, sujeto_obligado_id, mfa_activo, mfa_secret) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(...u);
}

// Recrear triggers de inmutabilidad
db.exec(`CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_update BEFORE UPDATE ON evento_auditoria BEGIN SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)'); END`);
db.exec(`CREATE TRIGGER IF NOT EXISTS evento_auditoria_no_delete BEFORE DELETE ON evento_auditoria BEGIN SELECT RAISE(ABORT, 'evento_auditoria es inmutable (RF-03 RE-01)'); END`);

db.close();
console.log(`✅ Test DB created: ${dbPath}`);
