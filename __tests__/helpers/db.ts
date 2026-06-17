// __tests__/helpers/db.ts
// Helper para crear una base de datos SQLite en memoria con el schema completo y
// un seed mínimo para pruebas unitarias e de integración.
// NUNCA toca db/sagaf.db — usa solo ':memory:'.

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const SCHEMA_PATH = resolve(process.cwd(), 'db/schema.sql');

/** Password hash de 'password123' pre-calculado (salt 8 para velocidad en tests) */
const TEST_PASSWORD_HASH = bcrypt.hashSync('password123', 8);

/**
 * Secret TOTP conocido para tests de E2E e integración.
 * Corresponde al secret configurado como E2E_TOTP_SECRET en playwright.config.ts.
 */
export const E2E_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/**
 * IDs fijos de entidades de prueba (para referenciar en tests).
 */
export const TEST_IDS = {
  // Roles
  ROL_SO: 'rol_sujeto_obligado',
  ROL_ANALISTA: 'rol_analista',
  ROL_SUPERVISOR: 'rol_supervisor',
  ROL_AUDITOR: 'rol_auditor',
  ROL_ADMIN: 'rol_admin',

  // Sujetos obligados
  SO_BANCO: 'so_banco_test',
  SO_INMOB: 'so_inmob_test',

  // Plantillas
  PL_BANK: 'pl_bank_natural_test',

  // Usuarios
  U_SO_BANCO: 'u_so_banco_test',
  U_SO_INMOB: 'u_so_inmob_test',
  U_ANALISTA: 'u_analista_test',
  U_SUPERVISOR: 'u_supervisor_test',
  U_AUDITOR: 'u_auditor_test',
  U_ADMIN: 'u_admin_test',
} as const;

