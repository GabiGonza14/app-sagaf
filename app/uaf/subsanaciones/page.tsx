import Link from 'next/link';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanamaShort, formatPanamaDate } from '@/lib/date';
import { CheckCircle2, Clock, FileCheck } from 'lucide-react';

export const revalidate = 0;

interface Row {
  id: string;
  ros_id: string;
  numero_ros: string;
  sujeto_nombre: string;
  motivo: string;
  estado: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  fecha_limite: string | null;
  doc_req_nombre: string | null;
  doc_adj_nombre: string | null;
}

export default async function SubsanacionesUafPage() {
  const session = await getSession();
  if (!session?.user) return null;

  const rows = db.prepare<[], Row>(
    `SELECT s.id, s.ros_id, r.numero_ros,
            so.nombre AS sujeto_nombre,
            s.motivo, s.estado,
            s.fecha_solicitud, s.fecha_respuesta, s.fecha_limite,
            COALESCE(dr.nombre, dr2.nombre) AS doc_req_nombre,
            da.nombre_archivo               AS doc_adj_nombre
       FROM solicitud_subsanacion s
       JOIN ros r  ON r.id  = s.ros_id
       JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
       LEFT JOIN documento_requerido dr  ON dr.id  = s.documento_requerido_id
       LEFT JOIN documento_adjunto   da  ON da.id  = s.documento_adjunto_id
       LEFT JOIN documento_requerido dr2 ON dr2.id = da.documento_requerido_id
      ORDER BY
        CASE s.estado WHEN 'atendida' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2 END,
        s.fecha_respuesta DESC,
        s.fecha_solicitud DESC`,
  ).all();

  const atendidas = rows.filter((r) => r.estado === 'atendida');
  const pendientes = rows.filter((r) => r.estado === 'pendiente');
  const vencidas   = rows.filter((r) => r.estado === 'vencida');
  const resto      = rows.filter((r) => !['atendida', 'pendiente', 'vencida'].includes(r.estado));

  const renderTable = (items: Row[]) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ whiteSpace: 'nowrap' }}>ROS</th>
            <th style={{ whiteSpace: 'nowrap' }}>Sujeto obligado</th>
            <th style={{ width: '22%' }}>Documento</th>
            <th style={{ width: '22%' }}>Motivo</th>
            <th style={{ whiteSpace: 'nowrap' }}>Estado</th>
            <th style={{ whiteSpace: 'nowrap' }}>Fecha solicitud</th>
            <th style={{ whiteSpace: 'nowrap' }}>Respuesta</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: '#0f3e69' }}>{r.numero_ros}</strong></td>
              <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{r.sujeto_nombre}</td>
              <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.doc_req_nombre ?? r.doc_adj_nombre ?? ''}>
                {r.doc_req_nombre ?? r.doc_adj_nombre ?? '—'}
              </td>
              <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.motivo}>
                {r.motivo}
              </td>
              <td>
                <Badge tone={
                  r.estado === 'atendida' ? 'green' :
                  r.estado === 'pendiente' ? 'amber' :
                  r.estado === 'vencida' ? 'red' : 'gray'
                }>{r.estado}</Badge>
              </td>
              <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {formatPanamaShort(r.fecha_solicitud)}
              </td>
              <td style={{ fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {r.fecha_respuesta ? formatPanamaShort(r.fecha_respuesta) : '—'}
              </td>
              <td>
                <Link href={`/uaf/ros/${r.ros_id}?tab=documentos`} className="btn primary" style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Revisar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <TopBar
        eyebrow="Gestión documental"
        title="Subsanaciones"
        description="Documentos corregidos por los sujetos obligados pendientes de revisión, y solicitudes aún en espera de respuesta."
      />

      {rows.length === 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'visible' }}>
            <div className="notice green" style={{ margin: 20 }}>No hay subsanaciones registradas.</div>
          </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Documentos corregidos — requieren revisión */}
          {atendidas.length > 0 && (
            <div className="card">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileCheck size={17} style={{ color: 'var(--teal)' }} />
                  <div>
                    <h3 style={{ margin: 0 }}>Documentos corregidos — pendientes de revisión</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>El sujeto obligado ha subido el documento corregido. Revísalo y valida o vuelve a observar.</p>
                  </div>
                </div>
                <Badge tone="green">{atendidas.length}</Badge>
              </div>
              {renderTable(atendidas)}
            </div>
          )}

          {/* Pendientes — esperando respuesta del sujeto */}
          {pendientes.length > 0 && (
            <div className="card">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={17} style={{ color: 'var(--amber)' }} />
                  <div>
                    <h3 style={{ margin: 0 }}>En espera de respuesta</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>Solicitudes enviadas al sujeto obligado aún sin responder.</p>
                  </div>
                </div>
                <Badge tone="amber">{pendientes.length}</Badge>
              </div>
              {renderTable(pendientes)}
            </div>
          )}

          {/* Vencidas */}
          {vencidas.length > 0 && (
            <div className="card">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Vencidas</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem' }}>El plazo expiró sin respuesta del sujeto.</p>
                </div>
                <Badge tone="red">{vencidas.length}</Badge>
              </div>
              {renderTable(vencidas)}
            </div>
          )}

          {/* Resto (resueltas, etc.) */}
          {resto.length > 0 && (
            <div className="card">
              <div className="panel-head" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={17} style={{ color: 'var(--muted)' }} />
                  <h3 style={{ margin: 0 }}>Historial</h3>
                </div>
              </div>
              {renderTable(resto)}
            </div>
          )}

        </div>
      )}
    </>
  );
}
