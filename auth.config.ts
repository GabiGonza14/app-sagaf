// auth.config.ts — Configuración compartida (edge-safe) para NextAuth v5
// Los tipos del usuario/sesión están extendidos en types/next-auth.d.ts
import type { NextAuthConfig } from 'next-auth';
import { createLogger } from './lib/logger';
import { FEATURES } from './lib/features';

const log = createLogger('auth');

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
      const isLoggedIn = Boolean(auth?.user);

      // Rutas públicas (las APIs de auth y la propia página de login)
      if (path.startsWith('/login') || path.startsWith('/api/auth')) {
        return true;
      }

      if (!isLoggedIn) {
        log.debug('Acceso denegado: no autenticado', { path });
        return false;
      }

      const role = auth!.user.rol;
      const mfaVerified = auth!.user.mfaVerified === true;

      // El flujo de MFA siempre es accesible para usuario autenticado.
      // Incluye los endpoints API (sin esto, el fetch desde /mfa/setup se
      // redirigiría a /mfa/verify y devolvería HTML en vez de JSON).
      if (path.startsWith('/mfa') || path.startsWith('/api/mfa')) {
        return true;
      }

      // MFA obligatorio (RNF-01): bloquea acceso a vistas hasta completar 2FA
      if (!mfaVerified) {
        log.debug('Redirigiendo a /mfa/verify: MFA no verificado', { path });
        const url = new URL('/mfa/verify', request.nextUrl);
        return Response.redirect(url);
      }

      // Control por rol (RF-05)
      if (path.startsWith('/portal')  && role !== 'sujeto_obligado') {
        log.debug('Acceso denegado por rol', { path });
        return false;
      }
      if (path.startsWith('/uaf')     && !['analista', 'supervisor'].includes(role)) {
        log.debug('Acceso denegado por rol', { path });
        return false;
      }
      if (path.startsWith('/auditor')) {
        // PRD flujo-auditoria: UI deshabilitada en MVP; código conservado para uso futuro.
        if (!FEATURES.AUDITOR_UI) {
          log.debug('Acceso denegado: módulo auditor deshabilitado', { path });
          return false;
        }
        if (role !== 'auditor') {
          log.debug('Acceso denegado por rol', { path });
          return false;
        }
      }
      if (path.startsWith('/admin/auditoria') || path.startsWith('/uaf/auditoria')) {
        if (!FEATURES.AUDIT_LOG_UI) {
          log.debug('Acceso denegado: vista de logs deshabilitada', { path });
          return false;
        }
      }
      if (path.startsWith('/api/supervision') && !FEATURES.SUPERVISION_SO) {
        log.debug('Acceso denegado: API supervisión deshabilitada', { path });
        return false;
      }
      if (path.startsWith('/admin')   && role !== 'admin') {
        log.debug('Acceso denegado por rol', { path });
        return false;
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.rol = user.rol;
        token.sujetoObligadoId = user.sujetoObligadoId;
        token.mfaActivo = user.mfaActivo;
        token.mfaVerified = false;
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
