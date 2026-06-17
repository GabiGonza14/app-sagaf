# SAGAF — Contexto para Claude Code

> **Antes de comenzar cualquier tarea**, lee este archivo completo.
> Para contexto detallado (requisitos, casos de uso, diagrama de clases, plan de pruebas), revisa la carpeta **`/Contexto/`** — especialmente `CONTEXTO.md`.

---

## ¿Qué es SAGAF?

**Sistema Automatizado de Gestión de Análisis Financiero** — aplicación web académica desarrollada para la **Unidad de Análisis Financiero (UAF) de Panamá**, en el contexto del curso *Ingeniería de Software Aplicada IV* (UTP, Grupo 1GS241, 2026).

Su objetivo es digitalizar y estandarizar el proceso de recepción, análisis y seguimiento de **Reportes de Operaciones Sospechosas (ROS)**, cumpliendo con:
- **Ley 23 de 2015** — Prevención del Lavado de Activos y Financiamiento del Terrorismo (PLA/FT)
- **Ley 81 de 2019** — Protección de Datos Personales (Privacy by Design)
- Estándares **GAFI** (Grupo de Acción Financiera Internacional)

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router, Server Components, Server Actions) |
| Lenguaje | TypeScript 5 (modo estricto) |
| UI | React 18 + Tailwind CSS 3 |
| Base de datos | SQLite vía `better-sqlite3` (modo WAL, archivo: `db/sagaf.db`) |
| Autenticación | NextAuth v5 (beta) + bcryptjs |
| MFA | TOTP RFC 6238 vía `otplib` + `qrcode` |
| Validación | Zod 3 |
| Iconos | lucide-react |

---

## Arquitectura del Proyecto

```
sagaf-app/
├── app/                  # Páginas y API routes (Next.js App Router)
│   ├── login/            # Paso 1: credenciales
│   ├── mfa/setup|verify/ # Paso 2: MFA TOTP
│   ├── portal/           # Rol: sujeto_obligado (CU-01, CU-08)
│   ├── uaf/              # Roles: analista, supervisor (CU-02, CU-04, CU-07)
│   ├── auditor/          # Rol: auditor (CU-03, solo lectura)
│   ├── admin/            # Rol: admin (CU-05, CU-06)
│   └── api/              # REST endpoints (auth, ros, mfa, docs, reportes, auditoria...)
├── lib/                  # Utilidades compartidas
│   ├── db.ts             # Singleton SQLite (WAL + FK)
│   ├── totp.ts           # TOTP RFC 6238
│   ├── audit.ts          # Log de auditoría inmutable
│   ├── permissions.ts    # RBAC — requirePermission(), canAccessROS()
│   ├── masking.ts        # Enmascarado Ley 81 (identificadores, emails, montos)
│   ├── persons.ts        # Verificación de identidad (RF-06)
│   └── ros-number.ts     # Generación atómica de número ROS
├── types/index.ts        # Tipos de dominio (Role, RosEstado, RiesgoNivel, etc.)
├── components/           # Componentes UI reutilizables
├── db/
│   ├── schema.sql        # Esquema relacional (16+ tablas)
│   ├── seed.ts           # Datos base (6 usuarios, 2 orgs, 5 plantillas, 70 docs, 0 ROS — sin precarga)
│   ├── init.ts           # Inicialización
│   └── reset.ts          # Reset completo
├── auth.ts               # Configuración NextAuth v5
├── middleware.ts         # Protección de rutas por rol + MFA
└── Contexto/             # ← DOCUMENTACIÓN COMPLETA DEL PROYECTO
    ├── CONTEXTO.md       # Requisitos, CUs, diagrama de clases, defectos, etc.
    └── *.png / *.pdf     # Diagramas UML, especificación académica
```

---

## Roles del Sistema

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `sujeto_obligado` | `/portal` | Bancos/inmobiliarias que reportan ROS |
| `analista` | `/uaf` | Analiza y clasifica ROS |
| `supervisor` | `/uaf` + reportes exportables | Supervisa análisis, genera reportes |
| `auditor` | `/auditor` | Solo lee el log de auditoría |
| `admin` | `/admin` | Gestiona usuarios, organizaciones y plantillas |

---

## Flujo de Autenticación

