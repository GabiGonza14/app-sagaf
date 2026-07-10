// scripts/backup.ts
// Script de respaldo automatizado de la base de datos (RNF-07)
// Ejecutar con: npx tsx scripts/backup.ts

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';

const dbPath = process.env.DB_PATH ?? resolve(process.cwd(), 'db/sagaf.db');
const backupDir = resolve(process.cwd(), 'backups');

if (!existsSync(dbPath)) {
  console.error(`❌ La base de datos no existe en: ${dbPath}`);
  process.exit(1);
}

// Asegurar que el directorio de backups exista
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

// Generar nombre del archivo de backup con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = resolve(backupDir, `sagaf-backup-${timestamp}.db`);

console.log(`⏳ Iniciando respaldo de la base de datos SAGAF...`);
console.log(`   Origen:  ${dbPath}`);
console.log(`   Destino: ${backupPath}`);

try {
  // Utilizamos el API nativo de backup de better-sqlite3 que realiza 
  // una copia segura incluso si la DB está en uso (modo WAL).
  const db = new Database(dbPath, { readonly: true });
  
  db.backup(backupPath)
    .then(() => {
      console.log(`✅ Respaldo completado con éxito: ${backupPath}`);
      
      // Opcionalmente podemos comprimir o encriptar el archivo aquí,
      // pero para cumplir con RNF-07 es suficiente asegurar la integridad.
      db.close();
    })
    .catch((err) => {
      console.error(`❌ Error durante el respaldo online:`, err);
      db.close();
      process.exit(1);
    });

} catch (error) {
  console.error(`❌ Error fatal al preparar el respaldo:`, error);
  process.exit(1);
}
