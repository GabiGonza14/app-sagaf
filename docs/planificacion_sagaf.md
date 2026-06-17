# Planificación Maestra — SAGAF

> **Sistema Automatizado de Gestión de Análisis Financiero (UAF Panamá)**
> Parcial 2 · Ingeniería de Software Aplicada IV · UTP · Grupo 1GS241 · 2026
>
> Documento de arquitectura, análisis funcional y gestión de proyecto.
> Hoja de ruta para llevar SAGAF de su estado actual (MVP funcional avanzado) a un producto **terminado**.

---

## Metadatos del documento

| Atributo | Valor |
|---|---|
| **Versión del documento** | 1.1 |
| **Fecha de elaboración** | 16 de junio de 2026 |
| **Última revisión** | 16 de junio de 2026 — resolución de discrepancias contra la fuente de la verdad (ver [Anexo A](#anexo-a--fuente-de-la-verdad-y-decisiones-tomadas) y [Changelog](#changelog)) |
| **Autor del análisis** | Rol combinado: Arquitecto de Software · Analista Funcional · Project Manager |
| **Fuentes analizadas** | `README.md`, `docs/Parcial ISA 4 V2.0.docx`, `Contexto/CONTEXTO.md`, código fuente del repositorio (`app/`, `lib/`, `db/`, `components/`, `types/`) |
| **Alcance** | Planificación del trabajo restante. **No** contiene código ni implementación. |
| **Estado del proyecto** | MVP funcional avanzado — 8/8 CU con base implementada; pendiente endurecimiento, pruebas, cierre de extensibilidad y saneamiento |

> **Nota sobre la ruta de este archivo.** El enunciado solicitaba ubicarlo en una carpeta `docx/`. En el repositorio no existe tal carpeta: el documento académico fuente reside en `docs/`. Por coherencia (mantener el plan junto a su documento origen) este archivo se creó en **`docs/planificacion_sagaf.md`**. Si se requiere la ruta literal `docx/`, basta con mover el archivo.

> **Nota sobre el diseño visual.** Conforme a la indicación recibida, **no se toma ningún prototipo HTML externo como referencia**. La paleta institucional, los componentes y la estructura de interfaz **ya forman parte del proyecto actual** (definidos en `app/globals.css` y `components/`). Todas las recomendaciones de UX/UI parten de lo ya construido, no de un prototipo.

> ### ⚖️ Jerarquía de fuentes de la verdad
>
> Por decisión expresa, ante cualquier conflicto se aplica este orden de autoridad:
>
> 1. **`docs/Parcial ISA 4 V2.0.docx`** — **fuente de la verdad**. Si algo no cuadra, **gana el documento académico**.
> 2. **Código fuente del repositorio** — canónico **solo cuando el docx guarda silencio** (p. ej. datos de *seed*, detalles de implementación no especificados).
> 3. **`README.md` y `CLAUDE.md`** — material descriptivo; **deben alinearse** a (1) y (2). Donde los contradigan, están equivocados y se corrigen.
>
> Bajo esta regla, las discrepancias detectadas en la v1.0 **ya no quedan como "pendientes": se resuelven** en el [Anexo A](#anexo-a--fuente-de-la-verdad-y-decisiones-tomadas), tomando la decisión a favor del docx donde habla y de forma razonada donde calla.

---

## Tabla de contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado actual del proyecto](#2-estado-actual-del-proyecto)
3. [Arquitectura funcional](#3-arquitectura-funcional)
4. [Roadmap — plan por fases](#4-roadmap--plan-por-fases)
5. [Backlog detallado](#5-backlog-detallado)
6. [Historias de usuario](#6-historias-de-usuario)
7. [Casos de uso principales](#7-casos-de-uso-principales)
8. [Flujo completo del negocio](#8-flujo-completo-del-negocio)
9. [Matriz de permisos por rol](#9-matriz-de-permisos-por-rol)
10. [Seguridad y control](#10-seguridad-y-control)
11. [UX / UI](#11-ux--ui)
12. [Deuda técnica y riesgos](#12-deuda-técnica-y-riesgos)
13. [Definición de proyecto terminado](#13-definición-de-proyecto-terminado)
14. [Recomendaciones del arquitecto](#14-recomendaciones-del-arquitecto)
15. [Anexo A — Fuente de la verdad y decisiones tomadas](#anexo-a--fuente-de-la-verdad-y-decisiones-tomadas)
16. [Changelog](#changelog)

---

## 1. Resumen ejecutivo

### 1.1 ¿Qué es SAGAF?

**SAGAF** (Sistema Automatizado de Gestión de Análisis Financiero) es una aplicación web para la **Unidad de Análisis Financiero (UAF) de Panamá** que digitaliza y estandariza el ciclo de vida de los **Reportes de Operaciones Sospechosas (ROS)**: recepción, validación, análisis, clasificación de riesgo, gestión documental, vinculación intersectorial, auditoría y reportería.

El sistema converge dos marcos legales que normalmente entran en tensión:

- **Ley 23 de 2015** (Prevención de Blanqueo de Capitales, FT y FPADM): obliga a debida diligencia, monitoreo continuo y reporte de operaciones sospechosas.
- **Ley 81 de 2019** (Protección de Datos Personales): exige minimización, finalidad, proporcionalidad y *Privacy by Design*.

Adicionalmente se apoya en las **Recomendaciones del GAFI** (enfoque basado en riesgo) y en los **Manuales de Calidad de ROS** de la UAF.

### 1.2 Problema que resuelve

| Deficiencia del proceso actual | Cómo la resuelve SAGAF |
|---|---|
| Registro y análisis fragmentado entre sectores | Formulario dinámico por tipo de sujeto obligado + plantillas ROS |
| Validación débil de partes (ordenante vs. beneficiario) | Verificación independiente por cédula/RUC para cada parte |
| Carga documental en bloque, sin control | Un contenedor por documento requerido, con estado individual |
| Riesgo de exponer datos personales en el portal | El portal **solo** devuelve el nombre para corroboración (Ley 81) |
| Falta de trazabilidad interna | Bandeja UAF + expediente + log de auditoría inmutable |

### 1.3 Objetivo del sistema

Mejorar la **recepción, trazabilidad, priorización, control documental y análisis** de los ROS, **sin sustituir el análisis humano** ni determinar culpabilidad. SAGAF es una herramienta de apoyo a la decisión, no un sistema de juicio automático.

### 1.4 Flujo principal de operación (visión macro)

```
Sujeto Obligado (Portal)                       UAF (Sistema Interno)
─────────────────────────                      ─────────────────────────
Login + MFA                                    Login + MFA
   │                                              │
   ▼                                              ▼
Registrar ROS (formulario dinámico)            Bandeja de ROS recibidos
   │  · valida identidad (solo nombre)            │  · filtra / prioriza
   │  · carga documentos por contenedor           ▼
   │  · envía a la UAF ──────────────────────►  Abrir expediente
   │                                              │  · clasifica riesgo (justificado)
   ▼                                              │  · revisa/observa/valida documentos
Atender subsanaciones ◄───── solicita ──────────┤  · solicita subsanación
                                                  │  · vincula casos (validación humana)
                                                  ▼
                              Reportes / Cierre · Supervisor
                                                  │
                                                  ▼
                              Auditoría inmutable (todo el ciclo)
```

---

## 2. Estado actual del proyecto

> Evaluación basada en inspección directa del código del repositorio (rama `final`), no solo del README.

### 2.1 Stack tecnológico verificado

| Capa | Tecnología | Confirmado en |
|---|---|---|
| Framework | Next.js 14.2 (App Router, Server Components, Route Handlers) | `package.json` |
| Lenguaje | TypeScript 5.6 (strict) | `package.json`, `tsconfig` |
| UI | React 18.3 + Tailwind 3.4 + CSS Variables | `app/globals.css` |
| Base de datos | SQLite (`better-sqlite3` 11.3, WAL) | `lib/db.ts`, `db/schema.sql` |
| Auth | NextAuth v5 beta + JWT + bcryptjs | `auth.ts`, `auth.config.ts` |
| MFA | TOTP RFC 6238 (`otplib`) + QR (`qrcode`) | `lib/totp.ts` |
| Validación | Zod 3.23 | endpoints `app/api/**` |
| Despliegue | Dockerfile + docker-compose + entrypoint | raíz del repo |

### 2.2 Mapa de completitud por módulo

**Leyenda:** ✅ Implementado y verificado · 🟡 Parcial / incompleto · 🔴 Faltante o ausente

| Módulo | Estado | Observaciones (verificadas en código) |
|---|---|---|
| Autenticación (credenciales + JWT) | ✅ | `auth.ts`, login en dos pasos |
| MFA TOTP (setup + verify) | ✅ | Enrolamiento con QR, verificación bloqueante |
| RBAC backend (`requirePermission`, `canAccessROS`) | ✅ | `lib/permissions.ts`, tabla `rol_permiso` |
| Middleware de protección por rol + MFA | ✅ | `middleware.ts` + `auth.config.ts` |
| Portal — Registro de ROS (banco/inmobiliaria/genérico) | ✅ | `NuevoRosForm.tsx` (921 líneas) |
| Portal — Borrador de ROS | ✅ | `modo: 'borrador'` en `api/ros` |
| Portal — Listado / detalle / edición de ROS propios | ✅ | `app/portal/ros/**` |
| Portal — Subsanaciones | ✅ | `app/portal/subsanaciones` + reenvío de docs |
| Validación de identidad (solo nombre) | ✅ | `api/personas/verify` → `{found, nombre}` |
| Detección de duplicidad (CU-01 A6) | ✅ | `api/ros/duplicado` |
| Carga documental individual + estados | ✅ | `api/documentos/upload`, hash SHA-256, MIME/ext/size |
| Documento "no aplica" con justificación | ✅ | `api/documentos/no-aplica` |
| UAF — Bandeja + filtros + búsqueda | ✅ | `app/uaf/page.tsx`, `api/ros/search` |
| UAF — Expediente con pestañas | ✅ | `ExpedienteTabs.tsx` (Resumen/Riesgo/Docs/Vínculos/Auditoría) |
| UAF — Clasificación de riesgo justificada + historial | ✅ | `api/ros/[id]/riesgo`, tabla `riesgo_caso` |
| UAF — Asignación de ROS a analista | ✅ | `api/ros/[id]/asignar`, tabla `asignacion_ros` |
| UAF — Vinculación intersectorial (detectar + confirmar) | ✅ | `api/vinculos`, `api/vinculos/detectar` |
| UAF — Reportes (4 tipos) + export CSV (solo supervisor) | ✅ | `api/reportes`, con marca de agua y auditoría |
| Auditoría — Log inmutable + triggers ABORT | ✅ | `db/schema.sql`, `lib/audit.ts`, hora del servidor |
| Auditor — Vista solo lectura | ✅ | `app/auditor` |
| Admin — Gestión de usuarios | ✅ | `app/admin/usuarios` + API |
| Admin — Gestión de sujetos obligados | ✅ | `app/admin/sujetos-obligados` + API |
| **Admin — Gestión de plantillas (UI)** | 🔴 | **No existe `app/admin/plantillas`**; solo hay `api/plantillas/route.ts`. README/CLAUDE.md la dan por hecha, pero la página falta. **Obligatoria** según **CU-06** (ver Anexo A-3) |
| **Formulario verdaderamente data-driven** (`campo_plantilla`) | 🟡 | La tabla `campo_plantilla` existe pero **no se usa**: los campos están **hardcoded** por sector en `NuevoRosForm.tsx`. Solo cubre `bank`/`realestate`/`generic`. **RF-01 + CU-06 RE-02 exigen dinamismo** (ver Anexo A-6) |
| **Notificaciones de subsanación** | 🟡 | Solo página in-app de subsanaciones; sin aviso persistente ni alerta de vencimiento. **`CA-CU08-03` y `CU-08 A4` la exigen → es requisito, no opcional** (ver Anexo A-7) |
| **Expiración de sesión por inactividad (DEF-04)** | 🔴 | `session: { strategy: 'jwt' }` **sin `maxAge`** ni *idle timeout* |
| **Suite de pruebas automatizadas** | 🔴 | **Cero** archivos de prueba; sin framework de test en `package.json` |
| **Cifrado at-rest del `mfa_secret`** | 🔴 | Almacenado en claro (reconocido como pendiente de producción) |
| **Almacenamiento de archivos fuera de `public/`** | 🔴 | Por defecto `./public/uploads` (riesgo de acceso directo sin auth) |

### 2.3 Funcionalidad implementada **más allá** de lo documentado

El código está más avanzado que el README en varios puntos (no documentados o subdocumentados):

- `api/ros/search` — búsqueda avanzada server-side.
- `api/ros/duplicado` — alerta de duplicidad (flujo alterno A6 de CU-01).
- `api/ros/[id]/asignar` + tabla `asignacion_ros` — asignación formal de casos a analistas.
- `api/vinculos/detectar` — sugerencia automática de vínculos (con confirmación humana).
- `api/documentos/no-aplica` — estado `no_aplica` con justificación.
- Modo **borrador** de ROS.

### 2.4 Cobertura declarada vs. real

| Métrica | README declara | Realidad verificada |
|---|---|---|
| Casos de uso | 8/8 | 8/8 con base; CU-06 incompleto (falta UI de plantillas) |
| RF | 7/7 | 7/7 con base; RF-01 dinámico es **parcial** (hardcoded) |
| RNF | 7/7 | RNF-01/03 fuertes; RNF-07 (respaldo/recuperación) sin evidencia |
| Defectos mitigados | 13 | 13 verificados; faltan DEF-04 y varios DEF-16…DEF-40 sin tratar |
| ROS precargados | "sin ROS precargados" | ✅ **Resuelto:** el seed ya **no** inserta ROS (decisión: registro manual, CU-01). README/CLAUDE.md alineados |
| Plantillas / docs | "3 plantillas, 56 docs" | **5 plantillas / 70 docs req.** (avaladas por Figura 1 del docx; ver A-10) — docs corregidos |

---

## 3. Arquitectura funcional

El sistema se descompone en los siguientes módulos funcionales. Cada uno tiene una responsabilidad única y fronteras claras.

### 3.1 Módulo de Autenticación y MFA
- **Responsabilidad:** identidad de usuarios, login por credenciales (bcrypt), enrolamiento y verificación TOTP, emisión y validación de sesión JWT, redirección forzada al flujo MFA.
- **Piezas:** `auth.ts`, `auth.config.ts`, `app/login`, `app/mfa/*`, `lib/totp.ts`, `middleware.ts`.
- **Reglas clave:** MFA obligatorio y bloqueante; no hay acceso a vistas protegidas hasta `mfaVerified === true`.

### 3.2 Módulo de Control de Acceso (RBAC)
- **Responsabilidad:** definir roles, permisos y reglas de pertenencia; **siempre** validar en backend.
- **Piezas:** `lib/permissions.ts`, tablas `rol`/`permiso`/`rol_permiso`, `canAccessROS()`.
- **Reglas clave:** permisos nunca confiados al frontend; sujeto obligado solo accede a ROS propios (anti-IDOR).

### 3.3 Módulo Portal Público (Sujeto Obligado)
- **Responsabilidad:** registro de ROS (formulario dinámico por sector), verificación de identidad sin exponer datos, carga documental individual, gestión de borradores, atención de subsanaciones.
- **Piezas:** `app/portal/**`, `app/api/ros`, `app/api/documentos`, `app/api/personas/verify`.

### 3.4 Módulo de Gestión de ROS
- **Responsabilidad:** ciclo de vida del ROS (estados), numeración única atómica, partes involucradas, operación sospechosa, persistencia transaccional.
- **Piezas:** `api/ros/route.ts`, `lib/ros-number.ts`, tablas `ros`, `parte_involucrada`, `operacion_sospechosa`.

### 3.5 Módulo de Gestión Documental
- **Responsabilidad:** contenedor por documento requerido, estados (pendiente/cargado/observado/validado/no_aplica), hash de integridad, descarga auditada, subsanación.
- **Piezas:** `api/documentos/**`, tablas `documento_requerido`, `documento_adjunto`, `solicitud_subsanacion`.

### 3.6 Módulo Vista Interna UAF
- **Responsabilidad:** bandeja priorizada, filtros, expediente con pestañas, acciones de análisis.
- **Piezas:** `app/uaf/**`, `FilterBar.tsx`, `ExpedienteTabs.tsx`.

### 3.7 Submódulo Analistas
- **Responsabilidad:** clasificar riesgo con justificación, revisar/observar documentos, solicitar subsanación, proponer vínculos. Acceso acotado a casos asignados.

### 3.8 Submódulo Supervisores
- **Responsabilidad:** acciones críticas (cierre de casos), aprobación, asignación de ROS, **exportación** de reportes.

### 3.9 Módulo de Vinculación Intersectorial
- **Responsabilidad:** detectar coincidencias entre ROS (persona, beneficiario, sociedad, cuenta, inmueble, documento, dirección) y registrar la decisión humana (confirmar/descartar/pendiente).
- **Piezas:** `api/vinculos/**`, tabla `vinculo_intersectorial`.

### 3.10 Módulo de Administración
- **Responsabilidad:** usuarios + roles + MFA, sujetos obligados, **plantillas ROS** (pendiente de UI).
- **Piezas:** `app/admin/**`, `api/usuarios`, `api/sujetos-obligados`, `api/plantillas`.

### 3.11 Módulo de Auditoría
- **Responsabilidad:** registro inmutable de toda acción significativa; consulta filtrada; eventos de seguridad.
- **Piezas:** `lib/audit.ts`, `api/auditoria`, `app/auditor`, `app/uaf/auditoria`, tabla `evento_auditoria` con triggers ABORT.

### 3.12 Módulo de Reportes e Inteligencia
- **Responsabilidad:** reportes operativos/documentales/estadísticos/inteligencia, datos agregados, exportación controlada y auditada.
- **Piezas:** `app/uaf/reportes`, `api/reportes`.

### 3.13 Módulo de Configuración / Plantillas (transversal)
- **Responsabilidad:** definición de plantillas por sector (campos + documentos requeridos). **Hoy parcial**: documentos sí son data-driven; los **campos** del formulario están hardcoded.

---

## 4. Roadmap — plan por fases

> El orden prioriza primero **estabilizar y sanear** lo existente, luego **cerrar funcionalidad faltante**, después **endurecer seguridad**, **probar**, **pulir UX** y finalmente **documentar y entregar**. Las fases son incrementales; cada una deja el sistema en estado entregable.

### Fase 0 — Estabilización y saneamiento

- **Objetivo:** eliminar deuda evidente y reconciliar documentación antes de construir encima.
- **Alcance:** limpieza de logs de depuración, reconciliación de README/CLAUDE.md con la realidad del código, corrección de inconsistencias del seed, verificación de build/typecheck/lint en limpio.
- **Tareas:** ver backlog `BL-001` … `BL-008`.
- **Dependencias:** ninguna (punto de partida).
- **Riesgos:** que la limpieza de logs oculte trazas útiles para depurar MFA → mitigar con logger condicionado por entorno.
- **Entregables:** repositorio sin `console.log` de depuración; documentación alineada; build verde.
- **Criterios de aceptación:**
  - [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` pasan sin errores.
  - [ ] No quedan `console.log` de depuración en `app/`, `lib/`, `auth.config.ts`.
  - [ ] README y CLAUDE.md describen el estado real (rutas, conteo de ROS/usuarios/docs).

### Fase 1 — Cierre de funcionalidad núcleo

- **Objetivo:** completar lo que el alcance académico exige y hoy está parcial o ausente.
- **Alcance:** UI de gestión de plantillas (CU-06), formulario **data-driven** desde `campo_plantilla`, notificación de subsanación, completar flujos de borrador y "no aplica" en UI.
- **Tareas:** `BL-010` … `BL-022`.
- **Dependencias:** Fase 0.
- **Riesgos:** migrar el formulario hardcoded a data-driven puede romper validaciones de sector (DEF-07/DEF-08) → mitigar con pruebas por plantilla.
- **Entregables:** CU-06 completo; alta de un sector nuevo **sin tocar código**; subsanación notificada.
- **Criterios de aceptación:**
  - [ ] Un admin puede crear/editar/activar una plantilla con sus campos y documentos desde la UI.
  - [ ] Crear un sujeto obligado de un sector nuevo y registrar un ROS válido sin cambios de código.
  - [ ] El sujeto obligado recibe aviso visible de cada subsanación solicitada.

### Fase 2 — Seguridad y cumplimiento legal

- **Objetivo:** cerrar los defectos críticos/altos pendientes y reforzar Ley 81 / RNF-01.
- **Alcance:** expiración de sesión (DEF-04), cifrado at-rest de `mfa_secret`, almacenamiento de archivos fuera de `public/`, *rate limiting* en auth/MFA, cabeceras de seguridad (CSP/HSTS/X-Frame-Options), revisión de enmascarado en todas las superficies, política de retención y derechos ARCO.
- **Tareas:** `BL-030` … `BL-045`.
- **Dependencias:** Fase 0; idealmente tras Fase 1.
- **Riesgos:** romper el login en producción al endurecer cookies/headers → mitigar en *staging*.
- **Entregables:** informe de seguridad con defectos cerrados; checklist de cumplimiento Ley 81.
- **Criterios de aceptación:**
  - [ ] Sesión expira por inactividad y exige re-MFA.
  - [ ] `mfa_secret` no se almacena en claro.
  - [ ] Ningún documento es descargable sin autenticación y autorización.
  - [ ] Auth/MFA con *rate limiting*; cabeceras de seguridad presentes.

### Fase 3 — Calidad y pruebas

- **Objetivo:** dar cobertura de pruebas y ejecutar el plan Alfa/Beta/UX del documento académico.
- **Alcance:** pruebas unitarias (TOTP, permisos, masking, numeración), de integración (flujo ROS portal→UAF), de seguridad (IDOR, MFA, auditoría inmutable) y E2E de los recorridos principales.
- **Tareas:** `BL-050` … `BL-062`.
- **Dependencias:** Fases 1 y 2 (probar funcionalidad estable y endurecida).
- **Riesgos:** falta de tiempo para E2E → priorizar pruebas de seguridad y de los CU críticos.
- **Entregables:** suite ejecutable en CI; reporte de pruebas Alfa/Beta/UX; matriz CU↔prueba.
- **Criterios de aceptación:**
  - [ ] Casos de seguridad (DEF-01/02/03/05/06/09/12) cubiertos por pruebas automáticas.
  - [ ] Flujo completo ROS (registro → análisis → subsanación → cierre) cubierto por E2E.
  - [ ] Reporte Alfa/Beta/UX con métricas del documento académico.

### Fase 4 — UX/UI y accesibilidad

- **Objetivo:** pulir experiencia, estados vacíos, mensajes y responsive sobre el diseño existente.
- **Alcance:** estados vacíos consistentes, mensajes de error específicos (anti-DEF-39), foco/teclado, contraste, verificación de breakpoints, microcopys en español.
- **Tareas:** `BL-070` … `BL-082`.
- **Dependencias:** Fase 1.
- **Riesgos:** *scope creep* visual → limitar a criterios de accesibilidad y consistencia, no rediseño.
- **Entregables:** checklist UX/accesibilidad aprobado; capturas antes/después.
- **Criterios de aceptación:**
  - [ ] Toda lista tiene estado vacío con guía de acción.
  - [ ] No quedan mensajes genéricos tipo "Error inesperado".
  - [ ] Recorridos clave navegables por teclado; contraste AA en componentes principales.

### Fase 5 — Documentación, despliegue y entrega

- **Objetivo:** dejar el proyecto listo para entrega académica y operación demo.
- **Alcance:** manual de usuario por rol, guía de despliegue (Docker), respaldo/recuperación (RNF-07), métricas para PPT, video/demo guion.
- **Tareas:** `BL-090` … `BL-098`.
- **Dependencias:** todas las anteriores.
- **Riesgos:** desincronización entre demo y código → congelar rama de entrega.
- **Entregables:** documentación final + script de respaldo + métricas de entrega.
- **Criterios de aceptación:**
  - [ ] Despliegue reproducible con un comando documentado.
  - [ ] Procedimiento de respaldo/restauración probado.
  - [ ] PPT secciones 1–3 con métricas reales.

### 4.1 Vista de dependencias entre fases

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5
  │                      ▲           ▲
  └──────────────────────┘           │
        (seguridad puede iniciar     (pruebas dependen de
         en paralelo tras F0)         funcionalidad + seguridad)
```

---

## 5. Backlog detallado

> Tareas pequeñas y accionables. **Prioridad:** Alta / Media / Baja. **Dificultad:** Baja / Media / Alta. Todas inician en estado **Pendiente**.

### 5.1 Fase 0 — Estabilización

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-001 | Sustituir `console.log` por logger | Reemplazar los ~45 `console.log` (incl. `auth.config.ts`) por un logger condicionado por entorno; no registrar roles/IDs en claro | Alta | Baja | Transversal | — | Pendiente |
| BL-002 | Quitar ROS precargados + reconciliar docs | **Hecho:** se eliminó el bloque de ROS demo de `db/seed.ts` (registro manual); README/CLAUDE.md dicen "sin ROS precargados" | Media | Baja | Documentación/DB | — | **Hecho ✓** |
| BL-003 | Reconciliar conteos del seed | **Hecho:** conteos verificados y documentados — 6 usuarios, 2 SO, **5 plantillas**, **70 docs req.**, 0 ROS (ver A-10) | Baja | Baja | Documentación | BL-002 | **Hecho ✓** |
| BL-004 | Corregir referencia a `/admin/plantillas` | README/CLAUDE.md la citan como existente; marcarla como pendiente hasta implementarla (BL-010) | Media | Baja | Documentación | — | Pendiente |
| BL-005 | Verificar build/lint/typecheck limpios | Dejar evidencia de `pnpm typecheck && pnpm lint && pnpm build` en verde | Alta | Baja | Transversal | BL-001 | Pendiente |
| BL-006 | Resolver TODO/FIXME pendiente | Atender el marcador de deuda detectado en el código | Baja | Baja | Transversal | — | Pendiente |
| BL-007 | Documentar decisión de roles (5) | **Decisión tomada (Anexo A-4):** se mantienen **5 roles**; el Auditor está respaldado por **CU-03**. Solo falta dejarlo asentado en README/CLAUDE.md | Baja | Baja | Documentación | — | Pendiente |
| BL-008 | Saneo de comentarios de "Prototipo.html" | Comentarios en `globals.css` referencian el prototipo; actualizar para reflejar que el diseño ya es del proyecto | Baja | Baja | UI | — | Pendiente |

### 5.2 Fase 1 — Funcionalidad núcleo

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-010 | UI de gestión de plantillas (listado) | Página admin para listar plantillas ROS con estado activa/inactiva | Alta | Media | Admin/Plantillas | BL-005 | Pendiente |
| BL-011 | UI alta/edición de plantilla | Crear/editar plantilla: nombre, versión, tipo/sector, activa | Alta | Media | Admin/Plantillas | BL-010 | Pendiente |
| BL-012 | UI gestión de campos de plantilla | CRUD de `campo_plantilla` (nombre, tipo_dato, obligatorio, orden, regla) | Alta | Alta | Admin/Plantillas | BL-011 | Pendiente |
| BL-013 | UI gestión de documentos requeridos | CRUD de `documento_requerido` por plantilla | Alta | Media | Admin/Plantillas | BL-011 | Pendiente |
| BL-014 | Asociar plantilla ↔ sujeto obligado | UI para vincular plantillas a un SO (tabla `sujeto_obligado_plantilla`) | Alta | Media | Admin | BL-011 | Pendiente |
| BL-015 | Renderizado data-driven de campos | Que `NuevoRosForm` lea `campo_plantilla` y genere campos dinámicamente | Alta | Alta | Portal/ROS | BL-012 | Pendiente |
| BL-016 | Validación server-side por `campo_plantilla` | Validar el ROS contra la definición de la plantilla (no hardcoded) | Alta | Alta | Gestión ROS | BL-015 | Pendiente |
| BL-017 | Limpieza de estado al cambiar plantilla | Garantizar que no queden campos previos al cambiar de tipo (anti-DEF-08) | Alta | Media | Portal/ROS | BL-015 | Pendiente |
| BL-018 | Mapeo correcto tipo→plantilla | Asegurar que el tipo de SO mapee a la plantilla correcta (anti-DEF-07) | Alta | Media | Portal/ROS | BL-015 | Pendiente |
| BL-019 | Notificación in-app de subsanación **(requerido)** | Indicador/badge persistente al SO cuando hay subsanación pendiente. **Mínimo para cumplir CA-CU08-03** (el docx exige notificar) | **Alta** | Media | Documental | — | Pendiente |
| BL-020 | Notificación por correo *(refuerzo)* | Aviso de subsanación al oficial de cumplimiento; complementa BL-019 | Media | Media | Documental | BL-019 | Pendiente |
| BL-021 | Alerta de subsanación vencida (CU-08 A4) **(requerido)** | Marcar/alertar subsanaciones que superan `fecha_limite`. **Exigido por CU-08 A4** | **Alta** | Media | Documental | — | Pendiente |
| BL-022 | Completar flujo de borrador en UI | Listar, retomar y enviar borradores desde el portal | Media | Baja | Portal/ROS | — | Pendiente |

### 5.3 Fase 2 — Seguridad y cumplimiento

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-030 | Expiración de sesión por inactividad | Configurar `maxAge`/idle timeout en JWT (cierra DEF-04) | Alta | Baja | Auth | — | Pendiente |
| BL-031 | Re-verificación MFA tras expirar | Forzar `/mfa/verify` al reanudar sesión vencida | Alta | Media | Auth/MFA | BL-030 | Pendiente |
| BL-032 | Cifrado at-rest de `mfa_secret` | Cifrar el secreto TOTP en BD (AES-256) | Alta | Media | Auth/MFA | — | Pendiente |
| BL-033 | Mover uploads fuera de `public/` | Almacenar archivos en ruta no servida estáticamente; servir solo vía endpoint autenticado | Alta | Media | Documental/Seguridad | — | Pendiente |
| BL-034 | Verificar descarga 100% autenticada | Confirmar que `documentos/[id]/file` valida pertenencia y audita | Alta | Baja | Documental/Seguridad | BL-033 | Pendiente |
| BL-035 | Rate limiting en `/api/auth/*` y `/api/mfa/*` | Limitar intentos para mitigar fuerza bruta | Alta | Media | Seguridad | — | Pendiente |
| BL-036 | Cabeceras de seguridad | CSP, HSTS, X-Frame-Options, X-Content-Type-Options | Media | Media | Seguridad | — | Pendiente |
| BL-037 | Validación profunda de archivos (magic bytes) | No confiar solo en MIME/extensión; verificar firma del archivo | Media | Media | Documental/Seguridad | BL-033 | Pendiente |
| BL-038 | Revisión integral de enmascarado | Auditar que ningún endpoint/vista filtre datos sensibles (Ley 81) | Alta | Media | Seguridad | — | Pendiente |
| BL-039 | Normalización de búsqueda (anti-DEF-25) | Normalizar acentos/mayúsculas/guiones en búsquedas de la UAF | Media | Baja | UAF | — | Pendiente |
| BL-040 | Auditar consultas de auditoría | Asegurar que ver el log también se audita (CU-03 postcondición) | Media | Baja | Auditoría | — | Pendiente |
| BL-041 | Política de retención de datos | Definir y documentar retención/borrado conforme Ley 81 | Media | Media | Cumplimiento | — | Pendiente |
| BL-042 | Soporte a derechos ARCO | Procedimiento para Acceso/Rectificación/Cancelación/Oposición | Baja | Alta | Cumplimiento | BL-041 | Pendiente |
| BL-043 | Endurecer `AUTH_SECRET` y `.env` | Documentar generación/rotación; quitar `AUTH_TRUST_HOST` en prod | Media | Baja | Seguridad | — | Pendiente |
| BL-044 | Bloqueo de cuenta tras N fallos | Política de bloqueo temporal por intentos fallidos | Media | Media | Auth/Seguridad | BL-035 | Pendiente |
| BL-045 | Revisión anti-IDOR en todos los endpoints | Verificar `canAccessROS`/pertenencia en cada ruta `[id]` | Alta | Media | Seguridad | — | Pendiente |

### 5.4 Fase 3 — Pruebas

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-050 | Elegir e instalar framework de test | Seleccionar runner (unit + E2E) e integrarlo al repo | Alta | Baja | Calidad | — | Pendiente |
| BL-051 | Pruebas unitarias TOTP | Ventana, expiración, anti-reuso (DEF-01/02) | Alta | Media | Calidad/Auth | BL-050 | Pendiente |
| BL-052 | Pruebas unitarias de permisos | `hasPermission`, `requireRole`, `canAccessROS` | Alta | Baja | Calidad/RBAC | BL-050 | Pendiente |
| BL-053 | Pruebas unitarias de masking | Enmascarado de identificadores/emails/montos/texto | Alta | Baja | Calidad | BL-050 | Pendiente |
| BL-054 | Pruebas de numeración de ROS | Unicidad bajo concurrencia (DEF-12) | Alta | Media | Calidad | BL-050 | Pendiente |
| BL-055 | Integración registro ROS portal→UAF | Un ROS enviado aparece en bandeja UAF | Alta | Media | Calidad | BL-050 | Pendiente |
| BL-056 | Integración subsanación | Documento observado → subsanado → estado correcto | Alta | Media | Calidad | BL-050 | Pendiente |
| BL-057 | Seguridad: IDOR | Intentar acceder a ROS ajeno por ID (DEF-05) | Alta | Media | Calidad/Seguridad | BL-050 | Pendiente |
| BL-058 | Seguridad: login sin MFA | Verificar bloqueo (DEF-03) | Alta | Baja | Calidad/Seguridad | BL-050 | Pendiente |
| BL-059 | Seguridad: auditoría inmutable | Intentar UPDATE/DELETE del log → ABORT | Alta | Baja | Calidad/Seguridad | BL-050 | Pendiente |
| BL-060 | E2E recorrido completo | Registro → análisis → riesgo → subsanación → cierre | Alta | Alta | Calidad | BL-055,BL-056 | Pendiente |
| BL-061 | Ejecutar plan Alfa | Pruebas funcionales/integración/seguridad/rendimiento del documento | Media | Media | Calidad | BL-060 | Pendiente |
| BL-062 | Ejecutar plan Beta + UX | Escenarios con usuarios representativos y métricas | Media | Media | Calidad | BL-061 | Pendiente |

### 5.5 Fase 4 — UX/UI

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-070 | Inventario de estados vacíos | Detectar listas sin estado vacío y diseñarlos | Media | Baja | UI | — | Pendiente |
| BL-071 | Estados vacíos consistentes | Implementar empty-states con guía de acción | Media | Baja | UI | BL-070 | Pendiente |
| BL-072 | Mensajes de error específicos | Eliminar genéricos "Error inesperado" (anti-DEF-39) | Media | Media | UI | — | Pendiente |
| BL-073 | Estados de carga/spinners | Feedback en acciones asíncronas (subida, envío) | Baja | Baja | UI | — | Pendiente |
| BL-074 | Verificación de breakpoints | Probar 1150/900/768/640/480/400 px en vistas clave | Media | Media | UI/Responsive | — | Pendiente |
| BL-075 | Navegación por teclado | Foco visible y orden lógico en formularios/tabs | Media | Media | Accesibilidad | — | Pendiente |
| BL-076 | Contraste y `aria-*` | Verificar AA y etiquetas accesibles | Media | Media | Accesibilidad | — | Pendiente |
| BL-077 | Confirmaciones de acciones críticas | Modal de confirmación en cierre/subsanación/desactivar usuario | Media | Baja | UI | — | Pendiente |
| BL-078 | Indicadores de completitud documental | Consistencia de contadores "x/y documentos" en todas las vistas | Baja | Baja | UI | — | Pendiente |
| BL-079 | Microcopys en español claro | Revisar textos de ayuda y validación | Baja | Baja | UI | — | Pendiente |
| BL-080 | Consistencia de badges/estados | Unificar colores y nombres de estados de ROS/documentos | Baja | Baja | UI | — | Pendiente |
| BL-081 | Tooltips de datos enmascarados | Explicar por qué un dato está enmascarado/bloqueado | Baja | Baja | UI | — | Pendiente |
| BL-082 | Feedback de duplicidad (A6) | Mostrar aviso claro de posible ROS duplicado | Media | Baja | UI/ROS | — | Pendiente |

### 5.6 Fase 5 — Documentación y entrega

| ID | Título | Descripción | Prioridad | Dificultad | Módulo | Dependencias | Estado |
|---|---|---|---|---|---|---|---|
| BL-090 | Manual de usuario por rol | Guías cortas para SO, analista, supervisor, auditor, admin | Media | Media | Documentación | — | Pendiente |
| BL-091 | Guía de despliegue actualizada | Docker + variables + reset, validada paso a paso | Media | Baja | Documentación | — | Pendiente |
| BL-092 | Procedimiento de respaldo/recuperación | Script y guía para respaldar/restaurar la BD (RNF-07) | Media | Media | Operación | — | Pendiente |
| BL-093 | Matriz de trazabilidad RF/RNF/CU↔código | Tabla viva que mapee requisitos a archivos y pruebas | Media | Media | Documentación | BL-060 | Pendiente |
| BL-094 | Métricas para PPT (secciones 1–3) | LOC, cobertura CU/RF/RNF, defectos mitigados (reales) | Media | Baja | Documentación | — | Pendiente |
| BL-095 | Guion de demo | Recorrido reproducible para la sustentación | Baja | Baja | Documentación | — | Pendiente |
| BL-096 | Acotar formalmente la matriz de defectos | **Decisión (Anexo A-5):** DEF-16…DEF-40 **no están definidos en la fuente** y **no se inventan**. Alcance accionable = DEF-01…DEF-15 + los nombrados en el impacto (DEF-25/30/35/36/38/39). Documentar este acotamiento | Media | Baja | Documentación | — | Pendiente |
| BL-097 | Diagrama de despliegue/arquitectura | Diagrama actualizado del sistema real | Baja | Media | Documentación | — | Pendiente |
| BL-098 | Congelar rama de entrega | Tag/rama estable para la evaluación | Media | Baja | Operación | Todas | Pendiente |

---

## 6. Historias de usuario

> Formato: **Como** [rol], **quiero** [acción], **para** [beneficio]. Cada una con criterios de aceptación (CA).

### Portal — Sujeto Obligado

**HU-01 — Registro de ROS**
*Como* sujeto obligado, *quiero* registrar un ROS mediante un formulario adaptado a mi sector, *para* reportar operaciones sospechosas cumpliendo la Ley 23.
- [ ] CA-1: El formulario muestra solo los campos pertinentes a mi tipo (banco/inmobiliaria/otro).
- [ ] CA-2: Al enviar, el sistema asigna un número único `ROS-AAAA-NNNNNN` y fecha/hora de servidor.
- [ ] CA-3: Si faltan campos obligatorios, el envío se bloquea indicando cuáles.
- [ ] CA-4: El ROS queda visible en la bandeja interna de la UAF.

**HU-02 — Verificación de identidad sin exposición**
*Como* sujeto obligado, *quiero* verificar una cédula/RUC, *para* corroborar la identidad sin acceder a datos sensibles.
- [ ] CA-1: Si existe, solo se muestra el nombre.
- [ ] CA-2: No se autocompleta dirección, actividad, contacto ni historial.
- [ ] CA-3: En banco, ordenante y beneficiario se verifican por separado sin sobrescribirse.

**HU-03 — Carga documental individual**
*Como* sujeto obligado, *quiero* subir cada documento en su propio contenedor, *para* saber qué entregué y qué falta.
- [ ] CA-1: Cada documento requerido tiene su contenedor con estado.
- [ ] CA-2: Solo se aceptan formatos y tamaños permitidos.
- [ ] CA-3: Cada archivo queda asociado a su requisito y registrado con hash.

**HU-04 — Atención de subsanaciones**
*Como* sujeto obligado, *quiero* ver y atender solicitudes de subsanación, *para* corregir documentos observados sin crear un ROS nuevo.
- [ ] CA-1: Veo claramente qué documento fue observado y por qué.
- [ ] CA-2: Al reemplazar el archivo, el estado vuelve a "cargado" y la solicitud se marca atendida.
- [ ] CA-3: El ROS permanece asociado (no se duplica).

**HU-05 — Guardar borrador**
*Como* sujeto obligado, *quiero* guardar un ROS como borrador, *para* completarlo más tarde.
- [ ] CA-1: Puedo guardar con campos incompletos en estado `borrador`.
- [ ] CA-2: Puedo retomarlo y enviarlo después.

### Vista UAF — Analista / Supervisor

**HU-06 — Bandeja y filtros**
*Como* analista UAF, *quiero* filtrar la bandeja por riesgo/estado/sector/completitud, *para* priorizar mi trabajo.
- [ ] CA-1: Los filtros respetan mis permisos y solo muestran lo autorizado.
- [ ] CA-2: Los ROS de alto riesgo se destacan.

**HU-07 — Clasificación de riesgo**
*Como* analista UAF, *quiero* clasificar el riesgo con justificación, *para* dejar trazabilidad de la decisión.
- [ ] CA-1: La justificación es obligatoria (mín. definido).
- [ ] CA-2: Se conserva historial de cambios.
- [ ] CA-3: La acción queda auditada.

**HU-08 — Revisión documental y subsanación**
*Como* analista UAF, *quiero* observar documentos y solicitar subsanación, *para* obtener evidencia correcta.
- [ ] CA-1: Puedo marcar documentos como observado/validado.
- [ ] CA-2: La solicitud de subsanación llega al sujeto obligado.

**HU-09 — Vinculación intersectorial**
*Como* analista UAF, *quiero* revisar coincidencias entre ROS, *para* detectar relaciones relevantes.
- [ ] CA-1: El sistema sugiere vínculos pero **no** los consolida automáticamente.
- [ ] CA-2: Confirmar/descartar queda auditado.

**HU-10 — Reportes y exportación**
*Como* supervisor UAF, *quiero* generar y exportar reportes, *para* apoyar el análisis institucional.
- [ ] CA-1: La exportación está restringida a supervisor y queda auditada.
- [ ] CA-2: Los reportes usan datos agregados/enmascarados cuando no se requiere identificación.

### Administración

**HU-11 — Gestión de usuarios y MFA**
*Como* administrador, *quiero* crear/desactivar usuarios y asignar roles, *para* controlar el acceso con mínimo privilegio.
- [ ] CA-1: MFA es obligatorio para todos.
- [ ] CA-2: Todo cambio de rol/estado queda auditado.
- [ ] CA-3: No tengo acceso libre al contenido sensible de los ROS.

**HU-12 — Gestión de plantillas (pendiente de UI)**
*Como* administrador, *quiero* crear plantillas por sector con sus campos y documentos, *para* habilitar nuevos sectores sin reprogramar.
- [ ] CA-1: Puedo definir campos y documentos requeridos.
- [ ] CA-2: Un sujeto obligado de un sector nuevo puede reportar sin cambios de código.

### Auditoría

**HU-13 — Consulta de auditoría**
*Como* auditor interno, *quiero* consultar el log filtrado, *para* reconstruir el ciclo de vida de un ROS.
- [ ] CA-1: Acceso de **solo lectura**; no puedo ver el contenido sensible de los ROS.
- [ ] CA-2: El log no es editable; los intentos se registran como evento de seguridad.

---

## 7. Casos de uso principales

> Resumen funcional de los 8 CU del documento académico, con su estado de implementación.

| CU | Nombre | Actor(es) | Estado |
|---|---|---|---|
| **CU-01** | Recepción, Registro y Gestión de ROS | Sujeto Obligado | ✅ (formulario aún hardcoded por sector) |
| **CU-02** | Búsqueda, Filtrado y Clasificación de Casos | Analista / Supervisor UAF | ✅ |
| **CU-03** | Trazabilidad y Auditoría del Sistema | Auditor / Supervisor / Admin | ✅ |
| **CU-04** | Generación de Reportes e Inteligencia | Supervisor / Analista UAF | ✅ |
| **CU-05** | Control de Acceso y Gestión de Roles | Administrador | ✅ |
| **CU-06** | Gestión de Sujetos Obligados | Admin / Supervisor | 🟡 (falta UI de plantillas) |
| **CU-07** | Vinculación Intersectorial | Analista / Supervisor UAF | ✅ |
| **CU-08** | Gestión Documental y Subsanación | Sujeto Obligado / Analista / Supervisor | ✅ (notificación parcial) |

### Detalle de los CU críticos

**CU-01 — Recepción y Registro de ROS**
Flujo: login+MFA → seleccionar tipo de SO → cargar formulario dinámico → datos generales → partes involucradas (verificación sin exposición) → operación sospechosa → carga documental → validación → envío → número único + bandeja UAF → auditoría.
Flujos alternos: A1 fallo de auth · A2 campos incompletos · A3 documento faltante (borrador/observación) · A4 archivo inválido · A5 identidad existente (solo nombre) · A6 posible duplicidad.
*Pendiente:* migrar el formulario a verdaderamente data-driven (BL-015/016).

**CU-06 — Gestión de Sujetos Obligados**
Flujo: registrar SO con tipo/sector/organismo/estado/responsable → asociar plantilla(s) → habilitar para portal.
Reglas: cada SO debe tener plantilla asignada; admitir nuevos sectores sin rediseñar (RE-02).
*Pendiente:* la **UI de plantillas** no existe; la asociación SO↔plantilla y el alta de campos/documentos por plantilla deben construirse (BL-010…BL-014).

**CU-08 — Gestión Documental y Subsanación**
Flujo: mostrar documentos requeridos → cargar por contenedor → UAF revisa (validar/observar) → solicita subsanación → SO corrige → auditoría.
Reglas: estados pendiente/cargado/observado/validado/no_aplica; subsanar **sin** crear ROS nuevo; alertar vencimiento.
*Pendiente (requerido por el docx, no opcional):* notificación efectiva al SO (CA-CU08-03) y alerta de subsanación vencida (CU-08 A4) — BL-019/021 requeridos, BL-020 refuerzo.

---

## 8. Flujo completo del negocio

Recorrido de un ROS de principio a fin.

1. **Acceso del sujeto obligado.** Inicia sesión con credenciales institucionales; el sistema exige MFA TOTP. Sin MFA verificado no hay acceso a vistas protegidas.
2. **Selección de sector y plantilla.** El SO confirma su tipo; el sistema carga la plantilla ROS correspondiente (campos + documentos requeridos).
3. **Datos generales.** Entidad reportante, oficial de cumplimiento, fecha de detección, descripción inicial.
4. **Partes involucradas.** Verificación por cédula/pasaporte/RUC. Si existe, **solo** se muestra el nombre. En banco, ordenante y beneficiario se verifican por separado.
5. **Operación sospechosa.** Monto (numérico), jurisdicción, producto/bien, tipología, señal de alerta y narrativa.
6. **Carga documental.** Un contenedor por documento requerido; validación de formato/tamaño; hash de integridad; posibilidad de "no aplica" justificado y evidencia adicional.
7. **Envío.** El sistema valida completitud, genera **número único atómico**, registra fecha/hora de servidor y coloca el ROS en la bandeja UAF. Todo en transacción (no quedan ROS sin evidencia). Se alerta posible duplicidad. Se audita.
8. **Recepción en la UAF.** El ROS aparece en la bandeja con indicadores de riesgo, estado y completitud. El supervisor puede asignarlo a un analista.
9. **Análisis.** El analista abre el expediente (Resumen/Riesgo/Documentos/Vínculos/Auditoría), clasifica el riesgo con **justificación obligatoria** e historial.
10. **Revisión documental.** Valida u observa documentos. Si hay faltantes/incorrectos, **solicita subsanación** (sin crear ROS nuevo).
11. **Subsanación.** El SO recibe la solicitud, corrige/reemplaza el documento; el estado se actualiza y la solicitud se marca atendida. Subsanaciones vencidas se alertan.
12. **Vinculación intersectorial.** El sistema sugiere coincidencias con otros ROS; el analista confirma/descarta (validación humana). Se audita.
13. **Reportes.** El supervisor genera reportes operativos/documentales/estadísticos/inteligencia y, con permiso, exporta CSV con marca de agua (auditado).
14. **Cierre.** El supervisor cierra el caso cuando procede; el estado del ROS cambia y queda registrado.
15. **Auditoría transversal.** Cada paso relevante queda en el log inmutable (usuario, rol, fecha/hora servidor, IP, UA, recurso, criticidad), permitiendo reconstruir el ciclo de vida completo.

---

## 9. Matriz de permisos por rol

> Basada en `lib/permissions.ts`, `auth.config.ts`, `canAccessROS()` y las reglas del documento (RF-05, RNF-02, RE de cada CU).
>
> **Sobre el número de roles (decisión tomada — Anexo A-4):** **RF-05** del docx enumera **4 roles operativos** (Sujeto Obligado, Analista, Supervisor, Administrador), pero **CU-03** nombra explícitamente al **Auditor Interno** como actor de solo lectura del log. Por tanto se mantienen **5 roles**: la implementación realiza un actor que el propio docx reconoce, sin contradecirlo.

### 9.1 Acceso por área

| Área / Ruta | Sujeto Obligado | Analista | Supervisor | Auditor | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `/portal` | ✅ (propios) | — | — | — | — |
| `/uaf` | — | ✅ | ✅ | — | — |
| `/auditor` | — | — | — | ✅ | — |
| `/admin` | — | — | — | — | ✅ |
| Exportar reportes | — | ❌ | ✅ | ❌ | ❌ |
| Cerrar caso | — | ❌ | ✅ | ❌ | ❌ |
| Asignar ROS a analista | — | ❌ | ✅ | ❌ | ❌ |

### 9.2 Qué puede hacer / no hacer / ver cada rol

| Rol | Puede hacer | No puede hacer | Puede ver | Puede modificar | Nunca debe ver |
|---|---|---|---|---|---|
| **Sujeto Obligado** | Registrar ROS, cargar docs, atender subsanaciones, guardar borradores | Acceder a ROS de otra entidad; clasificar riesgo; exportar | Sus propios ROS y su estado | Sus ROS en borrador; sus documentos | Datos sensibles de personas verificadas; ROS ajenos |
| **Analista UAF** | Analizar ROS asignados, clasificar riesgo (justificado), observar/validar docs, solicitar subsanación, proponer vínculos | Exportar reportes; cerrar casos; gestionar usuarios | Bandeja UAF, expedientes (según permiso) | Riesgo, estado documental, vínculos (propuesta) | Datos sensibles fuera de finalidad; secretos MFA |
| **Supervisor UAF** | Todo lo del analista + cerrar casos, asignar ROS, **exportar** reportes | Gestionar usuarios/roles (es del admin) | Bandeja, expedientes, reportes | Estado de casos, asignaciones | Secretos de autenticación |
| **Auditor Interno** | Consultar log de auditoría filtrado | Modificar el log; ver contenido sensible de ROS; ejecutar acciones de negocio | El historial de auditoría | **Nada** (solo lectura) | Contenido sensible de los ROS; documentos |
| **Administrador** | Gestionar usuarios/roles/MFA, sujetos obligados, plantillas | **Acceso libre al contenido sensible de ROS sin justificación y auditoría** | Usuarios, SO, plantillas, auditoría administrativa | Cuentas, roles, configuración | Datos sensibles de ROS sin autorización/auditoría |

> **Regla de oro (RNF-02 / RE-03 de CU-05):** el administrador gestiona la plataforma pero **no** es un superusuario de datos. Todo acceso a contenido sensible debe ser justificado y auditado.

---

## 10. Seguridad y control

### 10.1 Controles ya implementados (verificados)

| Control | Implementación | Defecto que mitiga |
|---|---|---|
| MFA TOTP estricto | `otplib` ventana ±30s | DEF-01, DEF-02 |
| MFA bloqueante | `auth.config.ts` redirige a `/mfa/verify` | DEF-03 |
| Anti-IDOR | `canAccessROS()` en BD + endpoint | DEF-05 |
| RBAC en backend | `requirePermission()` / `requireRole()` | DEF-06 |
| No exposición de datos | `personas/verify` → `{found, nombre}` | DEF-09 |
| Normalización de identificadores | `normalizeIdentifier()` | DEF-10 |
| Estado separado ordenante/beneficiario | en `NuevoRosForm` | DEF-11 |
| Numeración atómica | `generateNumeroROS()` en transacción | DEF-12 |
| Anti doble envío | estado `submitting` | DEF-13 |
| ROS transaccional | `db.transaction()` | DEF-14 |
| Documento al contenedor correcto | `documento_requerido_id` validado server-side | DEF-15 |
| Auditoría con hora de servidor | `CURRENT_TIMESTAMP` | DEF-30 |
| Auditoría inmutable | triggers `ABORT` UPDATE/DELETE | RF-03 RE-01 |
| Montos como `REAL` | columna + Zod `number().positive()` | DEF-35 |
| Validación de archivos | MIME + extensión + tamaño + hash SHA-256 | RNF-05 |

### 10.2 Controles pendientes (gaps de seguridad)

| Control faltante | Riesgo | Tarea |
|---|---|---|
| **Expiración de sesión por inactividad** | Sesión abandonada explotable (DEF-04) | BL-030/031 |
| **Cifrado at-rest del `mfa_secret`** | Robo de secretos TOTP desde BD | BL-032 |
| **Archivos fuera de `public/`** | Descarga directa sin auth (fuga Ley 81) | BL-033/034 |
| **Rate limiting auth/MFA** | Fuerza bruta de credenciales/códigos | BL-035 |
| **Cabeceras de seguridad** | Clickjacking, XSS, downgrade | BL-036 |
| **Validación por *magic bytes*** | Archivo malicioso con extensión falsa | BL-037 |
| **Bloqueo por intentos fallidos** | Fuerza bruta sostenida | BL-044 |
| **Política de retención / ARCO** | Incumplimiento Ley 81 | BL-041/042 |
| **Logs de depuración con datos** | Fuga de roles/IDs en consola | BL-001 |

### 10.3 Dimensiones de control

- **Autenticación:** credenciales bcrypt + MFA TOTP obligatorio y bloqueante.
- **Autorización:** RBAC backend + pertenencia (`canAccessROS`) + middleware por ruta. Revisar cobertura en **todos** los `[id]` (BL-045).
- **Validación:** Zod en cada endpoint; normalización de identificadores y montos. Extender a validación data-driven por plantilla (BL-016).
- **Auditoría:** log inmutable, hora de servidor, criticidad; falta auditar la propia consulta de auditoría (BL-040).
- **Cifrado:** TLS en tránsito (prod, vía proxy); pendiente at-rest para secretos (BL-032) y consideración para documentos.
- **Protección de datos (Ley 81):** minimización (solo nombre), enmascarado presentacional; revisar todas las superficies (BL-038) y definir retención/ARCO.
- **Manejo de errores:** mensajes específicos, sin filtrar internals; eliminar genéricos (BL-072).
- **Prevención de exposición:** enmascarado en bandeja/reportes; uploads protegidos; descargas auditadas.

---

## 11. UX / UI

> El diseño visual (paleta institucional, componentes, layout) **ya forma parte del proyecto** (`app/globals.css`, `components/`). Las siguientes son mejoras incrementales **sobre lo existente**, no un rediseño.

### 11.1 Fortalezas actuales
- Sistema de diseño consistente (tokens CSS: `--primary #145c9e`, *soft variants*, sombras, radios).
- Componentes reutilizables: `Sidebar`, `TopBar`, `KpiCard`, `Badge`, `Timeline`, `AuditTable`, `FileDropZone`, `ConfirmModal`, etc.
- Breakpoints responsive definidos (1150/900/768/640/480/400 px).
- Expediente con pestañas y bandeja con KPIs alineados al modelo mental de la UAF.

### 11.2 Mejoras de experiencia
- [ ] **Estados vacíos** con guía de acción en todas las listas (bandeja vacía, sin subsanaciones, sin vínculos) — BL-070/071.
- [ ] **Mensajes de error específicos** (qué campo/documento corregir), eliminando "Error inesperado" — BL-072 (anti-DEF-39).
- [ ] **Feedback asíncrono** (spinners/disabled) en subida y envío — BL-073.
- [ ] **Confirmaciones** en acciones críticas (cerrar caso, desactivar usuario) — BL-077.
- [ ] **Aviso de duplicidad** claro al detectar A6 — BL-082.
- [ ] **Tooltips** que expliquen por qué un dato está enmascarado/bloqueado — BL-081.

### 11.3 Consistencia
- [ ] Unificar nombres/colores de estados de ROS y documentos en todas las vistas — BL-080.
- [ ] Contadores de completitud documental homogéneos ("x/y") — BL-078.
- [ ] Microcopys revisados en español claro — BL-079.

### 11.4 Componentes / estados faltantes
- [ ] UI de **gestión de plantillas** (no existe) — BL-010…BL-013.
- [ ] Indicador persistente de **subsanación pendiente** para el SO — BL-019.
- [ ] Vista/gestión de **borradores** completa — BL-022.

### 11.5 Responsive y accesibilidad
- [ ] Verificación manual de breakpoints en bandeja, expediente y formulario ROS — BL-074.
- [ ] Navegación por teclado con foco visible en formularios y pestañas — BL-075.
- [ ] Contraste AA y atributos `aria-*` en componentes clave — BL-076.

---

## 12. Deuda técnica y riesgos

### 12.1 Deuda técnica identificada (verificada)

| # | Deuda | Evidencia | Impacto |
|---|---|---|---|
| DT-1 | Formulario ROS hardcoded por sector | `campo_plantilla` sin uso; `NuevoRosForm.tsx` con `isBank`/`isRealEstate`/`isGeneric` | Extensibilidad limitada; contradice RE-02 de CU-06 |
| DT-2 | UI de plantillas ausente | No existe `app/admin/plantillas` | CU-06 incompleto |
| DT-3 | ~45 `console.log` de depuración | `auth.config.ts` y otros | Ruido, posible fuga de roles/IDs |
| DT-4 | Sin pruebas automatizadas | Cero archivos de test; sin runner | Riesgo de regresión; no cubre plan Alfa/Beta |
| DT-5 | `mfa_secret` en claro | `schema.sql` (comentario lo admite) | Riesgo si se compromete la BD |
| DT-6 | Uploads bajo `public/` | default `./public/uploads` | Posible descarga sin auth |
| DT-7 | Sin expiración de sesión | `auth.config.ts` sin `maxAge` | DEF-04 abierto |
| DT-8 | Inconsistencias de documentación | README vs. seed vs. CLAUDE.md | Confusión de alcance/métricas → **resueltas en Anexo A** (gana docx/código) |
| DT-9 | Matriz de defectos incompleta | DEF-16…DEF-40 citados pero no definidos **en la propia fuente** | Trazabilidad parcial; **no se inventan** (Anexo A-5) → acotar alcance |
| DT-10 | Notificación de subsanación faltante | Sin aviso persistente ni alerta de vencimiento | **Incumple CA-CU08-03 y CU-08 A4** (es requisito, no opcional) |
| DT-11 | Acoplamiento a SQLite | `better-sqlite3` síncrono | Limita escalado/concurrencia (aceptable para MVP) |

### 12.2 Riesgos del proyecto

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Migrar a formulario data-driven introduce regresiones (DEF-07/08) | Media | Alto | Pruebas por plantilla antes de retirar el hardcoded (BL-015→BL-018, BL-055) |
| Falta de tiempo para pruebas E2E | Alta | Alto | Priorizar pruebas de seguridad y CU críticos (Fase 3) |
| Endurecimiento rompe login en prod | Media | Medio | Validar en *staging*; *feature flags* de seguridad |
| Fuga de datos por uploads públicos | Media | Alto | Mover almacenamiento + descarga autenticada (BL-033/034) |
| Cambios de alcance ("scope creep") en UX | Media | Medio | Limitar Fase 4 a accesibilidad/consistencia |
| Dependencia de NextAuth v5 **beta** | Baja | Medio | Fijar versión; plan de actualización antes de prod |
| Documentación desalineada induce errores | Alta | Bajo | Fase 0 de reconciliación (BL-002…BL-008) |

---

## 13. Definición de proyecto terminado

SAGAF se considerará **terminado** (a nivel de MVP académico robusto) cuando se cumplan **todos** los siguientes bloques.

### 13.1 Funcionalidad
- [ ] 8/8 CU completos, incluido **CU-06 con UI de plantillas**.
- [ ] Formulario ROS **data-driven** (alta de sector nuevo sin tocar código).
- [ ] Subsanación con **notificación** efectiva y alerta de vencimiento.
- [ ] Borradores gestionables de extremo a extremo.

### 13.2 Pruebas
- [ ] Suite automatizada ejecutable (unit + integración + seguridad + E2E de CU críticos).
- [ ] Casos de seguridad clave cubiertos (DEF-01/02/03/05/06/09/12).
- [ ] Plan **Alfa**, **Beta** y **UX** ejecutado y documentado con métricas.

### 13.3 Seguridad
- [ ] DEF-04 cerrado (expiración de sesión + re-MFA).
- [ ] `mfa_secret` cifrado at-rest.
- [ ] Uploads fuera de `public/`, descargas 100% autenticadas y auditadas.
- [ ] Rate limiting en auth/MFA + cabeceras de seguridad.
- [ ] Revisión integral de enmascarado (Ley 81) sin fugas.

### 13.4 Documentación
- [ ] README/CLAUDE.md reconciliados con el código real.
- [ ] Manual de usuario por rol + guía de despliegue + respaldo/recuperación.
- [ ] Matriz de trazabilidad RF/RNF/CU ↔ código ↔ pruebas.
- [ ] Matriz de defectos completa (DEF-01…DEF-40) o justificación de alcance.

### 13.5 Experiencia de usuario
- [ ] Estados vacíos y mensajes de error específicos en todo el sistema.
- [ ] Recorridos clave accesibles por teclado y con contraste AA.
- [ ] Responsive verificado en los breakpoints definidos.

### 13.6 Estabilidad
- [ ] `typecheck` + `lint` + `build` en verde, sin `console.log` de depuración.
- [ ] Sin defectos críticos/altos abiertos de la matriz.
- [ ] Despliegue reproducible (Docker) y procedimiento de respaldo probado.

---

## 14. Recomendaciones del arquitecto

Observaciones y decisiones sugeridas (no explícitas en el documento original) para elevar la calidad del sistema:

1. **Convertir el formulario en data-driven es la decisión de arquitectura más importante pendiente.** La tabla `campo_plantilla` ya existe; usarla cumple RE-02 de CU-06 ("admitir nuevas plantillas sin rediseñar") y elimina DT-1. Recomendación: hacerlo **detrás de pruebas** por plantilla y retirar el hardcoded solo cuando estén verdes.

2. **Introducir una capa de servicios/dominio.** Hoy la lógica vive en los Route Handlers. Extraer servicios (p. ej. `RosService`, `DocumentoService`) facilita pruebas unitarias y reduce duplicación de validaciones de pertenencia/auditoría.

3. **Centralizar el manejo de errores y auditoría.** Un *wrapper* común para endpoints (captura de `ForbiddenError`, auditoría automática de fallos/bloqueos, respuestas consistentes) reduce omisiones y unifica mensajes (apoya BL-040 y BL-072).

4. **Logger por niveles y por entorno.** Sustituir `console.log` por un logger con niveles (`debug`/`info`/`warn`/`error`) silenciado en producción; nunca registrar identificadores o roles sin necesidad.

5. **Tratar los documentos como activos protegidos de primera clase.** Almacenarlos fuera de `public/`, servir siempre por endpoint autenticado con verificación de pertenencia y auditoría, y considerar cifrado at-rest. Es el punto de mayor exposición legal (Ley 81).

6. **Definir el modelo de notificaciones desde ya.** Aunque sea in-app primero (badge/contador), dejar la abstracción lista para email permite cumplir CA-CU08-03 sin reescribir.

7. **Planificar la migración de base de datos.** SQLite es ideal para el MVP, pero documentar el camino a PostgreSQL (tipos, transacciones, índices ya definidos) evita sorpresas si el proyecto escala. Mantener el acceso a datos detrás de una capa fina facilita el cambio.

8. **Completar y versionar la matriz de defectos.** La fuente cita DEF-16…DEF-40 sin definirlos. Recomendación: documentarlos (o acotar formalmente el alcance) para tener trazabilidad cerrada y defendible en la sustentación.

9. **Trazabilidad viva.** Mantener una matriz RF/RNF/CU ↔ archivo ↔ prueba como artefacto vivo del repo; es la mejor evidencia de cobertura para la evaluación académica.

10. **Congelar dependencias sensibles.** NextAuth v5 está en **beta**; fijar versión exacta y registrar un plan de actualización antes de cualquier uso real.

11. **Seguridad como criterio de "Definition of Done", no como fase final.** Incorporar revisiones anti-IDOR y de enmascarado en cada PR que toque endpoints `[id]`.

12. **Preparar datos de demo deterministas.** Un seed estable y documentado (con conteos reales) hace la sustentación reproducible y elimina la inconsistencia actual de documentación.

---

## Anexo A — Fuente de la verdad y decisiones tomadas

> **Regla aplicada:** la fuente de la verdad es **`docs/Parcial ISA 4 V2.0.docx`**. Cada discrepancia detectada en la v1.0 se **resuelve aquí** (ya no son "pendientes"): se decide a favor del docx donde habla, y de forma razonada —tomando el código como canónico— donde el docx calla. Las correcciones a `README.md`/`CLAUDE.md` que se derivan están reflejadas en el backlog (BL-002…BL-008).
>
> Convención de la columna **Decisión**: 🟦 *gana el docx* · ⬜ *docx en silencio → decide el código/criterio*.

| # | Hallazgo | Qué dice la fuente de la verdad (docx) | Decisión tomada | Acción / tarea |
|---|---|---|---|---|
| A-1 | Carpeta `docx/` vs. `docs/` | No aplica (es ruta de archivo, el docx no la define) | ⬜ El plan vive en **`docs/`**, junto a su documento origen | Mover solo si se exige la ruta literal |
| A-2 | ROS precargados en *seed* | El docx **no** especifica datos demo; no exige ni prohíbe ROS de prueba (silencio) | ⬜ **Decisión del proyecto: la BD NO precarga ROS.** Se eliminó el bloque de ROS demo de `db/seed.ts`; los reportes se registran **manualmente** (CU-01). Realinea el README original ("sin ROS precargados"). El seed conserva solo datos fundamentales | **Hecho** en `db/seed.ts`, README y CLAUDE.md — BL-002 ✓ |
| A-3 | `/admin/plantillas` ausente | **CU-06** exige gestión de sujetos obligados **y asociación de plantillas ROS**; **RE-02**: admitir nuevas plantillas sin rediseñar | 🟦 La gestión de plantillas **es obligatoria**. README/CLAUDE.md que la dan por hecha **están equivocados**; la página **debe construirse** | Implementar **BL-010…BL-014**; corregir docs — **BL-004** |
| A-4 | Roles: 4 (RF-05) vs. 5 (código) | **RF-05** enumera 4 roles operativos; **CU-03** nombra a **"Auditor Interno"** como actor de solo lectura | 🟦 **Se mantienen 5 roles.** No contradice el docx: el auditor está **respaldado por CU-03**; RF-05 lista los 4 roles operativos y el auditor es observador de solo lectura del log | Documentar la decisión — **BL-007** |
| A-5 | Matriz de defectos incompleta | El docx **solo define DEF-01…DEF-15** en tabla; cita DEF-16…DEF-40 en el análisis de impacto **sin especificarlos** (nombra explícitamente DEF-25/30/35/36/38/39) | 🟦 **No se inventan defectos.** Alcance accionable = **DEF-01…DEF-15 + los nombrados** en el impacto. BL-096 pasa a **"acotar formalmente"** el alcance (no a inventar la matriz) | Acotar alcance — **BL-096** |
| A-6 | Formulario "dinámico" parcial | **RF-01** exige formulario dinámico por plantilla; **CU-06 RE-02** exige nuevos sectores **sin rediseñar** | 🟦 El formulario **debe ser data-driven** (`campo_plantilla`). El hardcoded actual es **deuda a eliminar**, no el diseño objetivo | Migrar — **BL-015/BL-016/BL-017/BL-018** |
| A-7 | Notificación de subsanación | **CA-CU08-03**: "el sistema **notifica** al sujeto obligado"; **CU-08 A4**: "el sistema **alerta** a la UAF si la subsanación no se atiende en plazo" | 🟦 La notificación **es REQUISITO, no opcional**. El aviso **in-app es el mínimo** para cumplir; el correo es refuerzo. Se elimina la etiqueta "(Opcional)" de BL-020 | In-app **BL-019** (requerido), vencimiento **BL-021** (requerido), correo **BL-020** (refuerzo) |
| A-8 | Comentarios "Prototipo.html" en código | El docx **no** obliga a seguir el prototipo; la indicación recibida es **ignorarlo** | ⬜ Actualizar comentarios; el diseño ya es del proyecto | **BL-008** |
| A-9 | RNF-07 (respaldo/recuperación) | **RNF-07** exige "respaldo de información, recuperación ante fallos y disponibilidad" | 🟦 **Es requisito.** Debe implementarse procedimiento de respaldo/restauración | **BL-092** |
| A-10 | Conteo de plantillas/sectores | **Figura 1 (CU-01)** del docx lista los sectores: **bancos, inmobiliarias, casinos, zonas francas, abogados, contadores, otros sectores regulados**. El **texto** detalla en profundidad solo banco + inmobiliaria | 🟦 Las **5 plantillas** del seed (banco×2, inmobiliaria, **casino**, **notarios**≈abogados) y los **70 docs requeridos** son un **subconjunto autorizado** por la Figura 1. El antiguo "3 plantillas/56 docs" **se quedaba corto**. Pendiente de implementar: **zonas francas** y **contadores** | Conteos corregidos en README/CLAUDE.md (BL-003 ✓); sectores faltantes → extensibilidad (BL-015) |

### A.1 Cambios de criterio aplicados en esta revisión

Resoluciones que **modifican** lo expresado en la v1.0 (por mandato del docx como fuente de la verdad):

- **Notificación de subsanación → de "opcional" a "requerida".** El docx (CA-CU08-03 y CU-08 A4) la exige. Se reclasifican **BL-019** y **BL-021** como **requeridos** y **BL-020** (correo) como **refuerzo**, no como la vía única. Coherente con la sección 5.2, 7 (CU-08) y 12 (DT-10).
- **Gestión de plantillas → de "mejora" a "obligatoria".** CU-06 la exige; deja de ser un "nice to have" y es bloqueante para considerar CU-06 completo.
- **ROS precargados → eliminados por decisión del proyecto.** La BD ya **no** trae ROS demo; se ingresan manualmente (CU-01). Se editó `db/seed.ts` (se quitó el bloque de ROS, operaciones, partes, casos y vínculo) y se realinearon README/CLAUDE.md a "sin ROS precargados". El seed mantiene roles, permisos, sujetos obligados, plantillas, documentos y usuarios.
- **Conteo real de plantillas/docs verificado y anclado a la Figura 1** (A-10): 5 plantillas / 70 docs requeridos; zonas francas y contadores quedan como extensibilidad pendiente.
- **5 roles confirmados como correctos** (no como "desviación a documentar"): el docx los respalda vía CU-03.

---

## Changelog

| Versión | Fecha | Cambios |
|---|---|---|
| **1.2** | 17/06/2026 | **Decisión:** la BD **no precarga ROS** — se eliminó el bloque de ROS demo de `db/seed.ts` (registro manual, CU-01) y se realinearon README/CLAUDE.md. Se **verificaron los conteos reales** del seed y se anclaron a la **Figura 1** del docx (nuevo **A-10**): 5 plantillas / 70 docs; zonas francas y contadores quedan como extensibilidad pendiente. BL-002/BL-003 marcados **Hechos**. |
| **1.1** | 16/06/2026 | Se establece la **jerarquía de fuentes de la verdad** (docx > código > README/CLAUDE.md). El **Anexo A** se reescribe: las inconsistencias dejan de ser "pendientes" y se **resuelven** contra el docx. Se corrige la **notificación de subsanación** (de opcional a requerida, CA-CU08-03/CU-08 A4) y la **gestión de plantillas** (de mejora a obligatoria, CU-06). Se añade este Changelog. |
| **1.0** | 16/06/2026 | Versión inicial: análisis completo del proyecto y las 14 secciones de planificación a partir de README, docx, CONTEXTO.md y código fuente. |

---

> **Fin del documento.** Esta planificación es un artefacto vivo: debe actualizarse al cerrar cada tarea del backlog y al avanzar de fase. El estado inicial de todas las tareas es **Pendiente**. Ante cualquier conflicto futuro, **gana `Parcial ISA 4 V2.0.docx`**.
