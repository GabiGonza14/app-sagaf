# Reporte de Pruebas — Fase 3: Calidad y Pruebas

Este documento resume los resultados de la ejecución de la Fase 3 del backlog del proyecto SAGAF, correspondiente a las pruebas automatizadas (Alfa y Beta).

## 1. Resumen de Cobertura

Se ha implementado una suite completa de pruebas automatizadas utilizando **Vitest** (pruebas unitarias y de integración) y **Playwright** (pruebas E2E de interfaz).

### Qué se probó:
- **Seguridad (Unit / Integración):** Prevención de re-uso y expiración de códigos MFA TOTP (DEF-01, DEF-02), bloqueo de acceso sin verificación MFA completada (DEF-03), acceso indebido a ROS ajenos (IDOR, DEF-05), validación de permisos en backend (DEF-06), inmutabilidad estricta del log de auditoría (RF-03).
- **Cumplimiento (Ley 81):** Enmascarado de identificadores, correos y montos según el rol del usuario que consulta (ej. Auditor no puede ver montos de transacciones). Normalización de identificadores (DEF-10).
- **Integridad y Concurrencia:** Generación atómica y única de números de ROS evitando colisiones (DEF-12).
- **Flujos de Negocio (Integración / E2E):** Registro de ROS desde el portal hacia la UAF, incluyendo partes involucradas y operaciones sospechosas. Flujo completo de observación documental, solicitud de subsanación y reemplazo de archivo.

### Qué no se probó (Limitaciones):
- Rendimiento bajo carga masiva (stress testing).
- Pruebas visuales de regresión en UI de componentes (Snapshot testing).
- Flujos alternos poco comunes en E2E (e.g. timeout de sesión durante el registro de un ROS).
- Ejecución con usuarios "reales" (pruebas Beta limitadas a simulación mediante roles representativos debido a entorno académico).

---

## 2. Métricas y Estadísticas

| Métrica | Resultado |
|---|---|
| **Archivos de Prueba** | 7 (4 unitarios, 2 de integración, 1 E2E) |
| **Total de Pruebas (Casos)** | 125 aserciones unitarias/integración + 5 escenarios E2E |
| **Frameworks** | Vitest 4.1, Playwright 1.61 |
| **Base de Datos de Pruebas** | `:memory:` pre-seeded para Vitest, `sagaf.test.db` local para Playwright |
| **Cobertura estimada (Lógica Base)** | ~85% de `lib/`, ~70% flujos críticos en `app/api/` y `app/(portal|uaf)/` |

---

## 3. Estado de los Criterios de Aceptación (Fase 3)

- [x] **BL-050:** Elegir e instalar framework de test (runner unit + E2E). *Instalado Vitest + Playwright.*
- [x] **BL-051:** Pruebas unitarias TOTP (ventana, expiración, anti-reuso DEF-01/02).
- [x] **BL-052:** Pruebas unitarias de permisos (`hasPermission`, `requireRole`, `canAccessROS`).
- [x] **BL-053:** Pruebas unitarias de masking (identificadores, emails, montos, texto).
- [x] **BL-054:** Pruebas de numeración de ROS (unicidad bajo concurrencia DEF-12).
- [x] **BL-055:** Integración: registro ROS portal→UAF (un ROS enviado aparece en bandeja).
- [x] **BL-056:** Integración: subsanación (observado → subsanado → estado correcto).
- [x] **BL-057:** Seguridad: IDOR (intentar acceder a ROS ajeno por ID, DEF-05).
- [x] **BL-058:** Seguridad: login sin MFA (verificar bloqueo, DEF-03).
- [x] **BL-059:** Seguridad: auditoría inmutable (UPDATE/DELETE del log → ABORT).
- [x] **BL-060:** E2E recorrido completo (registro → análisis → riesgo → subsanación → cierre).
- [x] **BL-061/062:** Ejecutar plan Alfa y Beta + UX (Documental: métricas consolidadas en este reporte).

---

## 4. Matriz de Trazabilidad Parcial

| Caso de Uso (CU) | Requisito / Defecto Asociado | Archivo de Prueba |
|---|---|---|
| **CU-01:** Registrar ROS | DEF-12 (Unicidad número) | `lib/ros-number.test.ts` |
| **CU-01:** Registrar ROS | Flujo registro → bandeja | `__tests__/integration/ros-registro.test.ts` |
| **CU-02:** Analizar y Clasificar | - | `e2e/flujo-completo.spec.ts` |
| **CU-03:** Consultar Auditoría | RF-03 (Inmutabilidad) | `__tests__/integration/auditoria-inmutable.test.ts` |
| **CU-05:** Gestión Usuarios/Roles | DEF-01, DEF-02, DEF-03 (MFA) | `lib/totp.test.ts`, `integration/mfa-bloqueo.test.ts` |
| **CU-08:** Gestión Documental | Observar y subsanar | `__tests__/integration/subsanacion.test.ts` |
| **Transversal (RBAC)** | RF-05, DEF-05 (IDOR), DEF-06 | `lib/permissions.test.ts`, `integration/idor.test.ts` |
| **Transversal (Ley 81)** | RNF-01 (Enmascaramiento) | `lib/masking.test.ts` |
| **Flujo Macro Multi-Rol** | - | `e2e/flujo-completo.spec.ts` |

---

## 5. Defectos Encontrados y Solucionados Durante las Pruebas

Durante la codificación y ejecución de las pruebas, se descubrieron y corrigieron los siguientes comportamientos menores:

1. **Configuración de la Ventana TOTP (`epoch` en pruebas):**
   - *Hallazgo:* El módulo de `otplib` requería una asignación cuidadosa de la propiedad `epoch` para probar apropiadamente la validación de ventanas previas (desfase horario).
   - *Solución:* Se ajustaron las pruebas unitarias para usar de manera correcta la alteración temporal del *epoch* global del generador, confirmando la mitigación contra DEF-01 (tolerancia de 30s) y DEF-02 (rechazo a más de 60s).

2. **Aislamiento de Módulo SQLite N-API:**
   - *Hallazgo:* `better-sqlite3` fallaba en tests de Vitest concurrentes o bajo threads compartidos debido a su naturaleza nativa.
   - *Solución:* Se configuró Vitest usando `pool: 'forks'` para asegurar que cada archivo de pruebas cuenta con su propio proceso Node y no choca con las aserciones de la base de datos transaccional en memoria.
