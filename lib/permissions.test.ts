// lib/permissions.test.ts — BL-052: Pruebas unitarias de permisos (RF-05, DEF-05/DEF-06)
// Cubre: hasPermission, requirePermission, requireRole, canAccessROS, ForbiddenError
// Estrategia: vi.mock de '@/lib/db' con DB en memoria pre-seeded.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, TEST_IDS } from '../__tests__/helpers/db';

// ── Mock de lib/db ─────────────────────────────────────────────────────────
// permissions.ts importa `db` de '@/lib/db' (o './db'). Interceptamos el módulo
// para que devuelva nuestra DB en memoria en lugar de abrir el archivo real.
let testDb: Database.Database;

vi.mock('./db', () => {
  // Se ejecuta una sola vez al cargar el módulo
  const db = createTestDb();
  // Guardamos referencia para cerrar después
  (globalThis as Record<string, unknown>).__permissionsTestDb = db;
  return { db, default: db };
});

// Importar DESPUÉS del mock para que use la DB en memoria
import {
  hasPermission,
  requirePermission,
  requireRole,
  canAccessROS,
  ForbiddenError,
  type AuthSubject,
  type Role,
} from './permissions';

beforeAll(() => {
  testDb = (globalThis as Record<string, unknown>).__permissionsTestDb as Database.Database;
});

afterAll(() => {
  testDb?.close();
});

// ── Helpers de AuthSubject ─────────────────────────────────────────────────
function makeSubject(rol: Role, soId: string | null = null): AuthSubject {
  return {
    id: `test-${rol}`,
    correo: `${rol}@test.sagaf`,
    rol,
    sujeto_obligado_id: soId,
  };
}

const SO_BANCO = makeSubject('sujeto_obligado', TEST_IDS.SO_BANCO);
const SO_INMOB = makeSubject('sujeto_obligado', TEST_IDS.SO_INMOB);
const ANALISTA = makeSubject('analista');
const SUPERVISOR = makeSubject('supervisor');
const AUDITOR = makeSubject('auditor');
const ADMIN = makeSubject('admin');

