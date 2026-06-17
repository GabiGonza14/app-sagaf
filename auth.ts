// auth.ts — NextAuth v5 con Credentials + MFA TOTP
// El login es de DOS pasos: (1) credenciales → JWT con mfaVerified=false;
// (2) verificación TOTP en /mfa/verify llama a `update({ mfaVerified: true })`.
// Hasta ese momento, `authorized` redirige a /mfa/verify. (RNF-01, DEF-03)

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { db } from './lib/db';
import { audit, extractRequestContext } from './lib/audit';
import { checkRateLimit, clearRateLimit } from './lib/rate-limit';

interface UsuarioRow {
  id: string;
  nombre: string;
  correo: string;
  password_hash: string;
  rol_nombre: string;
  sujeto_obligado_id: string | null;
  estado: string;
  mfa_activo: number;
}

const stmtFindByEmail = db.prepare<[string], UsuarioRow>(`
  SELECT u.id, u.nombre, u.correo, u.password_hash, r.nombre AS rol_nombre,
         u.sujeto_obligado_id, u.estado, u.mfa_activo
    FROM usuario u
    JOIN rol r ON r.id = u.rol_id
   WHERE u.correo = ? AND u.estado = 'activo'
`);

const stmtUpdateUltimoAcceso = db.prepare(
  'UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?',
);

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        correo:   { label: 'Correo institucional', type: 'email' },
        password: { label: 'Contraseña',           type: 'password' },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        const ctx = extractRequestContext(req as unknown as Request);

        // BL-035: Rate Limiting (máx 5 intentos por minuto por IP)
        const rateLimit = checkRateLimit(ctx.ip, 5, 60000);
        if (!rateLimit.ok) {
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'rate_limit_exceeded' },
            criticidad: 'alta',
          });
          return null;
        }

        if (!parsed.success) {
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_correo: String(credentials?.correo ?? ''),
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'payload_invalido' },
            criticidad: 'alta',
          });
          return null;
        }

        const usuario = stmtFindByEmail.get(parsed.data.correo);
        if (!usuario) {
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_correo: parsed.data.correo,
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'usuario_no_encontrado' },
            criticidad: 'alta',
          });
          return null;
        }

        const ok = bcrypt.compareSync(parsed.data.password, usuario.password_hash);
        if (!ok) {
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_id: usuario.id, usuario_correo: usuario.correo, rol: usuario.rol_nombre,
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'password_invalido' },
            criticidad: 'alta',
          });
          return null;
        }

        stmtUpdateUltimoAcceso.run(usuario.id);
        
        // Reset rate limit for this IP on successful password match
        clearRateLimit(ctx.ip);

        audit({
          modulo: 'autenticacion', accion: 'login_password_ok', resultado: 'exito',
          usuario_id: usuario.id, usuario_correo: usuario.correo, rol: usuario.rol_nombre,
          ip: ctx.ip, user_agent: ctx.user_agent,
          detalle: { mfa_activo: usuario.mfa_activo === 1 },
        });

        // El JWT aún no es válido para acceder a las vistas — falta MFA.
        // Los campos extendidos están declarados en types/next-auth.d.ts
        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.correo,
          rol: usuario.rol_nombre as 'sujeto_obligado' | 'analista' | 'supervisor' | 'auditor' | 'admin',
          sujetoObligadoId: usuario.sujeto_obligado_id,
          mfaActivo: usuario.mfa_activo === 1,
        };
      },
    }),
  ],
});
