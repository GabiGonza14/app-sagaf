import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { AppShell, type NavItem } from '@/components/AppShell';
import { Inbox, Link2, BarChart2, FileCheck } from 'lucide-react';

export default async function UafLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['analista', 'supervisor'].includes(session.user.rol)) redirect('/');

  const subsAtendidas = (db.prepare<[], { n: number }>(
    `SELECT COUNT(*) AS n FROM solicitud_subsanacion WHERE estado = 'atendida'`,
  ).get()?.n) ?? 0;

  const navItems: NavItem[] = [
    { href: '/uaf',                  label: 'Bandeja de ROS',          icon: <Inbox size={16} /> },
    { href: '/uaf/vinculos',         label: 'Vínculos detectados',     icon: <Link2 size={16} /> },
    { href: '/uaf/reportes',         label: 'Reportes e inteligencia', icon: <BarChart2 size={16} /> },
    { href: '/uaf/subsanaciones',    label: 'Subsanaciones',           icon: <FileCheck size={16} />, badge: subsAtendidas || undefined, badgeTone: 'green' },
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
