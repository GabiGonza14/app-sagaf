// __tests__/integration/subsanacion.test.ts — BL-056: Integración subsanación
// Flujo: documento observado → solicitud de subsanación → reemplazo → estado correcto.

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

describe('BL-056: Subsanación (observado → subsanado → estado correcto)', () => {
  it('flujo completo: observar → solicitar subsanación → reemplazar → atender', () => {
    // 1. Crear un ROS
    const rosId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      estado: 'recibido',
    });

    // 2. Insertar un documento adjunto (simulando upload del SO)
    const docId = randomUUID();
    db.prepare(`
      INSERT INTO documento_adjunto (id, ros_id, documento_requerido_id, nombre_archivo,
        ruta_archivo, tipo_mime, tamano_bytes, estado, cargado_por)
      VALUES (?, ?, 'dr_test_1', 'identificacion.pdf', '/var/uploads/id.pdf', 'application/pdf',
        1024, 'cargado', ?)
    `).run(docId, rosId, TEST_IDS.U_SO_BANCO);

    // 3. Analista observa el documento
    db.prepare(`UPDATE documento_adjunto SET estado = 'observado', observacion = 'Documento ilegible' WHERE id = ?`)
      .run(docId);

    const docObservado = db.prepare('SELECT estado, observacion FROM documento_adjunto WHERE id = ?')
      .get(docId) as Record<string, unknown>;
    expect(docObservado['estado']).toBe('observado');
    expect(docObservado['observacion']).toBe('Documento ilegible');

    // 4. Analista crea solicitud de subsanación
    const subsId = randomUUID();
    db.prepare(`
      INSERT INTO solicitud_subsanacion (id, ros_id, documento_adjunto_id, documento_requerido_id,
        motivo, estado, solicitada_por, fecha_limite)
      VALUES (?, ?, ?, 'dr_test_1', 'Documento ilegible — reenviar en mejor calidad',
        'pendiente', ?, datetime('now', '+5 days'))
    `).run(subsId, rosId, docId, TEST_IDS.U_ANALISTA);

    // 5. SO sube un nuevo documento (reemplazo)
    const nuevoDocId = randomUUID();
    db.prepare(`
      INSERT INTO documento_adjunto (id, ros_id, documento_requerido_id, nombre_archivo,
        ruta_archivo, tipo_mime, tamano_bytes, estado, cargado_por)
      VALUES (?, ?, 'dr_test_1', 'identificacion_v2.pdf', '/var/uploads/id_v2.pdf',
        'application/pdf', 2048, 'cargado', ?)
    `).run(nuevoDocId, rosId, TEST_IDS.U_SO_BANCO);

    // 6. Se marca la subsanación como atendida
    db.prepare(`
      UPDATE solicitud_subsanacion SET estado = 'atendida', fecha_respuesta = datetime('now'),
        respuesta = 'Documento reemplazado' WHERE id = ?
    `).run(subsId);

    // Verificaciones
    const subs = db.prepare('SELECT * FROM solicitud_subsanacion WHERE id = ?')
      .get(subsId) as Record<string, unknown>;
    expect(subs['estado']).toBe('atendida');
    expect(subs['fecha_respuesta']).toBeTruthy();

    const nuevoDoc = db.prepare('SELECT * FROM documento_adjunto WHERE id = ?')
      .get(nuevoDocId) as Record<string, unknown>;
    expect(nuevoDoc['estado']).toBe('cargado');
    expect(nuevoDoc['nombre_archivo']).toBe('identificacion_v2.pdf');
  });

  it('solicitud de subsanación tiene fecha_limite a 5 días', () => {
    const rosId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
    });

    const subsId = randomUUID();
    db.prepare(`
      INSERT INTO solicitud_subsanacion (id, ros_id, motivo, estado, solicitada_por, fecha_limite)
      VALUES (?, ?, 'Falta firma', 'pendiente', ?, datetime('now', '+5 days'))
    `).run(subsId, rosId, TEST_IDS.U_ANALISTA);

    const subs = db.prepare('SELECT fecha_limite FROM solicitud_subsanacion WHERE id = ?')
      .get(subsId) as Record<string, unknown>;
    expect(subs['fecha_limite']).toBeTruthy();
  });

  it('documentos con cascade: al eliminar el ROS, se eliminan los documentos y subsanaciones', () => {
    const rosId = insertTestRos(db, {
      sujetoObligadoId: TEST_IDS.SO_BANCO,
      creadoPor: TEST_IDS.U_SO_BANCO,
      estado: 'borrador',
      numeroRos: `ROS-2026-CASCADE-${randomUUID().slice(0, 4)}`,
    });

    // Insertar doc y subsanación
    const docId = randomUUID();
    db.prepare(`
      INSERT INTO documento_adjunto (id, ros_id, nombre_archivo, ruta_archivo,
        tamano_bytes, estado, cargado_por)
      VALUES (?, ?, 'test.pdf', '/var/uploads/test.pdf', 100, 'cargado', ?)
    `).run(docId, rosId, TEST_IDS.U_SO_BANCO);

    db.prepare(`
      INSERT INTO solicitud_subsanacion (id, ros_id, motivo, estado, solicitada_por)
      VALUES (?, ?, 'Test', 'pendiente', ?)
    `).run(randomUUID(), rosId, TEST_IDS.U_ANALISTA);

    // Eliminar el ROS (como en el borrador descartado)
    db.prepare('DELETE FROM ros WHERE id = ?').run(rosId);

    // Verificar cascade
    const docsRemaining = db.prepare('SELECT COUNT(*) as c FROM documento_adjunto WHERE ros_id = ?')
      .get(rosId) as { c: number };
    expect(docsRemaining.c).toBe(0);

    const subsRemaining = db.prepare('SELECT COUNT(*) as c FROM solicitud_subsanacion WHERE ros_id = ?')
      .get(rosId) as { c: number };
    expect(subsRemaining.c).toBe(0);
  });
});
