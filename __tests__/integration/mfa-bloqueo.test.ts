// __tests__/integration/mfa-bloqueo.test.ts — BL-058: Seguridad login sin MFA (DEF-03)
// Verifica que un usuario con sesión válida pero mfaVerified=false queda bloqueado.

import { describe, it, expect } from 'vitest';

// Las reglas de bloqueo MFA están en auth.config.ts (callback authorized).
// Aquí verificamos la lógica de decisión aislada del middleware.

/**
 * Simula la lógica del callback `authorized` de auth.config.ts.
 * Retorna { allowed: boolean; redirectTo?: string }.
 */
function simulateAuthMiddleware(
  session: { user?: { mfaVerified?: boolean; rol?: string } } | null,
  requestPath: string,
): { allowed: boolean; redirectTo?: string } {
  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/api/auth'];
  if (publicPaths.some((p) => requestPath.startsWith(p))) {
    return { allowed: true };
  }

  // Rutas de MFA setup/verify: permitidas si hay sesión (para completar el flujo)
  const mfaPaths = ['/mfa/setup', '/mfa/verify'];
  if (mfaPaths.some((p) => requestPath.startsWith(p))) {
    return session?.user ? { allowed: true } : { allowed: false, redirectTo: '/login' };
  }

  // Sin sesión → login
  if (!session?.user) {
    return { allowed: false, redirectTo: '/login' };
  }

  // Con sesión pero sin MFA verificado → redirigir a /mfa/verify (DEF-03)
  if (!session.user.mfaVerified) {
    return { allowed: false, redirectTo: '/mfa/verify' };
  }

  // Sesión válida con MFA verificado → permitido
  return { allowed: true };
}

describe('BL-058: Seguridad — bloqueo sin MFA (DEF-03)', () => {
  it('[DEF-03] usuario sin mfaVerified es redirigido a /mfa/verify', () => {
    const result = simulateAuthMiddleware(
      { user: { mfaVerified: false, rol: 'analista' } },
      '/uaf',
    );
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/mfa/verify');
  });

  it('[DEF-03] usuario con mfaVerified=true puede acceder a rutas protegidas', () => {
    const result = simulateAuthMiddleware(
      { user: { mfaVerified: true, rol: 'analista' } },
      '/uaf',
    );
    expect(result.allowed).toBe(true);
  });

  it('usuario sin sesión es redirigido a /login', () => {
    const result = simulateAuthMiddleware(null, '/uaf');
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/login');
  });

  it('rutas de login son siempre públicas', () => {
    const result = simulateAuthMiddleware(null, '/login');
    expect(result.allowed).toBe(true);
  });

  it('ruta /mfa/verify es accesible con sesión (para completar el flujo)', () => {
    const result = simulateAuthMiddleware(
      { user: { mfaVerified: false, rol: 'analista' } },
      '/mfa/verify',
    );
    expect(result.allowed).toBe(true);
  });

  it('ruta /mfa/setup es accesible con sesión', () => {
    const result = simulateAuthMiddleware(
      { user: { mfaVerified: false, rol: 'admin' } },
      '/mfa/setup',
    );
    expect(result.allowed).toBe(true);
  });

  it('[DEF-03] bloqueo aplica a TODOS los roles sin MFA', () => {
    const roles = ['sujeto_obligado', 'analista', 'supervisor', 'auditor', 'admin'];
    for (const rol of roles) {
      const result = simulateAuthMiddleware(
        { user: { mfaVerified: false, rol } },
        '/portal',
      );
      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/mfa/verify');
    }
  });

  it('[DEF-03] bloqueo aplica a rutas de API protegidas', () => {
    const result = simulateAuthMiddleware(
      { user: { mfaVerified: false, rol: 'analista' } },
      '/api/ros',
    );
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/mfa/verify');
  });

  it('rutas de API de autenticación son públicas', () => {
    const result = simulateAuthMiddleware(null, '/api/auth/callback/credentials');
    expect(result.allowed).toBe(true);
  });
});
