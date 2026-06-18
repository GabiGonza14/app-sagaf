import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { TopBar } from '@/components/TopBar';
import { AuditTable } from '@/components/AuditTable';
import { audit, extractClientIp } from '@/lib/audit';
import { headers } from 'next/headers';

export const revalidate = 0;

interface SP {
  q?: string; modulo?: string; rol?: string; resultado?: string; criticidad?: string; desde?: string; hasta?: string;
}

export default async function UafAuditoriaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  // Solo el rol auditor accede desde /auditor; supervisor y analista no tienen permiso aquí
  if (session?.user?.rol !== 'admin') redirect('/uaf');
  const sp = await searchParams;
  const filters = {
    q: sp.q ?? '',
    modulo: sp.modulo ?? '',
    rol: sp.rol ?? '',
    resultado: sp.resultado ?? '',
    criticidad: sp.criticidad ?? '',
    desde: sp.desde ?? '',
    hasta: sp.hasta ?? '',
  };

  // CU-03 RE-03: la consulta al log queda auditada
  const h = await headers();
  audit({
    modulo: 'auditoria',
    accion: 'consulta_log',
    resultado: 'exito',
    usuario_id: session!.user.id,
    usuario_correo: session!.user.email,
    rol: session!.user.rol,
    ip: extractClientIp(h),
    user_agent: h.get('user-agent'),
    detalle: filters,
  });

  return (
    <>
      <TopBar
        eyebrow="Trazabilidad y auditoría"
        title="Historial de auditoría del sistema"
        description="Log inmutable de acciones realizadas en SAGAF. La consulta a este log también queda registrada."
      />

      <div className="card">
        <AuditTable filters={filters} />
      </div>
    </>
  );
}
