import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell, type NavItem } from '@/components/AppShell';
import { LayoutDashboard, Users, Building2, ClipboardList } from 'lucide-react';

const navItems: NavItem[] = [
  { href: '/admin',                    label: 'Resumen',             icon: <LayoutDashboard size={16} /> },
  { href: '/admin/usuarios',           label: 'Usuarios y roles',    icon: <Users size={16} /> },
  { href: '/admin/sujetos-obligados',  label: 'Sujetos obligados',   icon: <Building2 size={16} /> },
  { href: '/admin/auditoria',          label: 'Auditoría',           icon: <ClipboardList size={16} /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'admin') redirect('/');

  const userInitials = (session.user.name ?? 'Admin').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell
      role="admin"
      userName={session.user.name ?? 'Admin'}
      userInitials={userInitials}
      navItems={navItems}
      note="Como administrador no tienes acceso al contenido sensible de los ROS. Todas tus acciones quedan registradas en auditoría."
    >
      {children}
    </AppShell>
  );
}
