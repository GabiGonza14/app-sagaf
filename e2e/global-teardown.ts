// e2e/global-teardown.ts
// Limpia la base de datos de prueba después de que terminan los tests E2E.

import { existsSync, unlinkSync } from 'node:fs';

async function globalTeardown() {
  console.log('Iniciando globalTeardown de Playwright...');
  const dbPath = process.env.DB_PATH ?? './db/sagaf.test.db';

  if (existsSync(dbPath)) {
    try {
      unlinkSync(dbPath);
      console.log(`Archivo de DB de prueba eliminado: ${dbPath}`);
    } catch (e) {
      console.error(`No se pudo eliminar el archivo de DB de prueba: ${dbPath}`, e);
    }
  }

  // Eliminar archivos WAL y SHM si existen
  const walPath = `${dbPath}-wal`;
  if (existsSync(walPath)) {
    try { unlinkSync(walPath); } catch (e) {}
  }

  const shmPath = `${dbPath}-shm`;
  if (existsSync(shmPath)) {
    try { unlinkSync(shmPath); } catch (e) {}
  }

  console.log('globalTeardown finalizado.');
}

export default globalTeardown;
