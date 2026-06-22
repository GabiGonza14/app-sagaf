import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { MfaVerifyForm } from './MfaVerifyForm';
import { SignOutLink } from '@/components/SignOutLink';
import { buildQrDataUrl } from '@/lib/totp';
import { decryptString } from '@/lib/crypto';

export default async function MfaVerifyPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.mfaVerified) redirect('/');

  const row = db
    .prepare<[string], { mfa_activo: number; mfa_secret: string | null }>('SELECT mfa_activo, mfa_secret FROM usuario WHERE id = ?')
    .get(session.user.id);

  // Primer login: si MFA no está activo, ofrecer enrolamiento
  if (!row || row.mfa_activo === 0) {
    redirect('/mfa/setup');
  }

  // Generar QR para mostrar en la verificación (desencriptando el secret antes)
  let qr: string | null = null;
  if (row.mfa_secret) {
    const decryptedSecret = decryptString(row.mfa_secret);
    qr = await buildQrDataUrl(session.user.email ?? 'sagaf', decryptedSecret);
  }

  return (
    <div className="auth-shell">
      <SignOutLink />
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="brand" style={{ color: '#102a43', marginBottom: 18 }}>
          <div className="brand-icon">SG</div>
          <div>
            <h1>SAGAF · MFA</h1>
            <span style={{ color: '#667085' }}>Segundo factor obligatorio</span>
          </div>
        </div>

        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Verificación MFA</h1>
        <p className="lead" style={{ marginBottom: 18 }}>
          Ingrese el código de 6 dígitos generado por su aplicación autenticadora
          (Google Authenticator, Microsoft Authenticator, Authy).
        </p>

        <MfaVerifyForm qr={qr} />
      </div>
    </div>
  );
}
