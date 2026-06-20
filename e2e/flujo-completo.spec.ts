// e2e/flujo-completo.spec.ts — BL-060: E2E Recorrido completo
// Prueba el flujo: registro → análisis → riesgo → subsanación → cierre.

import { test, expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';
import path from 'node:path';
import fs from 'node:fs';

const TOTP_SECRET = process.env.E2E_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXP';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="correo"]', email);
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Verificación MFA
  await page.waitForURL('**/mfa/verify');
  const code = authenticator.generate(TOTP_SECRET);
  await page.fill('input[name="code"]', code);
  await page.click('button[type="submit"]');

  // Esperar a que pase el middleware de auth
  await page.waitForLoadState('networkidle');
}

async function logout(page: Page) {
  await page.goto('/');
  // El botón de logout puede estar en el header o navbar, buscaremos el formulario con action /api/auth/signout
  // O simplemente limpiar cookies y hacer reload
  await page.context().clearCookies();
  await page.goto('/login');
}

test.describe('BL-060: Flujo completo ROS', () => {
  // Test secuencial ya que cada paso depende del anterior
  test.describe.configure({ mode: 'serial' });

  let rosId: string;
  let numeroRos: string;

  // Creamos un archivo dummy para subir
  const uploadFilePath = path.join(__dirname, 'dummy-upload.pdf');
  
  test.beforeAll(() => {
    fs.writeFileSync(uploadFilePath, 'Dummy PDF content for E2E tests');
  });

  test.afterAll(() => {
    if (fs.existsSync(uploadFilePath)) {
      fs.unlinkSync(uploadFilePath);
    }
  });

  test('1. SO registra y envía un ROS', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await test.step('Login como Sujeto Obligado', async () => {
      await login(page, 'cumplimiento@banconacional.com.pa');
      await expect(page).toHaveURL(/\/portal/);
    });

    await test.step('Crear ROS', async () => {
      await page.click('text=Nuevo ROS');
      await page.waitForURL('**/portal/ros/nuevo');
      
      await page.fill('#oficial-cumplimiento', 'Oficial E2E');
      await page.fill('#correo-oficial', 'oficial@banco.com');
      
      // Ordenante — usar cédula que existe en el directorio mock
      await page.fill('input[placeholder="Cédula del ordenante"]', '8-888-888');
      await page.locator('.lookup-card').nth(0).locator('button:has-text("Verificar")').click();
      // Aceptar cualquier respuesta del verificador (found o not_found)
      await expect(
        page.locator('text=Coincidencia encontrada').or(page.locator('text=Sin coincidencia')).first()
      ).toBeVisible({ timeout: 10000 });

      // Beneficiario — usar otra cédula del directorio mock
      await page.fill('input[placeholder="Cédula del beneficiario"]', '8-777-444');
      await page.locator('.lookup-card').nth(1).locator('button:has-text("Verificar")').click();
      // Aceptar cualquier respuesta del verificador
      await expect(
        page.locator('.lookup-card').nth(1).locator('text=Coincidencia encontrada').or(
          page.locator('.lookup-card').nth(1).locator('text=Sin coincidencia')
        ).first()
      ).toBeVisible({ timeout: 10000 });

      // Operación
      await page.fill('#fecha-deteccion', '2026-06-01');
      await page.fill('#monto', '50000');
      await page.fill('#jurisdiccion', 'Panamá');
      await page.fill('#producto-servicio', 'Cuenta de ahorros');
      await page.fill('#descripcion', 'Esta es una operación sospechosa de prueba E2E con suficientes caracteres para pasar la validación.');
      
      // Documentos — subir a TODOS los upload-zone obligatorios (ya no hay bypass)
      const uploadZones = page.locator('.doc-grid .upload-zone');
      const zoneCount = await uploadZones.count();
      for (let i = 0; i < zoneCount; i++) {
        const fileChooserPromise = page.waitForEvent('filechooser');
        await uploadZones.nth(i).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(uploadFilePath);
      }
      
      // Esperar a que al menos uno se muestre como Cargado
      await expect(page.locator('text=Cargado').first()).toBeVisible({ timeout: 10000 });

      // Enviar a la UAF
      await page.click('button:has-text("Enviar ROS a la UAF")');
      
      // Debería redirigir a la vista del ROS (esperar por un UUID, no 'nuevo')
      await page.waitForURL(/\/portal\/ros\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
      const url = page.url();
      const match = url.match(/\/portal\/ros\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
      expect(match).toBeTruthy();
      rosId = match![1];
      expect(rosId).toBeTruthy();

      // Extraer el numero_ros de la UI (en el TopBar de la vista de resumen)
      const topBarTitle = page.locator('h2').filter({ hasText: 'ROS-' });
      await expect(topBarTitle).toBeVisible({ timeout: 10000 });
      const pageText = await topBarTitle.textContent();
      const rosMatch = pageText?.match(/(ROS-\d{4}-\d{6})/);
      numeroRos = rosMatch ? rosMatch[1] : '';
      expect(numeroRos).toContain('ROS-');
    });

    await context.close();
  });

  test('2. Analista recibe, revisa y observa documento', async ({ browser }) => {
    expect(rosId).toBeDefined();
    
    const context = await browser.newContext();
    const page = await context.newPage();

    await test.step('Login como Analista', async () => {
      await login(page, 'analista@uaf.gob.pa');
      await expect(page).toHaveURL(/\/uaf/);
    });

    await test.step('Ver ROS en bandeja y clasificar riesgo', async () => {
      // Buscar el ROS
      await page.click(`text=${numeroRos}`);
      await page.waitForURL(`**/uaf/ros/${rosId}`);
      
      // Ir a pestaña de Riesgo
      await page.click('button[role="tab"]:has-text("Riesgo")');
      
      // Clasificar como Alto
      await page.selectOption('select[name="nivel"]', 'alto');
      await page.fill('input[name="puntaje"]', '80');
      await page.fill('textarea[name="justificacion"]', 'Riesgo alto por el perfil transaccional (E2E)');
      await page.click('button:has-text("Guardar Clasificación")');
      
      await expect(page.locator('text=Riesgo clasificado correctamente')).toBeVisible();
    });

    await test.step('Observar documento y solicitar subsanación', async () => {
      await page.click('button[role="tab"]:has-text("Documentos")');
      
      // Observar documento
      await page.click('button:has-text("Observar")');
      
      // Llenar modal de observación y solicitar subsanación
      await page.fill('textarea[name="observacion"]', 'El documento E2E está borroso');
      await page.check('input[name="solicitarSubsanacion"]');
      await page.fill('textarea[name="motivoSubsanacion"]', 'Suba una versión más clara (E2E)');
      await page.click('button:has-text("Confirmar Observación")');
      
      await expect(page.locator('span:has-text("Observado")')).toBeVisible();
      // Debería aparecer una alerta de subsanación pendiente o similar
    });

    await context.close();
  });

  test('3. SO atiende la subsanación', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await test.step('Login como SO', async () => {
      await login(page, 'cumplimiento@banconacional.com.pa');
      await expect(page).toHaveURL(/\/portal/);
    });

    await test.step('Navegar a subsanaciones y atender', async () => {
      await page.click('a:has-text("Subsanaciones")');
      await page.waitForURL('**/portal/subsanaciones');
      
      // Debe haber una subsanación pendiente
      await expect(page.locator('text=Suba una versión más clara (E2E)')).toBeVisible();
      
      await page.click(`a[href="/portal/ros/${rosId}?tab=documentos"]`);
      await page.waitForURL(`**/portal/ros/${rosId}?tab=documentos`);
      
      // Reemplazar el archivo observado
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.locator('button:has-text("Reemplazar")').first().click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(uploadFilePath);
      
      await expect(page.locator('span:has-text("Cargado")').first()).toBeVisible({ timeout: 10000 });
    });

    await context.close();
  });

  test('4. Supervisor aprueba y cierra el caso', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await test.step('Login como Supervisor', async () => {
      await login(page, 'supervisor@uaf.gob.pa');
      await expect(page).toHaveURL(/\/uaf/);
    });

    await test.step('Cerrar caso', async () => {
      await page.goto(`/uaf/ros/${rosId}`);
      await page.waitForLoadState('networkidle');
      
      // El botón de Cerrar Caso suele estar en el header del ROS o en un dropdown de acciones
      await page.click('button:has-text("Cerrar Caso")');
      
      // Confirmar en el modal
      await page.click('button:has-text("Sí, cerrar caso")');
      
      // Verificar que el estado cambie a Cerrado
      await expect(page.locator('.doc-summary span:has-text("Cerrado")').first()).toBeVisible();
    });

    await context.close();
  });

  test('5. Auditor verifica el log', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await test.step('Login como Auditor', async () => {
      await login(page, 'auditor@uaf.gob.pa');
      await expect(page).toHaveURL(/\/auditor/);
    });

    await test.step('Verificar rastro en auditoría', async () => {
      // Filtrar por el recurso afectado (numeroRos o rosId)
      await page.fill('input[placeholder*="Recurso Afectado"]', rosId);
      await page.waitForTimeout(1000); // esperar debounce o submit
      
      // Deberíamos ver acciones como ros:create, ros:classify, doc:upload, subsanacion, ros:close
      const textContent = await page.locator('table').textContent();
      expect(textContent).toContain('ros:create');
      expect(textContent).toContain('ros:close');
    });

    await context.close();
  });
});
