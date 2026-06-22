import Link from 'next/link';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';

export const revalidate = 0;

interface Row {
  id: string;
  ros_id: string;
  numero_ros: string;
  motivo: string;
  estado: string;
  fecha_solicitud: string;
  documento_nombre: string | null;
}

export default async function SubsanacionesPage() {
  const session = await getSession();
  const soId = session!.user.sujetoObligadoId!;

  const rows = db.prepare<[string], Row>(
    `
    SELECT s.id, s.ros_id, r.numero_ros, s.motivo, s.estado, s.fecha_solicitud,
           da.nombre_archivo AS documento_nombre
      FROM solicitud_subsanacion s
      JOIN ros r ON r.id = s.ros_id
      LEFT JOIN documento_adjunto da ON da.id = s.documento_adjunto_id
     WHERE r.sujeto_obligado_id = ?
     ORDER BY s.fecha_solicitud DESC
    `,
  ).all(soId);

  return (
    <>
      <TopBar
        eyebrow="Subsanación documental"
        title="Solicitudes de subsanación de la UAF"
        description="Atienda las observaciones de la UAF sin crear un ROS nuevo. Suba el archivo corregido desde el detalle del ROS asociado."
      />

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="notice green" style={{ margin: 20 }}>No tienes solicitudes de subsanación pendientes.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>ROS</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Solicitud</th>
                  <th style={{ width: '28%' }}>Motivo</th>
                  <th style={{ width: '28%' }}>Documento</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Estado</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: '#0f3e69' }}>{r.numero_ros}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>#{r.id.slice(0, 8)}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.motivo}>
                      {r.motivo}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.documento_nombre ?? ''}>
                      {r.documento_nombre ?? '—'}
                    </td>
                    <td><Badge tone={r.estado === 'pendiente' ? 'amber' : 'green'}>{r.estado}</Badge></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatPanama(r.fecha_solicitud)}</td>
                    <td>
                      <Link href={`/portal/ros/${r.ros_id}`} className="btn primary" style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        Atender
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
