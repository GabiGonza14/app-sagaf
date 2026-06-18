import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { LoginSubmitButton } from './LoginSubmitButton';
import { PasswordInput } from '@/components/PasswordInput';

// Server action para login con credenciales (paso 1 de MFA)
async function loginAction(formData: FormData): Promise<void> {
  'use server';
  try {
    await signIn('credentials', {
      correo: String(formData.get('correo') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/mfa/verify',
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent('Credenciales inválidas')}`);
    }
    throw e;
  }
}

interface SearchParams { error?: string }

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (session?.user?.mfaVerified) redirect('/');
  if (session?.user) redirect('/mfa/verify');

  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ color: '#102a43', marginBottom: 18 }}>
          <div className="brand-icon" style={{ animation: 'glowPulse 3s infinite' }}>SG</div>
          <div>
            <h1 style={{ color: '#102a43' }}>SAGAF</h1>
            <span style={{ color: '#667085' }}>
              Sistema Automatizado de Gestión de Análisis Financiero
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: 24, marginBottom: 8, letterSpacing: '-0.02em', fontWeight: 800 }}>Acceso institucional</h1>
        <p className="lead" style={{ marginBottom: 22 }}>
          Ingrese con sus credenciales. La autenticación se completa con un código de verificación de dos factores (MFA).
        </p>

        {error && (
          <div className="notice red" style={{ marginBottom: 14 }}>
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={loginAction}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="correo">Correo institucional</label>
              <input
                id="correo"
                name="correo"
                type="email"
                required
                placeholder="cumplimiento@entidad.com"
                defaultValue=""
              />
            </div>
            <div className="field full">
              <label htmlFor="password">Contraseña</label>
              <PasswordInput id="password" name="password" required placeholder="••••••••" />
            </div>
            <div className="field full">
              <LoginSubmitButton />
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
