import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { isMfaRequired } from '@/lib/mfa-config';

export default async function Home() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  if (isMfaRequired() && !session.user.mfaVerified) redirect('/mfa/verify');

  switch (session.user.rol) {
    case 'sujeto_obligado': redirect('/portal');
    case 'analista':
    case 'supervisor':      redirect('/uaf');
    // case 'auditor': redirect('/auditor'); — deshabilitado MVP (FEATURES.AUDITOR_UI)
    case 'auditor':         redirect('/login');
    case 'admin':           redirect('/admin');
    default:                redirect('/login');
  }
}
