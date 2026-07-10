import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppShell, type NavItem } from '@/components/AppShell';
import { ShieldCheck } from 'lucide-react';

const navItems: NavItem[] = [
  { href: '/auditor', label: 'Auditoría', icon: <ShieldCheck size={16} /> },
];

export default async function AuditorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'auditor') redirect('/');

  const userInitials = (session.user.name ?? 'Auditor').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell
      role="auditor"
      userName={session.user.name ?? 'Auditor'}
      userInitials={userInitials}
      navItems={navItems}
      note="Acceso de solo lectura al log de auditoría. No tienes acceso al contenido de los ROS. Cada consulta queda registrada como evento."
    >
      {children}
    </AppShell>
  );
}
