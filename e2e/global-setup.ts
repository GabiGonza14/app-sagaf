// e2e/global-setup.ts
// Configura la base de datos de prueba para Playwright ANTES de iniciar Next.js.
// Usa el seed definido en __tests__/helpers/db.ts, con un pequeño ajuste para E2E
// (habilitar MFA con el secret conocido y encriptarlo con bcrypt si fuera necesario,
// aunque actualmente está en texto plano, lo que el E2E espera).

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { E2E_TOTP_SECRET } from '../__tests__/helpers/db';

async function globalSetup() {
  console.log('Iniciando globalSetup de Playwright...');
  // Extraemos la ruta de la DB del environment configurado en playwright.config.ts
  const dbPath = process.env.DB_PATH ?? './db/sagaf.test.db';
  const schemaPath = resolve(process.cwd(), 'db/schema.sql');

  // Aseguramos que existe el archivo de schema
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema no encontrado en ${schemaPath}`);
  }

  // Eliminar la BD anterior si existe para evitar corrupción o datos residuales
  if (existsSync(dbPath)) {
    try {
      require('node:fs').unlinkSync(dbPath);
    } catch (e) {
      console.warn('No se pudo eliminar la BD previa:', e);
    }
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log(`Aplicando schema en ${dbPath}...`);
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log('Insertando seed de prueba para E2E...');
  const seedFile = resolve(process.cwd(), 'db/seed.ts');
  if (!existsSync(seedFile)) {
    throw new Error(`Seed no encontrado en ${seedFile}`);
  }

  // Ejecutamos el seed real del proyecto para tener los datos completos (usuarios, docs req, plantillas)
  // Como estamos en Node, podemos usar tsx programáticamente o simplemente ejecutarlo como hijo.
  // Pero lo más limpio es asignar MFA activo a todos los usuarios del seed usando el script
  
  // Usaremos un proceso hijo para correr el db:seed apuntando a nuestra DB de test
  const { execSync } = require('node:child_process');
  
  try {
    execSync('node --import tsx db/seed.ts', {
      env: { ...process.env, DB_PATH: dbPath },
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Error al ejecutar el seed E2E:', error);
    throw error;
  }

  // Habilitar MFA para todos los usuarios con el secret conocido
  // para poder iniciar sesión en el test E2E sin leer QRs.
  const updateMfa = db.prepare(`
    UPDATE usuario
    SET mfa_activo = 1, mfa_secret = ?
  `);
  const result = updateMfa.run(E2E_TOTP_SECRET);
  console.log(`MFA habilitado para ${result.changes} usuarios de prueba.`);

  db.close();
  console.log('globalSetup finalizado.');
}

export default globalSetup;
