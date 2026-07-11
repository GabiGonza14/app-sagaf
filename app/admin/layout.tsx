import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppShell, type NavItem } from '@/components/AppShell';
import { LayoutDashboard, Users, Building2, FileStack, ClipboardList } from 'lucide-react';
import { FEATURES } from '@/lib/features';

const baseNavItems: NavItem[] = [
  { href: '/admin',                    label: 'Resumen',             icon: <LayoutDashboard size={16} /> },
  { href: '/admin/usuarios',           label: 'Usuarios y roles',    icon: <Users size={16} /> },
  { href: '/admin/sujetos-obligados',  label: 'Sujetos obligados',   icon: <Building2 size={16} /> },
  { href: '/admin/plantillas',         label: 'Plantillas ROS',      icon: <FileStack size={16} /> },
];

// Auditoría admin: conservada en código; oculta en MVP (PRD flujo-auditoria).
const navItems: NavItem[] = FEATURES.AUDIT_LOG_UI
  ? [...baseNavItems, { href: '/admin/auditoria', label: 'Auditoría', icon: <ClipboardList size={16} /> }]
  : baseNavItems;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
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
