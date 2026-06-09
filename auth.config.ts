// auth.config.ts — Configuración compartida (edge-safe) para NextAuth v5
// Los tipos del usuario/sesión están extendidos en types/next-auth.d.ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || (
    process.env.NODE_ENV === 'development'
      ? 'dev-secret-do-not-use-in-production'
      : undefined
  ),
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = Boolean(auth?.user);
      console.log('[AUTH CONFIG] authorized() — path:', path, '| isLoggedIn:', isLoggedIn);

      // Rutas públicas (las APIs de auth y la propia página de login)
      if (path.startsWith('/login') || path.startsWith('/api/auth')) {
        console.log('[AUTH CONFIG] Ruta pública permitida');
        return true;
      }

      if (!isLoggedIn) {
        console.log('[AUTH CONFIG] No autenticado — bloqueando acceso a', path);
        return false;
      }

      const role = auth!.user.rol;
      const mfaVerified = auth!.user.mfaVerified === true;
      console.log('[AUTH CONFIG] Usuario autenticado — Rol:', role, '| MFA verificado:', mfaVerified);

      // El flujo de MFA siempre es accesible para usuario autenticado.
      // Incluye los endpoints API (sin esto, el fetch desde /mfa/setup se
      // redirigiría a /mfa/verify y devolvería HTML en vez de JSON).
      if (path.startsWith('/mfa') || path.startsWith('/api/mfa')) {
        console.log('[AUTH CONFIG] Ruta MFA/API MFA permitida');
        return true;
      }

      // MFA obligatorio (RNF-01): bloquea acceso a vistas hasta completar 2FA
      if (!mfaVerified) {
        console.log('[AUTH CONFIG] MFA NO verificado — redirigiendo a /mfa/verify');
        const url = new URL('/mfa/verify', request.nextUrl);
        return Response.redirect(url);
      }

      // Control por rol (RF-05)
      if (path.startsWith('/portal')  && role !== 'sujeto_obligado') {
        console.log('[AUTH CONFIG] Rol', role, 'sin acceso a /portal');
        return false;
      }
      if (path.startsWith('/uaf')     && !['analista', 'supervisor'].includes(role)) {
        console.log('[AUTH CONFIG] Rol', role, 'sin acceso a /uaf');
        return false;
      }
      if (path.startsWith('/auditor') && role !== 'auditor') {
        console.log('[AUTH CONFIG] Rol', role, 'sin acceso a /auditor');
        return false;
      }
      if (path.startsWith('/admin')   && role !== 'admin') {
        console.log('[AUTH CONFIG] Rol', role, 'sin acceso a /admin');
        return false;
      }

      console.log('[AUTH CONFIG] Acceso permitido a', path);
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        console.log('[AUTH CONFIG] jwt() — Nuevo usuario en JWT — ID:', user.id, '| Rol:', user.rol, '| mfaActivo:', user.mfaActivo);
        token.id = user.id as string;
        token.rol = user.rol;
        token.sujetoObligadoId = user.sujetoObligadoId;
        token.mfaActivo = user.mfaActivo;
        token.mfaVerified = false;
      }
      // El cliente llama a session.update({ mfaVerified: true }) tras verificar TOTP
      if (trigger === 'update' && session && typeof session === 'object' && 'mfaVerified' in session) {
        const newMfaVerified = (session as { mfaVerified: boolean }).mfaVerified === true;
        console.log('[AUTH CONFIG] jwt() — Trigger update — mfaVerified cambiado a:', newMfaVerified);
        token.mfaVerified = newMfaVerified;
      }
      return token;
    },
    session({ session, token }) {
      console.log('[AUTH CONFIG] session() — Construyendo sesión — ID:', token.id, '| mfaVerified:', token.mfaVerified);
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
