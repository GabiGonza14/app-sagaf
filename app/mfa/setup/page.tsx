import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { MfaSetupClient } from './MfaSetupClient';
import { SignOutLink } from '@/components/SignOutLink';

export default async function MfaSetupPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.mfaVerified) redirect('/');

  return (
    <div className="auth-shell">
      <SignOutLink />
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="brand" style={{ color: '#102a43', marginBottom: 18 }}>
            <div className="brand-icon">SG</div>
            <div>
              <h1>SAGAF · Enrolamiento MFA</h1>
              <span style={{ color: '#667085' }}>Primer ingreso — configuración del segundo factor</span>
            </div>
          </div>

          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Configura tu autenticador</h1>
          <p className="lead" style={{ marginBottom: 18 }}>
            Escanea este código QR con Google Authenticator, Microsoft Authenticator o Authy
            y luego ingresa el código de 6 dígitos. Es obligatorio para todos los usuarios
            del sistema.
          </p>

          <MfaSetupClient />
      </div>
    </div>
  );
}
