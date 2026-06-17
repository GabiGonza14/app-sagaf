// __tests__/integration/auditoria-inmutable.test.ts — BL-059: Auditoría inmutable
// Verifica que UPDATE y DELETE sobre evento_auditoria lanzan error ABORT (triggers RF-03 RE-01).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertTestAuditEvent, TEST_IDS } from '../helpers/db';

let db: Database.Database;

beforeAll(() => {
  db = createTestDb();
});

afterAll(() => {
  db?.close();
});

describe('BL-059: Auditoría inmutable — triggers ABORT (RF-03 RE-01)', () => {
  it('INSERT funciona correctamente (el log acepta nuevos registros)', () => {
    const id = insertTestAuditEvent(db);
    const evento = db.prepare('SELECT * FROM evento_auditoria WHERE id = ?').get(id) as Record<string, unknown>;
    expect(evento).toBeTruthy();
    expect(evento['accion']).toBe('test_action');
    expect(evento['resultado']).toBe('exito');
  });

  it('[RF-03] UPDATE directo sobre evento_auditoria lanza error ABORT', () => {
    const id = insertTestAuditEvent(db);
    expect(() => {
      db.prepare('UPDATE evento_auditoria SET resultado = ? WHERE id = ?')
        .run('fallo', id);
    }).toThrow(/evento_auditoria es inmutable/);
  });

  it('[RF-03] DELETE directo sobre evento_auditoria lanza error ABORT', () => {
    const id = insertTestAuditEvent(db);
    expect(() => {
      db.prepare('DELETE FROM evento_auditoria WHERE id = ?').run(id);
    }).toThrow(/evento_auditoria es inmutable/);
  });

  it('[RF-03] UPDATE de cualquier campo lanza error (no solo resultado)', () => {
    const id = insertTestAuditEvent(db);

    // Intentar cambiar el módulo
    expect(() => {
      db.prepare('UPDATE evento_auditoria SET modulo = ? WHERE id = ?')
        .run('hacked', id);
    }).toThrow(/evento_auditoria es inmutable/);

    // Intentar cambiar la fecha del servidor
    expect(() => {
      db.prepare('UPDATE evento_auditoria SET fecha_hora_servidor = ? WHERE id = ?')
        .run('2020-01-01', id);
    }).toThrow(/evento_auditoria es inmutable/);

    // Intentar cambiar la criticidad
    expect(() => {
      db.prepare('UPDATE evento_auditoria SET criticidad = ? WHERE id = ?')
        .run('critica', id);
    }).toThrow(/evento_auditoria es inmutable/);
  });

  it('[RF-03] DELETE masivo (sin WHERE) también es bloqueado', () => {
    // Insertar varios eventos
    insertTestAuditEvent(db);
    insertTestAuditEvent(db);

    expect(() => {
      db.prepare('DELETE FROM evento_auditoria').run();
    }).toThrow(/evento_auditoria es inmutable/);
  });

  it('el evento insertado tiene fecha_hora_servidor del servidor (no del cliente)', () => {
    const id = insertTestAuditEvent(db);
    const evento = db.prepare('SELECT fecha_hora_servidor FROM evento_auditoria WHERE id = ?')
      .get(id) as Record<string, string>;

    // Verificar que la fecha no es nula y tiene formato razonable
    expect(evento['fecha_hora_servidor']).toBeTruthy();
    // SQLite CURRENT_TIMESTAMP genera formato 'YYYY-MM-DD HH:MM:SS'
    expect(evento['fecha_hora_servidor']).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('los eventos se pueden consultar sin restricciones (SELECT es libre)', () => {
    insertTestAuditEvent(db);
    const todos = db.prepare('SELECT COUNT(*) as c FROM evento_auditoria').get() as { c: number };
    expect(todos.c).toBeGreaterThan(0);

    const filtrado = db.prepare(
      'SELECT * FROM evento_auditoria WHERE modulo = ?'
    ).all('test');
    expect(filtrado.length).toBeGreaterThan(0);
  });

  it('la tabla tiene los triggers correctos registrados', () => {
    const triggers = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger' AND tbl_name = 'evento_auditoria'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    const names = triggers.map((t) => t.name);
    expect(names).toContain('evento_auditoria_no_update');
    expect(names).toContain('evento_auditoria_no_delete');
  });
});
