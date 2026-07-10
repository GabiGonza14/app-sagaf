// vitest.config.ts — Configuración de Vitest para SAGAF
// Usa pool:'forks' para aislar el módulo nativo better-sqlite3 entre workers.
// Compatible con TypeScript ESM y el moduleResolution 'bundler' de Next.js.
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    // Corre cada archivo de test en un proceso separado para evitar conflictos
    // con el módulo nativo de better-sqlite3 (N-API).
    pool: 'forks',
    environment: 'node',
    globals: true,
    // Excluir E2E de Playwright — esos los maneja playwright.config.ts
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
    // Archivos de test: *.test.ts en cualquier directorio
    include: ['**/*.test.ts', '**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/logger.ts', '**/*.test.ts', '**/__tests__/**'],
    },
    // Tiempo máximo por test (útil para prevenir bloqueos en mejor-sqlite3)
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
