// auth.config.ts — Configuración compartida (edge-safe) para NextAuth v5
// Los tipos del usuario/sesión están extendidos en types/next-auth.d.ts
import type { NextAuthConfig, Session } from 'next-auth';
import { createLogger } from './lib/logger';
import { FEATURES } from './lib/features';
import { isMfaRequired } from './lib/mfa-config';

const log = createLogger('auth');

type AuthUser = NonNullable<Session['user']>;

function isPublicPath(path: string): boolean {
  return path.startsWith('/login') || path.startsWith('/api/auth');
}

function isMfaPath(path: string): boolean {
  return path.startsWith('/mfa') || path.startsWith('/api/mfa');
}

function isRoleDenied(path: string, role: AuthUser['rol']): boolean {
  if (path.startsWith('/portal') && role !== 'sujeto_obligado') return true;
  if (path.startsWith('/uaf') && !['analista', 'supervisor'].includes(role)) return true;
  if (path.startsWith('/admin') && role !== 'admin') return true;
  return false;
}

function isAuditorDenied(path: string, role: AuthUser['rol']): boolean {
  if (!path.startsWith('/auditor')) return false;
  if (!FEATURES.AUDITOR_UI) return true;
  return role !== 'auditor';
}

function isAuditLogDenied(path: string): boolean {
  if (!path.startsWith('/admin/auditoria') && !path.startsWith('/uaf/auditoria')) return false;
  return !FEATURES.AUDIT_LOG_UI;
}

function isSupervisionApiDenied(path: string): boolean {
  return path.startsWith('/api/supervision') && !FEATURES.SUPERVISION_SO;
}

function checkAuthorized(
  path: string,
  user: AuthUser,
  requestUrl: URL,
): boolean | Response {
  if (isMfaPath(path)) return true;

  if (isMfaRequired() && user.mfaVerified !== true) {
    log.debug('Redirigiendo a /mfa/verify: MFA no verificado', { path });
    return Response.redirect(new URL('/mfa/verify', requestUrl));
  }

  if (isRoleDenied(path, user.rol)) {
    log.debug('Acceso denegado por rol', { path });
    return false;
  }
  if (isAuditorDenied(path, user.rol)) {
    log.debug('Acceso denegado: módulo auditor o rol', { path });
    return false;
  }
  if (isAuditLogDenied(path)) {
    log.debug('Acceso denegado: vista de logs deshabilitada', { path });
    return false;
  }
  if (isSupervisionApiDenied(path)) {
    log.debug('Acceso denegado: API supervisión deshabilitada', { path });
    return false;
  }

  return true;
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;

      if (isPublicPath(path)) return true;
      if (!auth?.user) {
        log.debug('Acceso denegado: no autenticado', { path });
        return false;
      }

      return checkAuthorized(path, auth.user, request.nextUrl);
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.rol = user.rol;
        token.sujetoObligadoId = user.sujetoObligadoId;
        token.mfaActivo = user.mfaActivo;
        token.mfaVerified = isMfaRequired() ? false : true;
      }
      // El cliente llama a session.update({ mfaVerified: true }) tras verificar TOTP
      if (trigger === 'update' && session && typeof session === 'object' && 'mfaVerified' in session) {
        token.mfaVerified = (session as { mfaVerified: boolean }).mfaVerified === true;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.sujetoObligadoId = token.sujetoObligadoId;
      session.user.mfaActivo = token.mfaActivo;
      session.user.mfaVerified = token.mfaVerified;
      return session;
    },
  },
  providers: [], // se inyectan en auth.ts
};
