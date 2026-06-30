// db/init.ts — Inicializa la base SQLite ejecutando schema.sql
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dbPath = process.env.DB_PATH ?? './db/sagaf.db';
const schemaPath = resolve(process.cwd(), 'db/schema.sql');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migración incremental — añadir columnas nuevas sin romper instancias existentes
const subCols = db.pragma('table_info(solicitud_subsanacion)') as Array<{ name: string }>;
if (!subCols.some((c) => c.name === 'fecha_limite')) {
  db.exec('ALTER TABLE solicitud_subsanacion ADD COLUMN fecha_limite TEXT');
  console.log('[SAGAF] Migración: fecha_limite añadido a solicitud_subsanacion');
}

const rosCols = db.pragma('table_info(ros)') as Array<{ name: string }>;
if (!rosCols.some((c) => c.name === 'observaciones')) {
  db.exec('ALTER TABLE ros ADD COLUMN observaciones TEXT');
  console.log('[SAGAF] Migración: observaciones añadido a ros');
}

if (!subCols.some((c) => c.name === 'documento_requerido_id')) {
  db.exec('ALTER TABLE solicitud_subsanacion ADD COLUMN documento_requerido_id TEXT REFERENCES documento_requerido(id)');
  console.log('[SAGAF] Migración: documento_requerido_id añadido a solicitud_subsanacion');
}

const riesgoCols = db.pragma('table_info(riesgo_caso)') as Array<{ name: string }>;
if (!riesgoCols.some((c) => c.name === 'anulado')) {
  db.exec("ALTER TABLE riesgo_caso ADD COLUMN anulado INTEGER NOT NULL DEFAULT 0");
  db.exec("ALTER TABLE riesgo_caso ADD COLUMN anulado_por TEXT");
  db.exec("ALTER TABLE riesgo_caso ADD COLUMN anulado_justificacion TEXT");
  db.exec("ALTER TABLE riesgo_caso ADD COLUMN fecha_anulacion TEXT");
  console.log('[SAGAF] Migración: columnas de anulación añadidas a riesgo_caso');
}

console.log(`[SAGAF] Base de datos inicializada en ${dbPath}`);
db.close();
