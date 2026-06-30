import Database from 'better-sqlite3';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new Database('./db/sagaf.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const uploadsDir = process.env.UPLOADS_DIR ?? './var/uploads';

// 1. Eliminar archivos físicos
const docs = db.prepare('SELECT id, ros_id, ruta_archivo FROM documento_adjunto').all() as any[];
console.log(`Documentos adjuntos encontrados: ${docs.length}`);

for (const d of docs) {
  if (d.ruta_archivo && existsSync(d.ruta_archivo)) {
    try { unlinkSync(d.ruta_archivo); } catch (e) {
      console.error(`Error eliminando ${d.ruta_archivo}:`, e);
    }
  }
}

// 2. Eliminar carpetas de upload por ROS
for (const d of docs) {
  const dir = join(uploadsDir, d.ros_id);
  if (existsSync(dir)) {
    try {
      const remaining = readdirSync(dir);
      if (remaining.length === 0) rmdirSync(dir);
    } catch {}
  }
}

// 3. Tablas que referencian documento_adjunto (eliminar antes por FK)
db.prepare('DELETE FROM solicitud_subsanacion').run();

// 4. Eliminar ROS (cascada al resto)
const result = db.prepare('DELETE FROM ros').run();
console.log(`ROS eliminados: ${result.changes}`);

const remaining = db.prepare('SELECT COUNT(*) AS c FROM ros').get() as any;
console.log(`ROS restantes en BD: ${remaining.c}`);

db.close();
console.log('OK');
