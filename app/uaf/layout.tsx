import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell, type NavItem } from '@/components/AppShell';
import { Inbox, Link2, BarChart2, ShieldCheck, Building2 } from 'lucide-react';

export default async function UafLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['analista', 'supervisor'].includes(session.user.rol)) redirect('/');

  const navItems: NavItem[] = [
    { href: '/uaf',           label: 'Bandeja de ROS',          icon: <Inbox size={16} /> },
    { href: '/uaf/vinculos',  label: 'Vínculos detectados',     icon: <Link2 size={16} /> },
    { href: '/uaf/reportes',  label: 'Reportes e inteligencia', icon: <BarChart2 size={16} /> },
    ...(session.user.rol === 'supervisor'
      ? [
          { href: '/uaf/sujetos-obligados', label: 'Sujetos obligados',   icon: <Building2 size={16} /> } as NavItem,
          { href: '/uaf/auditoria',          label: 'Auditoría del sistema', icon: <ShieldCheck size={16} /> } as NavItem,
        ]
      : []),
  ];

  const userInitials = (session.user.name ?? 'UAF').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell
      role={session.user.rol === 'supervisor' ? 'supervisor' : 'analista'}
      userName={session.user.name ?? 'UAF'}
      userInitials={userInitials}
      navItems={navItems}
      note={session.user.rol === 'supervisor'
        ? 'Rol Supervisor: validas acciones críticas, apruebas cierres y exportas reportes.'
        : 'Rol Analista: revisas, clasificas y solicitas subsanaciones. Toda acción queda registrada en el log de auditoría.'}
    >
      {children}
    </AppShell>
  );
}