/**
 * Crea y configura una DB SQLite en memoria con el schema de SAGAF y un seed mínimo.
 * Incluye roles, permisos, sujetos obligados, plantillas y 6 usuarios de prueba.
 * @returns La instancia de Database lista para usar en tests.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Aplicar schema completo
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  // Seed mínimo dentro de una transacción
  const seed = db.transaction(() => {
    // ─────────────────────────────────────────────────────────
    // 1. Roles
    // ─────────────────────────────────────────────────────────
    const insertRol = db.prepare('INSERT INTO rol (id, nombre, descripcion) VALUES (?, ?, ?)');
    const roles = [
      ['rol_sujeto_obligado', 'sujeto_obligado', 'Sujeto obligado reportante'],
      ['rol_analista',        'analista',        'Analista UAF'],
      ['rol_supervisor',      'supervisor',      'Supervisor UAF'],
      ['rol_auditor',         'auditor',         'Auditor interno'],
      ['rol_admin',           'admin',           'Administrador del sistema'],
    ];
    for (const r of roles) insertRol.run(...(r as [string, string, string]));

    // ─────────────────────────────────────────────────────────
    // 2. Permisos
    // ─────────────────────────────────────────────────────────
    const insertPermiso = db.prepare(
      'INSERT INTO permiso (id, codigo, modulo, accion) VALUES (?, ?, ?, ?)',
    );
    const permisos: [string, string, string, string][] = [
      ['p_ros_create',     'ros:create',      'ros',        'Registrar ROS'],
      ['p_ros_read_own',   'ros:read_own',    'ros',        'Consultar ROS propios'],
      ['p_ros_read_all',   'ros:read_all',    'ros',        'Consultar todos los ROS'],
      ['p_ros_classify',   'ros:classify',    'ros',        'Clasificar riesgo'],
      ['p_ros_close',      'ros:close',       'ros',        'Cerrar caso'],
      ['p_doc_upload',     'doc:upload',      'documentos', 'Cargar documentos'],
      ['p_doc_validate',   'doc:validate',    'documentos', 'Validar/observar documentos'],
      ['p_subsanacion',    'subsanacion',     'documentos', 'Solicitar/atender subsanación'],
      ['p_reporte_gen',    'reporte:generar', 'reportes',   'Generar reportes'],
      ['p_reporte_export', 'reporte:exportar','reportes',   'Exportar reportes'],
      ['p_usuario_admin',  'usuario:admin',   'admin',      'Gestionar usuarios'],
      ['p_sujeto_admin',   'sujeto:admin',    'admin',      'Gestionar sujetos obligados'],
      ['p_audit_read',     'audit:read',      'auditoria',  'Consultar log de auditoría'],
      ['p_vinculo',        'vinculo',         'vinculos',   'Confirmar vinculaciones'],
    ];
    for (const p of permisos) insertPermiso.run(...p);

    // ─────────────────────────────────────────────────────────
    // 3. Rol ↔ Permisos
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // 4. Sujetos obligados
    // ─────────────────────────────────────────────────────────
    const insertSO = db.prepare(`
      INSERT INTO sujeto_obligado (id, nombre, ruc, tipo, sector, organismo_supervisor, estado, responsable_cumpl)
      VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)
    `);
    insertSO.run(TEST_IDS.SO_BANCO, 'Banco Test', 'RUC-TEST-BANCO', 'bank', 'financiero', 'SBP', 'Test User');
    insertSO.run(TEST_IDS.SO_INMOB, 'Inmobiliaria Test', 'RUC-TEST-INMOB', 'realestate', 'no_financiero', 'ISRSN', 'Test User 2');

    // ─────────────────────────────────────────────────────────
    // 5. Plantilla mínima
    // ─────────────────────────────────────────────────────────
    db.prepare(`
      INSERT INTO plantilla_ros (id, nombre, version, tipo_sujeto_obligado, sector, activa)
      VALUES (?, ?, '1.0', 'bank', 'financiero', 1)
    `).run(TEST_IDS.PL_BANK, 'ROS Banco Test · Persona Natural');

    db.prepare(`
      INSERT INTO sujeto_obligado_plantilla (sujeto_obligado_id, plantilla_id) VALUES (?, ?)
    `).run(TEST_IDS.SO_BANCO, TEST_IDS.PL_BANK);

    // Un documento requerido mínimo para tests de subsanación
    db.prepare(`
      INSERT INTO documento_requerido (id, plantilla_id, nombre, tipo_requerimiento, obligatorio, orden)
      VALUES ('dr_test_1', ?, 'Documento de identidad', 'requerido', 1, 1)
    `).run(TEST_IDS.PL_BANK);

    // ─────────────────────────────────────────────────────────
    // 6. Usuarios de prueba
    // ─────────────────────────────────────────────────────────
    const insertUser = db.prepare(`
      INSERT INTO usuario (id, nombre, correo, password_hash, rol_id, sujeto_obligado_id, estado, mfa_activo)
      VALUES (?, ?, ?, ?, ?, ?, 'activo', 0)
    `);
    insertUser.run(TEST_IDS.U_SO_BANCO,   'SO Banco Test',     'so_banco@test.sagaf',    TEST_PASSWORD_HASH, 'rol_sujeto_obligado', TEST_IDS.SO_BANCO);
    insertUser.run(TEST_IDS.U_SO_INMOB,   'SO Inmob Test',     'so_inmob@test.sagaf',    TEST_PASSWORD_HASH, 'rol_sujeto_obligado', TEST_IDS.SO_INMOB);
    insertUser.run(TEST_IDS.U_ANALISTA,   'Analista Test',     'analista@test.sagaf',    TEST_PASSWORD_HASH, 'rol_analista',        null);
    insertUser.run(TEST_IDS.U_SUPERVISOR, 'Supervisor Test',   'supervisor@test.sagaf',  TEST_PASSWORD_HASH, 'rol_supervisor',      null);
    insertUser.run(TEST_IDS.U_AUDITOR,    'Auditor Test',      'auditor@test.sagaf',     TEST_PASSWORD_HASH, 'rol_auditor',         null);
    insertUser.run(TEST_IDS.U_ADMIN,      'Admin Test',        'admin@test.sagaf',       TEST_PASSWORD_HASH, 'rol_admin',           null);
  });

  seed();
  return db;
}

/**
 * Inserta un ROS mínimo de prueba en la DB dada.
 * Devuelve el ID del ROS creado.
 */
export function insertTestRos(
  db: Database.Database,
  opts: {
    id?: string;
    sujetoObligadoId: string;
    creadoPor: string;
    estado?: string;
    numeroRos?: string;
  },
): string {
  const id = opts.id ?? randomUUID();
  const numero = opts.numeroRos ?? `ROS-2026-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
  db.prepare(`
    INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id, oficial_cumplimiento,
                     fecha_deteccion, estado, descripcion, creado_por)
    VALUES (?, ?, ?, ?, 'Test Oficial', date('now'), ?, 'Descripción de prueba', ?)
  `).run(id, numero, opts.sujetoObligadoId, TEST_IDS.PL_BANK, opts.estado ?? 'recibido', opts.creadoPor);
  return id;
}

/**
 * Inserta un evento de auditoría mínimo de prueba.
 */
export function insertTestAuditEvent(db: Database.Database): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO evento_auditoria (id, usuario_id, usuario_correo, rol, modulo, accion, resultado, criticidad)
    VALUES (?, ?, 'test@sagaf', 'analista', 'test', 'test_action', 'exito', 'normal')
  `).run(id, TEST_IDS.U_ANALISTA);
  return id;
}
