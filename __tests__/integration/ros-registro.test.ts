// __tests__/integration/ros-registro.test.ts — BL-055: Integración registro ROS portal→UAF
// Un sujeto obligado crea un ROS y el analista lo puede ver en la bandeja.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertTestRos, TEST_IDS } from '../helpers/db';
import { randomUUID } from 'node:crypto';

let db: Database.Database;

beforeAll(() => {
  db = createTestDb();
});

afterAll(() => {
  db?.close();
});

describe('BL-055: Registro ROS portal → UAF', () => {
  it('un SO puede insertar un ROS completo en la BD', () => {
    const rosId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      estado: 'recibido',
      numeroRos: 'ROS-2026-000001',
    });

    const ros = db.prepare('SELECT * FROM ros WHERE id = ?').get(rosId) as Record<string, unknown>;
    expect(ros).toBeTruthy();
    expect(ros['estado']).toBe('recibido');
    expect(ros['numero_ros']).toBe('ROS-2026-000001');
    expect(ros['sujeto_obligado_id']).toBe(TEST_IDS.SO_BANCO);
  });

  it('el ROS aparece en una consulta de bandeja UAF (todos los ROS recibidos)', () => {
    const rosId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      estado: 'recibido',
      numeroRos: 'ROS-2026-000010',
    });

    // Simular la consulta que hace la bandeja UAF
    const bandeja = db.prepare(`
      SELECT r.*, so.nombre as sujeto_nombre
      FROM ros r
      JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
      WHERE r.estado != 'borrador'
      ORDER BY r.fecha_recepcion DESC
    `).all() as Array<Record<string, unknown>>;

    const encontrado = bandeja.find((r) => r['id'] === rosId);
    expect(encontrado).toBeTruthy();
    expect(encontrado!['sujeto_nombre']).toBe('Banco Test');
  });

  it('un SO puede crear un ROS con partes involucradas y operación sospechosa', () => {
    const rosId = randomUUID();
    db.transaction(() => {
      // Insertar ROS
      db.prepare(`
        INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id,
          oficial_cumplimiento, fecha_deteccion, estado, descripcion, creado_por)
        VALUES (?, ?, ?, ?, 'Oficial Test', date('now'), 'recibido', 'Test completo', ?)
      `).run(rosId, `ROS-2026-${randomUUID().slice(0, 6)}`, TEST_IDS.SO_BANCO, TEST_IDS.PL_BANK, TEST_IDS.U_SO_BANCO);

      // Insertar parte involucrada
      db.prepare(`
        INSERT INTO parte_involucrada (id, ros_id, rol_en_operacion, tipo_persona,
          identificador, identificador_enmascarado, nombre_visible, datos_sensibles_bloqueados)
        VALUES (?, ?, 'ordenante', 'natural', '8-123-4567', '***-***-567', 'Juan Pérez', 1)
      `).run(randomUUID(), rosId);

      // Insertar operación sospechosa
      db.prepare(`
        INSERT INTO operacion_sospechosa (id, ros_id, monto, moneda, tipo_operacion, senal_alerta)
        VALUES (?, ?, 50000.00, 'USD', 'transferencia', 'Monto inusual para el perfil')
      `).run(randomUUID(), rosId);
    })();

    // Verificar que todo se insertó atómicamente
    const partes = db.prepare('SELECT * FROM parte_involucrada WHERE ros_id = ?').all(rosId);
    expect(partes).toHaveLength(1);

    const ops = db.prepare('SELECT * FROM operacion_sospechosa WHERE ros_id = ?').all(rosId);
    expect(ops).toHaveLength(1);
  });

  it('un ROS en estado borrador NO aparece en la bandeja UAF', () => {
    insertTestRos(db, {
      id: 'ros-borrador-test',
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      estado: 'borrador',
      numeroRos: 'ROS-2026-BORR01',
    });

    const bandeja = db.prepare(`
      SELECT * FROM ros WHERE estado != 'borrador'
    `).all() as Array<Record<string, unknown>>;

    const borrador = bandeja.find((r) => r['id'] === 'ros-borrador-test');
    expect(borrador).toBeUndefined();
  });
});
