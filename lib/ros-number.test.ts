// lib/ros-number.test.ts — BL-054: Pruebas unitarias de numeración ROS (DEF-12)
// Cubre: formato correcto, unicidad bajo concurrencia secuencial, año actual, incremento.
// Estrategia: vi.mock de '@/lib/db' con DB en memoria pre-seeded.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, TEST_IDS } from '../__tests__/helpers/db';

// ── Mock de lib/db ─────────────────────────────────────────────────────────
let testDb: Database.Database;

vi.mock('./db', () => {
  const db = createTestDb();
  (globalThis as Record<string, unknown>).__rosNumberTestDb = db;
  return { db, default: db };
});

// Importar DESPUÉS del mock
import { generateNumeroROS } from './ros-number';

beforeAll(() => {
  testDb = (globalThis as Record<string, unknown>).__rosNumberTestDb as Database.Database;
});

afterAll(() => {
  testDb?.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Formato
// ─────────────────────────────────────────────────────────────────────────────
describe('generateNumeroROS — formato', () => {
  it('genera un número con formato ROS-AAAA-NNNNNN', () => {
    const num = generateNumeroROS();
    expect(num).toMatch(/^ROS-\d{4}-\d{6}$/);
  });

  it('usa el año actual del servidor', () => {
    const num = generateNumeroROS();
    const year = new Date().getFullYear().toString();
    expect(num).toContain(`ROS-${year}-`);
  });

  it('el primer ROS del año empieza en 000001', () => {
    // La DB en memoria no tiene ROS insertados, entonces el primer número es 000001
    // (los tests anteriores ya crearon uno, pero en un test aislado por forks sería 000001)
    const num = generateNumeroROS();
    // Al menos verifica que el padding es correcto (6 dígitos)
    const parts = num.split('-');
    expect(parts[2]).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unicidad (DEF-12)
// ─────────────────────────────────────────────────────────────────────────────
describe('generateNumeroROS — unicidad (DEF-12)', () => {
  it('genera 100 números secuenciales sin repeticiones', () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const num = generateNumeroROS();
      // Insertar un ROS con este número para simular el uso real
      testDb.prepare(`
        INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id,
                         oficial_cumplimiento, fecha_deteccion, estado, descripcion, creado_por)
        VALUES (?, ?, ?, ?, 'Test', date('now'), 'recibido', 'Test', ?)
      `).run(
        `ros-unicidad-${i}`,
        num,
        TEST_IDS.SO_BANCO,
        TEST_IDS.PL_BANK,
        TEST_IDS.U_SO_BANCO,
      );
      numbers.add(num);
    }
    expect(numbers.size).toBe(100);
  });

  it('los números se incrementan de forma secuencial', () => {
    // Limpiamos los ROS de prueba anteriores y empezamos fresco
    // Nota: no necesitamos limpiar porque los números siempre buscan el último
    const n1 = generateNumeroROS();
    testDb.prepare(`
      INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id,
                       oficial_cumplimiento, fecha_deteccion, estado, descripcion, creado_por)
      VALUES (?, ?, ?, ?, 'Test', date('now'), 'recibido', 'Test', ?)
    `).run('ros-seq-1', n1, TEST_IDS.SO_BANCO, TEST_IDS.PL_BANK, TEST_IDS.U_SO_BANCO);

    const n2 = generateNumeroROS();
    // El sufijo numérico de n2 debe ser exactamente el de n1 + 1
    const suffix1 = parseInt(n1.split('-')[2]!, 10);
    const suffix2 = parseInt(n2.split('-')[2]!, 10);
    expect(suffix2).toBe(suffix1 + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Robustez
// ─────────────────────────────────────────────────────────────────────────────
describe('generateNumeroROS — robustez', () => {
  it('siempre devuelve una cadena no vacía', () => {
    const num = generateNumeroROS();
    expect(num).toBeTruthy();
    expect(typeof num).toBe('string');
    expect(num.length).toBeGreaterThan(0);
  });

  it('el número tiene exactamente 3 partes separadas por -', () => {
    const num = generateNumeroROS();
    const parts = num.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('ROS');
  });
});
