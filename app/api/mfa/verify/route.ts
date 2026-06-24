// POST /api/mfa/verify — Verifica el código TOTP del usuario.
// En éxito re-codifica el JWT con mfaVerified=true y lo devuelve en Set-Cookie;
// el cliente solo debe navegar a su panel.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encode, decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { verifyCode } from '@/lib/totp';
import { decryptString } from '@/lib/crypto';
import { audit, extractRequestContext } from '@/lib/audit';
import { checkRateLimit, clearRateLimit } from '@/lib/rate-limit';

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });

interface Row { mfa_secret: string | null; mfa_activo: number; correo: string }

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Código MFA inválido' }, { status: 400 });
  }

  const row = db.prepare<[string], Row>(
    'SELECT mfa_secret, mfa_activo, correo FROM usuario WHERE id = ?',
  ).get(session.user.id);

  if (!row?.mfa_secret) {
    return NextResponse.json({ error: 'MFA no inicializado' }, { status: 400 });
  }

  const ctx = extractRequestContext(req);
  
  // BL-035: Rate Limiting para MFA
  const rateLimit = checkRateLimit(ctx.ip, 5, 60000);
  if (!rateLimit.ok) {
    audit({
      modulo: 'autenticacion', accion: 'mfa_verify_failed', resultado: 'fallo',
      usuario_id: session.user.id, ip: ctx.ip, user_agent: ctx.user_agent,
      detalle: { motivo: 'rate_limit_exceeded' }, criticidad: 'alta',
    });
    return NextResponse.json({ error: 'Demasiados intentos. Espere 1 minuto.' }, { status: 429 });
  }

  const decryptedSecret = decryptString(row.mfa_secret);
  const ok = verifyCode(decryptedSecret, parsed.data.code);

  if (!ok) {
    audit({
      modulo: 'autenticacion',
      accion: 'mfa_verify_failed',
      resultado: 'fallo',
      usuario_id: session.user.id,
      usuario_correo: row.correo,
      rol: session.user.rol,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      criticidad: 'alta',
    });
    return NextResponse.json({ error: 'Código incorrecto o expirado' }, { status: 401 });
  }

  if (row.mfa_activo === 0) {
    db.prepare('UPDATE usuario SET mfa_activo = 1 WHERE id = ?').run(session.user.id);
  }

  audit({
    modulo: 'autenticacion',
    accion: 'mfa_verify_ok',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: row.correo,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
  });

  clearRateLimit(ctx.ip);

  // Actualiza el JWT directamente en la cookie para que el middleware
  // vea mfaVerified=true en la siguiente navegación sin depender de
  // session.update() del cliente.
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
  const secret = process.env.AUTH_SECRET!;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cookieName)?.value;

  if (sessionToken) {
    const decoded = await decode({ token: sessionToken, secret, salt: cookieName });
    if (decoded) {
      const encoded = await encode({
        token: { ...decoded, mfaVerified: true },
        secret,
        salt: cookieName,
      });
      const res = NextResponse.json({ ok: true });
      res.cookies.set(cookieName, encoded, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      });
      return res;
    }
  }

  return NextResponse.json({ ok: true });
}