// ─────────────────────────────────────────────────────────────────────────────
// hasPermission
// ─────────────────────────────────────────────────────────────────────────────
describe('hasPermission', () => {
  // ── Sujeto obligado ───────────────────────────────────────────
  it('SO puede crear ROS (ros:create)', () => {
    expect(hasPermission(SO_BANCO, 'ros:create')).toBe(true);
  });

  it('SO puede leer ROS propios (ros:read_own)', () => {
    expect(hasPermission(SO_BANCO, 'ros:read_own')).toBe(true);
  });

  it('SO NO puede leer todos los ROS (ros:read_all)', () => {
    expect(hasPermission(SO_BANCO, 'ros:read_all')).toBe(false);
  });

  it('SO NO puede clasificar riesgo', () => {
    expect(hasPermission(SO_BANCO, 'ros:classify')).toBe(false);
  });

  it('SO NO puede cerrar casos', () => {
    expect(hasPermission(SO_BANCO, 'ros:close')).toBe(false);
  });

  it('SO puede subir documentos (doc:upload)', () => {
    expect(hasPermission(SO_BANCO, 'doc:upload')).toBe(true);
  });

  // ── Analista ──────────────────────────────────────────────────
  it('analista puede leer todos los ROS (ros:read_all)', () => {
    expect(hasPermission(ANALISTA, 'ros:read_all')).toBe(true);
  });

  it('analista puede clasificar riesgo', () => {
    expect(hasPermission(ANALISTA, 'ros:classify')).toBe(true);
  });

  it('analista puede validar documentos', () => {
    expect(hasPermission(ANALISTA, 'doc:validate')).toBe(true);
  });

  it('analista NO puede cerrar casos (solo supervisor)', () => {
    expect(hasPermission(ANALISTA, 'ros:close')).toBe(false);
  });

  it('analista NO puede exportar reportes (solo supervisor)', () => {
    expect(hasPermission(ANALISTA, 'reporte:exportar')).toBe(false);
  });

  // ── Supervisor ────────────────────────────────────────────────
  it('supervisor puede cerrar casos (ros:close)', () => {
    expect(hasPermission(SUPERVISOR, 'ros:close')).toBe(true);
  });

  it('supervisor puede exportar reportes', () => {
    expect(hasPermission(SUPERVISOR, 'reporte:exportar')).toBe(true);
  });

  it('supervisor puede generar reportes', () => {
    expect(hasPermission(SUPERVISOR, 'reporte:generar')).toBe(true);
  });

  // ── Auditor ───────────────────────────────────────────────────
  it('auditor SOLO puede leer auditoría (audit:read)', () => {
    expect(hasPermission(AUDITOR, 'audit:read')).toBe(true);
  });

  it('auditor NO puede crear ROS', () => {
    expect(hasPermission(AUDITOR, 'ros:create')).toBe(false);
  });

  it('auditor NO puede clasificar riesgo', () => {
    expect(hasPermission(AUDITOR, 'ros:classify')).toBe(false);
  });

  // ── Admin ─────────────────────────────────────────────────────
  it('admin puede gestionar usuarios', () => {
    expect(hasPermission(ADMIN, 'usuario:admin')).toBe(true);
  });

  it('admin puede gestionar sujetos obligados', () => {
    expect(hasPermission(ADMIN, 'sujeto:admin')).toBe(true);
  });

  it('admin NO puede crear ROS (mínimo privilegio)', () => {
    expect(hasPermission(ADMIN, 'ros:create')).toBe(false);
  });

  // ── Null / undefined ──────────────────────────────────────────
  it('devuelve false para subject null', () => {
    expect(hasPermission(null, 'ros:create')).toBe(false);
  });

  it('devuelve false para subject undefined', () => {
    expect(hasPermission(undefined, 'ros:create')).toBe(false);
  });

  it('devuelve false para un permiso inexistente', () => {
    expect(hasPermission(ANALISTA, 'permiso:inventado')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirePermission
// ─────────────────────────────────────────────────────────────────────────────
describe('requirePermission', () => {
  it('no lanza si el subject tiene el permiso', () => {
    expect(() => requirePermission(ANALISTA, 'ros:read_all')).not.toThrow();
  });

  it('lanza ForbiddenError si no tiene el permiso', () => {
    expect(() => requirePermission(SO_BANCO, 'ros:read_all')).toThrow(ForbiddenError);
    expect(() => requirePermission(SO_BANCO, 'ros:read_all')).toThrow(/Permiso requerido/);
  });

  it('lanza ForbiddenError si el subject es null (no autenticado)', () => {
    expect(() => requirePermission(null, 'ros:create')).toThrow(ForbiddenError);
    expect(() => requirePermission(null, 'ros:create')).toThrow(/No autenticado/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────────────────────────────────────
describe('requireRole', () => {
  it('no lanza si el rol coincide', () => {
    expect(() => requireRole(ADMIN, 'admin')).not.toThrow();
  });

  it('acepta múltiples roles (cualquiera es válido)', () => {
    expect(() => requireRole(ANALISTA, 'analista', 'supervisor')).not.toThrow();
    expect(() => requireRole(SUPERVISOR, 'analista', 'supervisor')).not.toThrow();
  });

  it('lanza ForbiddenError si el rol no coincide', () => {
    expect(() => requireRole(AUDITOR, 'admin')).toThrow(ForbiddenError);
    expect(() => requireRole(AUDITOR, 'admin')).toThrow(/Rol requerido.*admin/);
  });

  it('lanza si el subject es null', () => {
    expect(() => requireRole(null, 'admin')).toThrow(ForbiddenError);
    expect(() => requireRole(null, 'admin')).toThrow(/No autenticado/);
  });

  it('lanza si el subject es undefined', () => {
    expect(() => requireRole(undefined, 'admin')).toThrow(ForbiddenError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canAccessROS — anti-IDOR (DEF-05)
// ─────────────────────────────────────────────────────────────────────────────
describe('canAccessROS (DEF-05 anti-IDOR)', () => {
  it('SO de una entidad puede acceder a ROS de la misma entidad', () => {
    expect(canAccessROS(SO_BANCO, TEST_IDS.SO_BANCO)).toBe(true);
  });

  it('[DEF-05] SO de una entidad NO puede acceder a ROS de otra entidad', () => {
    expect(canAccessROS(SO_BANCO, TEST_IDS.SO_INMOB)).toBe(false);
  });

  it('[DEF-05] SO no puede acceder a ROS con ID inventado', () => {
    expect(canAccessROS(SO_BANCO, 'so_inexistente')).toBe(false);
  });

  it('analista puede acceder a cualquier ROS', () => {
    expect(canAccessROS(ANALISTA, TEST_IDS.SO_BANCO)).toBe(true);
    expect(canAccessROS(ANALISTA, TEST_IDS.SO_INMOB)).toBe(true);
  });

  it('supervisor puede acceder a cualquier ROS', () => {
    expect(canAccessROS(SUPERVISOR, TEST_IDS.SO_BANCO)).toBe(true);
  });

  it('admin puede acceder a cualquier ROS', () => {
    expect(canAccessROS(ADMIN, TEST_IDS.SO_BANCO)).toBe(true);
  });

  it('auditor NO puede acceder directamente a ROS (solo auditoria)', () => {
    // canAccessROS devuelve false para auditor porque no está en la lista de roles permitidos
    expect(canAccessROS(AUDITOR, TEST_IDS.SO_BANCO)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ForbiddenError
// ─────────────────────────────────────────────────────────────────────────────
describe('ForbiddenError', () => {
  it('tiene name = "ForbiddenError"', () => {
    const err = new ForbiddenError('test');
    expect(err.name).toBe('ForbiddenError');
  });

  it('es instancia de Error', () => {
    const err = new ForbiddenError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserva el mensaje', () => {
    const err = new ForbiddenError('mensaje personalizado');
    expect(err.message).toBe('mensaje personalizado');
  });
});
