# SAGAF — Sistema Automatizado de Gestión de Análisis Financiero

> **Parcial 2 · Ingeniería de Software Aplicada IV** · Universidad Tecnológica de Panamá · Grupo 1GS241 · 2026
>
> MVP funcional del sistema descrito en *Parcial ISA 4 V2.0.docx*. Implementa
> **portal público autenticado** (sujetos obligados) y **sistema interno UAF**,
> conforme a la **Ley 23 de 2015** (PLA/FT) y la **Ley 81 de 2019** (Protección
> de Datos Personales).

---



## 📋 Stack

| Capa | Tecnología |
| --- | --- |
| Framework | **Next.js 14** (App Router, Server Components, Server Actions) |
| Lenguaje | TypeScript (strict) |
| UI | React 18 + Tailwind CSS + CSS Variables (paleta del `Prototipo.html`) |
| Backend | Next.js Route Handlers (API REST) |
| Base de datos | **SQLite** vía `better-sqlite3` (archivo local `db/sagaf.db`) |
| Auth | **NextAuth v5** + Credentials Provider + JWT |
| MFA | **TOTP real** (RFC 6238) vía `otplib` + QR (`qrcode`) — compatible con Google/Microsoft Authenticator, Authy, 1Password |
| Validación | Zod |
| Hashing | bcrypt (`bcryptjs`) |

---

## 🚀 Instalación y arranque

### Requisitos
- **Node.js 18.18+** (recomendado 20+)
- Windows / macOS / Linux

### Pasos

```bash
# 1. Instalar dependencias
pnpm install

# 2. Inicializar la base de datos (crea db/sagaf.db con el schema)
pnpm db:init

# 3. Cargar datos iniciales (usuarios, plantillas, personas)
pnpm db:seed

# 4. Levantar el servidor de desarrollo
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000) — serás redirigido a `/login`.

> **Reset completo**: `pnpm db:reset` elimina `db/sagaf.db`, reinicializa y vuelve a sembrar.

---

## 🐳 Docker Compose

Alternativa para levantar el proyecto sin necesidad de instalar Node.js directamente en tu máquina.

### Requisitos
- **Docker** 20.10+
- **Docker Compose** v2+

### Pasos

```bash
# 1. Construir la imagen y levantar el contenedor
#    - Se inicializa la BD automáticamente si no existe
#    - Se ejecuta seed para cargar los usuarios demo
#    - El puerto 3000 se mapea al host
docker-compose up --build

# 2. Detener y eliminar contenedor
# docker-compose down

