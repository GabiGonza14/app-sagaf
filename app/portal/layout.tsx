import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { AppShell, type NavItem } from '@/components/AppShell';
import { Home, ClipboardList, FilePlus, RefreshCw, Shield } from 'lucide-react';
import { FEATURES } from '@/lib/features';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'sujeto_obligado') redirect('/');

  // BL-019 — Indicador persistente: subsanaciones pendientes de este sujeto obligado (CA-CU08-03)
  const pendientes = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM solicitud_subsanacion s
       JOIN ros r ON r.id = s.ros_id
      WHERE r.sujeto_obligado_id = ? AND s.estado = 'pendiente'`,
  ).get(session.user.sujetoObligadoId ?? '')?.n) ?? 0;

  const supervisionPend = FEATURES.SUPERVISION_SO
    ? ((db.prepare<[string], { n: number }>(
        `SELECT COUNT(*) AS n FROM comunicacion_supervision
          WHERE sujeto_obligado_id = ? AND estado IN ('recibida', 'en_analisis')`,
      ).get(session.user.sujetoObligadoId ?? '')?.n) ?? 0)
    : 0;

  const navItems: NavItem[] = [
    { href: '/portal',                label: 'Inicio',         icon: <Home size={16} /> },
    { href: '/portal/ros',            label: 'Mis ROS',        icon: <ClipboardList size={16} /> },
    { href: '/portal/ros/nuevo',      label: 'Registrar ROS',  icon: <FilePlus size={16} /> },
    { href: '/portal/subsanaciones',  label: 'Subsanaciones',  icon: <RefreshCw size={16} />, badge: pendientes || undefined, badgeTone: 'amber' },
    ...(FEATURES.SUPERVISION_SO
      ? [{
          href: '/portal/supervision',
          label: 'Supervisión',
          icon: <Shield size={16} />,
          badge: supervisionPend || undefined,
          badgeTone: 'amber' as const,
        }]
      : []),
  ];

  const userInitials = (session.user.name ?? 'SO').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell
      role="sujeto_obligado"
      userName={(session.user.name ?? session.user.email ?? 'Sujeto obligado').replace(' · Cumplimiento', '')}
      userInitials={userInitials}
      navItems={navItems}
      note="Portal autenticado con verificación de dos factores. Cada documento se carga en su propio contenedor y la identidad se valida sin exponer datos personales."
    >
      {children}
    </AppShell>
  );
}
