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
        console.log('[AUTH] authorize() iniciado');
        const parsed = loginSchema.safeParse(credentials);
        const ctx = extractRequestContext(req as unknown as Request);
        console.log('[AUTH] IP:', ctx.ip, '| User-Agent:', ctx.user_agent?.slice(0, 60) + '...');

        if (!parsed.success) {
          console.log('[AUTH] Payload inválido — correo recibido:', String(credentials?.correo ?? 'undefined'));
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_correo: String(credentials?.correo ?? ''),
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'payload_invalido' },
            criticidad: 'alta',
          });
          return null;
        }
        console.log('[AUTH] Payload válido para correo:', parsed.data.correo);

        const usuario = stmtFindByEmail.get(parsed.data.correo);
        if (!usuario) {
          console.log('[AUTH] Usuario NO encontrado en BD:', parsed.data.correo);
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_correo: parsed.data.correo,
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'usuario_no_encontrado' },
            criticidad: 'alta',
          });
          return null;
        }
        console.log('[AUTH] Usuario encontrado — ID:', usuario.id, '| Rol:', usuario.rol_nombre, '| Estado:', usuario.estado);

        const ok = bcrypt.compareSync(parsed.data.password, usuario.password_hash);
        if (!ok) {
          console.log('[AUTH] Password INCORRECTO para usuario:', usuario.id);
          audit({
            modulo: 'autenticacion', accion: 'login_failed', resultado: 'fallo',
            usuario_id: usuario.id, usuario_correo: usuario.correo, rol: usuario.rol_nombre,
            ip: ctx.ip, user_agent: ctx.user_agent,
            detalle: { motivo: 'password_invalido' },
            criticidad: 'alta',
          });
          return null;
        }
        console.log('[AUTH] Password OK — usuario autenticado:', usuario.id);

        stmtUpdateUltimoAcceso.run(usuario.id);
        console.log('[AUTH] ultimo_acceso actualizado para:', usuario.id);

        audit({
          modulo: 'autenticacion', accion: 'login_password_ok', resultado: 'exito',
          usuario_id: usuario.id, usuario_correo: usuario.correo, rol: usuario.rol_nombre,
          ip: ctx.ip, user_agent: ctx.user_agent,
          detalle: { mfa_activo: usuario.mfa_activo === 1 },
        });
        console.log('[AUTH] Retornando usuario al JWT — MFA activo:', usuario.mfa_activo === 1);

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
