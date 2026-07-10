// POST /api/mfa/setup — Genera secret TOTP + QR para el usuario autenticado.
// El secret queda asociado al usuario hasta que se confirma con /api/mfa/verify
// (primer código válido) o se descarta. mfa_activo solo pasa a 1 tras confirmar.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generateSecret, buildQrDataUrl } from '@/lib/totp';
import { encryptString, decryptString } from '@/lib/crypto';
import { audit, extractRequestContext } from '@/lib/audit';

interface UserRow { mfa_secret: string | null }

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Reutiliza el secret existente si ya tiene uno (permite re-escanear sin perder el anterior)
  const existing = db.prepare<[string], UserRow>(
    'SELECT mfa_secret FROM usuario WHERE id = ?',
  ).get(session.user.id);

  const secret = existing?.mfa_secret ? decryptString(existing.mfa_secret) : generateSecret();

  if (!existing?.mfa_secret) {
    db.prepare('UPDATE usuario SET mfa_secret = ?, mfa_activo = 0 WHERE id = ?').run(
      encryptString(secret),
      session.user.id,
    );
  }

  const qr = await buildQrDataUrl(session.user.email ?? 'sagaf', secret);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'autenticacion',
    accion: 'mfa_setup_iniciado',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    criticidad: 'normal',
  });

  return NextResponse.json({ qr, secret });
}