# 3. Resetear la base de datos (elimina volumen y vuelve a construir)
# docker-compose down -v && docker-compose up --build
```

### Configuración

- **Volumen persistente**: `./db-data` en tu máquina se monta en `/app/db-data` del contenedor para que la base de datos SQLite sobreviva a reinicios del contenedor. **Importante**: no se monta sobre `/app/db` para no ocultar los scripts `init.ts` y `seed.ts` del contenedor.
- **Variables de entorno**: `docker-compose.yml` lee automáticamente tu `.env.local` (ya existe en el proyecto). Asegúrate de que contenga al menos:
  ```env
  AUTH_SECRET=bf7f99824c8e483c175a26052df64eab3426c7a07e248b3b8350ce3ffe450705
  AUTH_TRUST_HOST=true
  ```
- **Nota**: `better-sqlite3` requiere compilación nativa. El Dockerfile instala `python3`, `make` y `g++` para compilarlo correctamente.

> **Nota**: En producción, cambia `AUTH_SECRET` por un valor seguro generado con `openssl rand -base64 32` y elimina `AUTH_TRUST_HOST=true` (reemplázalo por el dominio real en `AUTH_URL`).

---

## 🔐 Credenciales

Todas las cuentas usan la contraseña **`password123`** (hash bcrypt en BD).
Al primer login, cada cuenta deberá **enrolar MFA** escaneando el QR con su autenticador.

| Rol | Correo | Acceso |
| --- | --- | --- |
| 🏦 Sujeto Obligado · Banco | `cumplimiento@banconacional.com.pa` | `/portal` |
| 🏠 Sujeto Obligado · Inmobiliaria | `cumplimiento@inmobiliariaistmo.com.pa` | `/portal` |
| 🔎 Analista UAF | `analista@uaf.gob.pa` | `/uaf` |
| 👤 Supervisor UAF | `supervisor@uaf.gob.pa` | `/uaf` (puede cerrar + exportar) |
| 🛡️ Auditor Interno | `auditor@uaf.gob.pa` | `/auditor` (solo lectura) |
| ⚙️ Administrador | `admin@uaf.gob.pa` | `/admin` |

### Personas para verificación (Ley 81)

El portal público devuelve **únicamente el nombre** si la cédula/RUC/pasaporte existe — nunca dirección, teléfono, actividad u otros datos sensibles (RF-06 / DEF-09 mitigado).

Los datos se almacenan en la **tabla `personas` de la base de datos SQLite**. Esta tabla asocia cada identificador (cédula, pasaporte o RUC) con su nombre. **La verificación del identificador es obligatoria** antes de enviar un ROS: el usuario debe hacer clic en *Verificar* para cada parte involucrada. Si el identificador existe, se muestra el nombre registrado; si no existe, el usuario debe ingresar el nombre manualmente tras verificar. Al enviar el ROS, si el identificador no estaba registrado, se guarda automáticamente en la tabla `personas` para que esté disponible en futuras verificaciones.

En producción, este mecanismo podría integrarse con una API gubernamental real (Tribunal Electoral / Registro Público), pero para fines académicos el directorio se mantiene en la misma base de datos.

Algunos identificadores de prueba:

| Identificador | Tipo | Nombre |
| --- | --- | --- |
| `8-888-888` | Cédula panameña | María Elena González |
| `8-482-917` | Cédula panameña | Carlos Alberto Pérez |
| `8-095-221` | Cédula panameña | Ana Lucía Morales |
| `8-777-444` | Cédula panameña | Roberto Antonio Castillo |
| `2-147-836` | Cédula panameña | Lucía del Carmen Rodríguez |
| `PE-8891` | Pasaporte (Venezuela) | Luis Eduardo Herrera |
| `CO-441892` | Pasaporte (Colombia) | Valentina Ospina Ríos |
| `MX-2019-773` | Pasaporte (México) | Alejandro Torres Guzmán |
| `US-AB991234` | Pasaporte (EE. UU.) | Jennifer Diane Mitchell |
| `CN-G88721045` | Pasaporte (China) | Wei Zhong Liu |
| `RUC-77` | RUC empresa | Inversiones del Istmo, S.A. |
| `RUC-45892301` | RUC empresa | Constructora Horizonte Verde, S.A. |
| `RUC-88776655` | RUC empresa | Holding Pacific Group Corp. |

---

## 🗺️ Arquitectura del proyecto

```
sagaf-app/
├── app/
│   ├── login/                  Página de credenciales (paso 1 del MFA)
│   ├── mfa/
│   │   ├── setup/              Enrolamiento TOTP con QR (primer login)
│   │   └── verify/             Verificación TOTP (logins subsiguientes)
│   ├── portal/                 SUJETO OBLIGADO (CU-01, CU-08)
│   │   ├── ros/                Mis ROS, nuevo ROS, detalle
│   │   └── subsanaciones/      Solicitudes pendientes
│   ├── uaf/                    ANALISTA / SUPERVISOR UAF (CU-02, CU-07, CU-04)
│   │   ├── ros/[id]/           Expediente con tabs Resumen/Riesgo/Docs/Vínculos/Auditoría
│   │   ├── vinculos/           Vinculación intersectorial (CU-07)
│   │   ├── reportes/           Reportes e inteligencia (CU-04)
│   │   └── auditoria/          Log de auditoría
│   ├── auditor/                AUDITOR (CU-03) — solo lectura
│   ├── admin/                  ADMINISTRADOR (CU-05, CU-06)
│   │   ├── usuarios/
│   │   ├── sujetos-obligados/
│   │   └── plantillas/          (CU-06 — listado + editor de campos/documentos por plantilla)
│   └── api/                    Route Handlers REST
│       ├── auth/[...nextauth]/
│       ├── mfa/{setup,verify}/
│       ├── ros/                CU-01 · POST nuevo, PATCH estado
│       ├── ros/[id]/{riesgo,subsanacion}/
│       ├── personas/verify/    RF-06 · solo devuelve `{found, nombre}`
│       ├── documentos/{upload, [id], [id]/file}/   RF-07
│       ├── vinculos/           CU-07
│       ├── usuarios/           CU-05
│       ├── sujetos-obligados/  CU-06
│       ├── reportes/           CU-04 · export CSV (solo Supervisor)
│       └── auditoria/          CU-03
├── lib/
│   ├── db.ts                   Singleton SQLite
│   ├── totp.ts                 TOTP RFC 6238 (otplib)
│   ├── audit.ts                Log inmutable; hora del servidor (DEF-30)
│   ├── permissions.ts          RBAC + assertions; canAccessROS (DEF-05)
│   ├── masking.ts              Enmascaramiento Ley 81
│   ├── persons.ts              Lookup Ley 81: solo nombre en portal (fuente: tabla personas en SQLite)
│   └── ros-number.ts           Número único ROS-YYYY-NNNNNN (DEF-12 mitigado)
├── components/
│   ├── Sidebar.tsx · TopBar.tsx · KpiCard.tsx · Badge.tsx
│   ├── InfoBox.tsx · Notice.tsx · ProgressBar.tsx · Timeline.tsx
│   ├── AuditTable.tsx · AuditFilters.tsx
├── db/
│   ├── schema.sql              16+ tablas (diagrama de clases UML)
│   ├── seed.ts                 6 usuarios, 2 SO, 5 plantillas (banco×2, inmobiliaria, casino, notarios), 70 docs req. — sin ROS precargados (registro manual)
│   └── init.ts · reset.ts
├── types/                      Tipos del dominio + ext NextAuth
├── auth.ts · auth.config.ts    NextAuth v5 (con flujo MFA)
└── middleware.ts               Protección de rutas por rol + MFA
```

---

## 📁 Carpeta `docs/` — Documentación del proyecto

Toda la documentación técnica y de contexto del proyecto vive en la carpeta `docs/`. Es el punto de entrada para entender las decisiones de diseño, los criterios aplicados y el estado de la implementación.

| Archivo | Contenido |
| --- | --- |
| `Parcial ISA 4 V2.0.docx` | Documento académico original entregado por el docente. Contiene la especificación del proyecto, requisitos funcionales y no funcionales, casos de uso, criterios de aceptación, plan de pruebas y matriz de defectos. Es la **fuente primaria** del sistema. |
| `criterio_documental_ros.md` | Descripción de cada documento requerido en las tres plantillas activas (Banco · Persona Natural, Banco · Persona Jurídica, Inmobiliaria). Explica qué es cada documento, por qué se clasificó como **obligatorio**, **condicional** u **opcional**, y qué valor aporta al análisis de la UAF. Incluye notas de implementación sobre los campos `tipo_requerimiento` y `obligatorio` en la BD. |
| `manual_usuario.md` | Manual de uso del sistema dirigido al usuario final: cómo registrar un ROS, cómo atender subsanaciones, cómo usar la bandeja UAF, etc. |
| `planificacion_sagaf.md` | Plan de desarrollo por fases, decisiones de arquitectura y justificación de los 5 roles del sistema (incluyendo el Auditor Interno implícito en CU-03). |
| `reporte_pruebas_fase3.md` | Resultados de las pruebas de la Fase 3: cobertura, casos ejecutados, defectos encontrados y estado de mitigación. |
| `metricas_finales_sagaf.md` | Métricas finales del proyecto: líneas de código, cobertura de CUs/RFs/RNFs, defectos mitigados y estadísticas de implementación. |

> La carpeta `Contexto/` en la raíz del proyecto contiene los archivos originales entregados por el docente: el PDF del parcial, los 4 diagramas UML de casos de uso, el diagrama de clases y el prototipo HTML semi-funcional de referencia.

---

## ✅ Cumplimiento de requisitos del documento académico

### Requisitos funcionales

| ID | Implementación |
| --- | --- |
| **RF-01** Recepción y registro de ROS | `/portal/ros/nuevo` + `POST /api/ros`. Número único `ROS-YYYY-NNNNNN` (`lib/ros-number.ts`, atomic en transacción → previene **DEF-12**). Formulario dinámico por sector (banco/inmobiliaria) |
| **RF-02** Búsqueda, filtrado y clasificación | `/uaf` con filtros (q, tipo, riesgo, estado). `POST /api/ros/[id]/riesgo` requiere justificación ≥15 caracteres. Historial visible |
| **RF-03** Trazabilidad y auditoría | `lib/audit.ts` registra cada acción (usuario, rol, fecha servidor, IP, UA, recurso, criticidad). Trigger `ABORT` en BD evita UPDATE/DELETE del log |
| **RF-04** Reportes e inteligencia | `/uaf/reportes` con KPIs, agregados por sector, distribución de riesgo, tiempos, completitud documental. Exportación CSV con marca de agua y restricción de rol |
| **RF-05** Control de acceso por roles | 5 roles, `middleware.ts` + assertions en backend. MFA obligatorio. Sujetos obligados solo ven sus propios ROS (previene **DEF-05** IDOR) |
| **RF-06** Validación segura de identidad | `POST /api/personas/verify` consulta la tabla `personas` de SQLite y retorna **únicamente** `{found, nombre}`. **La verificación es obligatoria** antes de enviar el ROS; si no existe, se crea al enviar. Mitiga **DEF-09**. En banco se valida ordenante y beneficiario **por separado** (mitiga **DEF-11**) |
| **RF-07** Carga documental individualizada | `POST /api/documentos/upload` con `documento_requerido_id` por archivo. Estado `pendiente/cargado/observado/validado/no_aplica`. Mitiga **DEF-15**. Clasificación de tres niveles por plantilla: **obligatorio** (bloquea el envío si falta), **condicional** (advertencia, depende de la operación) y **opcional** (complementario). Criterio y descripción de cada documento en `docs/criterio_documental_ros.md` |

### Requisitos no funcionales

| ID | Implementación |
| --- | --- |
| **RNF-01** Seguridad y privacidad | bcrypt + JWT + TOTP real. Portal NO autocompleta datos sensibles. **DEF-01/02/03** mitigados (ventana TOTP estricta, expiración validada, MFA bloqueante) |
| **RNF-02** Control de acceso por roles | RBAC backend + middleware. Admin NO tiene acceso libre a contenido sensible. |
| **RNF-03** Trazabilidad | Auditoría completa con IP, UA, recurso, detalle JSON, criticidad. Hora del servidor (mitiga **DEF-30**). |
| **RNF-04** Usabilidad | Rediseño visual completo: glassmorphism, micro-animaciones, tipografía mejorada y paleta institucional extendida. Formularios solo con campos pertinentes según sector. |
| **RNF-05** Gestión documental controlada | Un contenedor por requisito, hash SHA-256 del archivo, descarga auditada. |
| **RNF-06** Integridad de datos | Zod en cada endpoint, normalización de identificadores (mitiga **DEF-10**). Monto como `REAL` (mitiga **DEF-35**). |
| **RNF-07** Rendimiento | SQLite con WAL + PRAGMAs. Índices en `ros`, `parte_involucrada`, `documento_adjunto`, `evento_auditoria`. |

### Casos de uso

| CU | Páginas / endpoints |
| --- | --- |
| **CU-01** Recepción de ROS | `/portal/ros/nuevo` + `POST /api/ros` + `POST /api/documentos/upload` |
| **CU-02** Búsqueda y clasificación | `/uaf` + `/uaf/ros/[id]` + `POST /api/ros/[id]/riesgo` |
| **CU-03** Auditoría | `/auditor` + `/uaf/auditoria` + `GET /api/auditoria` |
| **CU-04** Reportes | `/uaf/reportes` + `GET /api/reportes` |
| **CU-05** Control de acceso | `/admin/usuarios` + `POST/PATCH /api/usuarios` |
| **CU-06** Gestión sujetos obligados | `/admin/sujetos-obligados` + `POST/PATCH /api/sujetos-obligados` |
| **CU-07** Vinculación intersectorial | `/uaf/vinculos` + `PATCH /api/vinculos` (requiere validación humana) |
| **CU-08** Gestión documental y subsanación | `/portal/subsanaciones` + `POST /api/ros/[id]/subsanacion` + `PATCH /api/documentos/[id]` |

---

## 🛡️ Defectos de la matriz mitigados

| Defecto | Mitigación |
| --- | --- |
| **DEF-01** MFA por desfase horario | `otplib` con `window: 1` (tolera ±30s, sin laxitud) |
| **DEF-02** Códigos MFA vencidos | Validación estricta de expiración via `authenticator.check` |
| **DEF-03** Login sin completar MFA | `auth.config.ts` redirige a `/mfa/verify` mientras `mfaVerified === false` |
| **DEF-05** IDOR (acceso a ROS de otra entidad) | `canAccessROS()` en BD + middleware + verificación por endpoint |
| **DEF-06** Validación de permisos solo en frontend | RBAC en backend con `requirePermission()` que arroja `ForbiddenError` |
| **DEF-09** Autocompletado de datos sensibles | `POST /api/personas/verify` consulta la tabla `personas` de SQLite y solo devuelve `{found, nombre}` |
| **DEF-10** Búsqueda falla por formato | `normalizeIdentifier()` + `tryVariants()` en `lib/persons.ts` |
| **DEF-11** Ordenante/beneficiario comparten estado | Cada parte tiene su propio `useState` en `NuevoRosForm.tsx` |
| **DEF-12** Números de ROS duplicados | `generateNumeroROS()` con transacción atómica |
| **DEF-13** Doble envío del botón | `submitting` state que deshabilita el botón |
| **DEF-15** Archivo en contenedor equivocado | `documento_requerido_id` enviado y validado server-side |
| **DEF-30** Hora del cliente en auditoría | `CURRENT_TIMESTAMP` de SQLite (hora del servidor) |
| **DEF-35** Montos como texto | Columna `monto REAL` + Zod `z.number().positive()` |

---

## 🧪 Cómo probar el sistema

1. **Login como Banco**: `cumplimiento@banconacional.com.pa` / `password123`
   - Enrola MFA con tu app autenticadora (escanea QR o pega la clave manual).
   - Verás `/portal` sin ROS precargados; registra el primero con *Registrar nuevo ROS*.
   - Click en *”Registrar nuevo ROS”*. **Verifica** con cédula `8-888-888` → debería mostrar “María Elena González” y nada más (la base de datos solo almacena nombre e identificador; otros datos sensibles nunca se exponen al portal). Si usas un identificador que no existe, ingresa el nombre manualmente tras verificar.
   - Sube archivos a cada requisito documental (mín. 5 para probar). Envía.

2. **Login como Analista UAF**: `analista@uaf.gob.pa` / `password123`
   - `/uaf` muestra los ROS recibidos. Filtra por *Alto riesgo*.
   - Abre el expediente, ve a la pestaña **Riesgo**, clasifica con justificación.
   - Ve a **Documentos** → marca uno como *observado* con una observación.
   - Solicita subsanación. El ROS pasa a estado `subsanacion`.

3. **Login como Sujeto Obligado de nuevo**: vuelve a `/portal/subsanaciones` → atiende la solicitud subiendo el archivo corregido. El estado del documento vuelve a `cargado`.

4. **Login como Supervisor**: además puede cerrar casos y exportar CSV en `/uaf/reportes`.

5. **Login como Auditor**: `auditor@uaf.gob.pa` → `/auditor` muestra el log completo de TODAS las acciones, **sin** acceso al contenido de los ROS.

6. **Login como Admin**: `/admin` → crear usuarios, sujetos obligados y **plantillas ROS** (con sus campos y documentos requeridos, CU-06).

---

## 📊 Métricas para la entrega (PPT secciones 1-3)

- **Líneas de código (sin contar dependencias)**: ~ 5.5k LOC TS/TSX + ~ 800 LOC SQL/CSS
- **Cobertura de CUs**: 8/8 implementados
- **Cobertura de RFs**: 7/7 implementados
- **Cobertura de RNFs**: 7/7 implementados
- **Defectos mitigados** (de la matriz): 13 documentados en este README

### Compilación y verificación

```bash
pnpm typecheck   # Validación estática TypeScript
pnpm lint        # ESLint
pnpm build       # Build de producción
```

---

## ⚠️ Notas para producción

Este MVP académico **NO** está listo para producción tal cual. Para producción se requeriría:

- `AUTH_SECRET` generado aleatoriamente y rotado (`openssl rand -base64 32`)
- Reemplazar SQLite por PostgreSQL/MariaDB con replicación
- Reemplazar storage local por S3/MinIO con cifrado del lado del servidor
- Reverse proxy (Nginx/Caddy) + TLS forzado
- Headers de seguridad (CSP, HSTS, X-Frame-Options)
- Backup automatizado y plan de recuperación
- Pen-testing externo

> **Ya implementado en este MVP**: cifrado AES-256-CBC at-rest del `mfa_secret` en BD, rate limiting en `/api/auth/*` y `/api/mfa/*`.

---

## 📚 Referencias del documento académico

- **Ley 23 de 27 de abril de 2015** — Prevención de blanqueo de capitales (Asamblea Nacional de Panamá)
- **Ley 81 de 26 de marzo de 2019** — Protección de datos personales (Asamblea Nacional de Panamá)
- **Recomendaciones del GAFI** (2023)
- **Manuales de Calidad de ROS** — UAF Panamá (2018) — fuente del listado de documentos requeridos por sector
- **Microsoft** — MFA / Microsoft Entra
- **CloudFlare** — TLS
- **Progress** — AES-256



## 🛟 Troubleshooting

- **El código MFA no funciona** → revisa la hora de tu dispositivo (DEF-01 del documento). El servidor usa hora del SO local.
- **`Error: SQLITE_BUSY`** → otro proceso tiene el archivo abierto. Ejecuta `pnpm db:reset` para reiniciar limpio.
- **El QR no se muestra** → asegúrate de haber completado el primer paso de credenciales antes de `/mfa/setup`.
- **Build de producción falla por `better-sqlite3`** → `next.config.js` ya lo declara como `serverComponentsExternalPackages`. En Windows, instalar primero `windows-build-tools` o usar Node con prebuilt binaries.
