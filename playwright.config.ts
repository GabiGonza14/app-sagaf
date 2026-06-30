// playwright.config.ts — Configuración de Playwright para pruebas E2E de SAGAF
// Estrategia: Playwright arranca `next dev` con una DB de prueba separada (sagaf.test.db)
// y un secret TOTP conocido para poder autenticarse programáticamente.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directorio de archivos de prueba E2E
  testDir: './e2e',
  // Patrón de archivos E2E
  testMatch: '**/*.spec.ts',

  // Límite de tiempo global por test
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Ejecutar tests en paralelo (cada worker tiene su propio contexto de browser)
  fullyParallel: false, // false porque la DB de test es compartida entre tests del mismo flujo
  workers: 1,

  // Reintentar en CI para reducir flakiness
  retries: process.env.CI ? 2 : 0,

  // Reporters
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // URL base de la aplicación
    baseURL: 'http://localhost:3099',
    // Capturar screenshot solo al fallar
    screenshot: 'only-on-failure',
    // Grabar video de cada test (útil para revisión y depuración)
    video: 'on',
    // Trace al fallar (para depuración)
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        screenshot: 'only-on-failure',
      },
    },
  ],

  // Servidor de desarrollo: Playwright arranca Next.js automáticamente con DB de prueba
  webServer: {
    command: 'node --import tsx e2e/setup-test-db.ts && node node_modules/next/dist/bin/next dev --port 3099',
    url: 'http://localhost:3099',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DB_PATH: './db/sagaf.test.db',
      E2E_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
    },
  },

  // Setup global: inicializa la DB de test con el schema y seed mínimo
  // globalSetup: './e2e/global-setup.ts',
  // Teardown: limpieza de la DB de test
  // globalTeardown: './e2e/global-teardown.ts',
});