1. `POST /login` → credenciales (email + contraseña bcrypt)
2. Si `mfa_activo = false` → redirige a `/mfa/setup` (enrolamiento TOTP con QR)
3. Si `mfa_activo = true` → redirige a `/mfa/verify` (código TOTP)
4. Solo tras `mfaVerified = true` en sesión → acceso a rutas protegidas

---

## Requisitos Funcionales Clave

| RF | Descripción | Implementación principal |
|----|-------------|--------------------------|
| RF-01 | Recepción y registro de ROS | `app/portal/ros/nuevo/`, `app/api/ros/` |
| RF-02 | Búsqueda, filtrado y clasificación | `app/uaf/`, `app/api/ros/[id]/riesgo/` |
| RF-03 | Trazabilidad / auditoría | `lib/audit.ts`, `app/api/auditoria/` |
| RF-04 | Reportes e inteligencia | `app/uaf/reportes/`, `app/api/reportes/` |
| RF-05 | Control de acceso por roles + MFA | `auth.ts`, `middleware.ts`, `lib/permissions.ts` |
| RF-06 | Verificación segura de identidad | `lib/persons.ts`, `app/api/personas/verify/` |
| RF-07 | Gestión documental individual | `app/api/documentos/`, `app/portal/subsanaciones/` |

---

## Casos de Uso

| CU | Nombre | Actor principal |
|----|--------|----------------|
| CU-01 | Recepción y Registro de ROS | Sujeto Obligado |
| CU-02 | Búsqueda, filtrado y clasificación | Analista / Supervisor |
| CU-03 | Auditoría y control de acceso | Auditor |
| CU-04 | Reportes e inteligencia financiera | Supervisor |
| CU-05 | Gestión de usuarios y MFA | Admin |
| CU-06 | Gestión de sujetos obligados | Admin |
| CU-07 | Vínculos intersectoriales | Analista / Supervisor |
| CU-08 | Gestión documental y subsanación | Sujeto Obligado + Analista |

---

## Credenciales

Todos usan contraseña: `password123`

| Email | Rol |
|-------|-----|
| `cumplimiento@banconacional.com.pa` | sujeto_obligado (banco) |
| `cumplimiento@inmobiliariaistmo.com.pa` | sujeto_obligado (inmobiliaria) |
| `analista@uaf.gob.pa` | analista |
| `supervisor@uaf.gob.pa` | supervisor |
| `auditor@uaf.gob.pa` | auditor |
| `admin@uaf.gob.pa` | admin |

---

## Comandos de Desarrollo

```bash
npm install          # Instalar dependencias
npx tsx db/init.ts   # Inicializar base de datos
npx tsx db/seed.ts   # Cargar datos demo
npm run dev          # Servidor de desarrollo (http://localhost:3000)
npx tsx db/reset.ts  # Resetear DB completamente
```

---

## Convenciones y Reglas Importantes

- **Permisos siempre en el backend**: toda verificación de permisos usa `requirePermission()` o `requireRole()` desde `lib/permissions.ts`. Nunca solo en el frontend.
- **Auditoría obligatoria**: toda acción significativa debe registrarse con `logAuditEvent()` de `lib/audit.ts`.
- **Enmascarado Ley 81**: identificadores y emails deben mostrarse enmascarados en UI usando `lib/masking.ts`.
- **Atomicidad en ROS**: crear un ROS siempre en `db.transaction()`. Nunca insertar parcialmente.
- **Timestamps del servidor**: el log de auditoría usa `CURRENT_TIMESTAMP` de SQLite, nunca fecha del cliente.
- **Validación Zod**: toda entrada de usuario debe validarse con Zod antes de tocar la DB.
- **No autocompletado de datos sensibles**: `verifyPublic()` retorna `{found, nombre}` únicamente.

---

## Contexto Adicional

Para información completa sobre:
- Especificación de requisitos (RF/RNF completos)
- Diagrama de clases detallado (16+ entidades)
- Descripción completa de casos de uso con flujos alternos
- Criterios de aceptación en Gherkin
- Plan de pruebas (Alpha/Beta/UX)
- Matriz de defectos y mitigaciones (DEF-01 a DEF-40)
- Prototipo HTML de referencia

**→ Lee `/Contexto/CONTEXTO.md`**
