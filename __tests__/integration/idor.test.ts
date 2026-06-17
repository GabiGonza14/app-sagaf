// __tests__/integration/idor.test.ts — BL-057: Seguridad IDOR (DEF-05)
// Verifica que un sujeto obligado NO puede acceder a ROS de otra entidad.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertTestRos, TEST_IDS } from '../helpers/db';

let db: Database.Database;

beforeAll(() => {
  db = createTestDb();
});

afterAll(() => {
  db?.close();
});

// Función helper que simula la verificación anti-IDOR que hace canAccessROS
function canAccessROS(
  userSujetoObligadoId: string | null,
  userRol: string,
  rosSujetoObligadoId: string,
): boolean {
  if (userRol === 'sujeto_obligado') {
    return userSujetoObligadoId === rosSujetoObligadoId;
  }
  return ['analista', 'supervisor', 'admin'].includes(userRol);
}

describe('BL-057: Seguridad IDOR — acceso a ROS ajeno (DEF-05)', () => {
  let rosBancoId: string;
  let rosInmobId: string;

  beforeAll(() => {
    // Crear un ROS del Banco
    rosBancoId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      numeroRos: 'ROS-2026-IDOR01',
    });

    // Crear un ROS de la Inmobiliaria
    rosInmobId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_INMOB,
      creadoPor: TEST_IDS.U_SO_INMOB,
      numeroRos: 'ROS-2026-IDOR02',
    });
  });

  it('SO del Banco puede ver su propio ROS', () => {
    const ros = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?')
      .get(rosBancoId) as Record<string, string>;
    const acceso = canAccessROS(TEST_IDS.SO_BANCO, 'sujeto_obligado', ros['sujeto_obligado_id']!);
    expect(acceso).toBe(true);
  });

  it('[DEF-05] SO del Banco NO puede ver el ROS de la Inmobiliaria', () => {
    const ros = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?')
      .get(rosInmobId) as Record<string, string>;
    const acceso = canAccessROS(TEST_IDS.SO_BANCO, 'sujeto_obligado', ros['sujeto_obligado_id']!);
    expect(acceso).toBe(false);
  });

  it('[DEF-05] SO de la Inmobiliaria NO puede ver el ROS del Banco', () => {
    const ros = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?')
      .get(rosBancoId) as Record<string, string>;
    const acceso = canAccessROS(TEST_IDS.SO_INMOB, 'sujeto_obligado', ros['sujeto_obligado_id']!);
    expect(acceso).toBe(false);
  });

  it('analista puede ver ambos ROS', () => {
    const rosBanco = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?')
      .get(rosBancoId) as Record<string, string>;
    expect(canAccessROS(null, 'analista', rosBanco['sujeto_obligado_id']!)).toBe(true);

    const rosInmob = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?')
      .get(rosInmobId) as Record<string, string>;
    expect(canAccessROS(null, 'analista', rosInmob['sujeto_obligado_id']!)).toBe(true);
  });

  it('[DEF-05] consulta filtrada por SO devuelve solo ROS propios', () => {
    // Simula la consulta del portal: solo ROS del SO autenticado
    const rosPropioBanco = db.prepare(`
      SELECT * FROM ros WHERE sujeto_obligado_id = ?
    `).all(TEST_IDS.SO_BANCO) as Array<Record<string, unknown>>;

    // Todos los resultados deben pertenecer al mismo SO
    for (const r of rosPropioBanco) {
      expect(r['sujeto_obligado_id']).toBe(TEST_IDS.SO_BANCO);
    }

    // Ninguno debe ser del otro SO
    const ajenos = rosPropioBanco.filter(
      (r) => r['sujeto_obligado_id'] !== TEST_IDS.SO_BANCO,
    );
    expect(ajenos).toHaveLength(0);
  });

  it('[DEF-05] un SO con ID inventado no obtiene resultados', () => {
    const resultado = db.prepare(`
      SELECT * FROM ros WHERE sujeto_obligado_id = ?
    `).all('so_inventado_inexistente');
    expect(resultado).toHaveLength(0);
  });
});
