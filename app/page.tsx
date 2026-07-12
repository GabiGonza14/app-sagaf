import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { isMfaRequired } from '@/lib/mfa-config';

export default async function Home() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  if (isMfaRequired() && !session.user.mfaVerified) redirect('/mfa/verify');

  const rol = session.user.rol;
  if (rol === 'sujeto_obligado') redirect('/portal');
  if (rol === 'analista' || rol === 'supervisor') redirect('/uaf');
  // auditor deshabilitado MVP (FEATURES.AUDITOR_UI) — redirige a login
  if (rol === 'auditor') redirect('/login');
  if (rol === 'admin') redirect('/admin');
  redirect('/login');
}
