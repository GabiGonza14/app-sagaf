import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { ShieldCheck } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { AdminAuditFilters } from './AdminAuditFilters';

export const revalidate = 0;

const PER_PAGE = 25;

interface EventRow {
  id: string;
  fecha_hora_servidor: string;
  usuario_correo: string | null;
  rol: string | null;
  accion: string;
  resultado: string;
  detalle: string | null;
  ip: string | null;
}

const ACCION_LABEL: Record<string, string> = {
  crear_sujeto_obligado:       'Crear sujeto obligado',
  actualizar_sujeto_obligado:  'Modificar sujeto obligado',
  desactivar_sujeto_obligado:  'Desactivar sujeto obligado',
  activar_sujeto_obligado:     'Activar sujeto obligado',
  crear_plantilla_ros:         'Crear plantilla ROS',
  actualizar_plantilla_ros:    'Modificar plantilla ROS',
  crear_usuario:               'Crear usuario',
  actualizar_usuario:          'Modificar usuario',
  desactivar_usuario:          'Desactivar usuario',
};

const ACCION_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'gray'> = {
  crear_sujeto_obligado:       'green',
  actualizar_sujeto_obligado:  'blue',
  desactivar_sujeto_obligado:  'red',
  activar_sujeto_obligado:     'green',
  crear_plantilla_ros:         'green',
  actualizar_plantilla_ros:    'blue',
  crear_usuario:               'green',
  actualizar_usuario:          'blue',
  desactivar_usuario:          'red',
};

function parsearEntidad(accion: string, detalle: string | null): string {
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    if (d.nombre) return d.nombre;
    if (d.correo_afectado) return d.correo_afectado;
    return '—';
  } catch {
    return '—';
  }
}

function parsearCambios(detalle: string | null): string {
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    if (d.cambios) {
      return Object.entries(d.cambios)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    if (d.tipo) return `tipo: ${d.tipo}`;
    if (d.rol_asignado) return `rol: ${d.rol_asignado}`;
    return '—';
  } catch {
    return '—';
  }
}

function buildFilters(sp: { accion?: string; resultado?: string; desde?: string; hasta?: string }) {
  const where: string[] = ["modulo = 'admin'"];
  const params: unknown[] = [];

  if (sp.accion) {
    where.push('accion LIKE ?');
    params.push(`%${sp.accion}%`);
  }
  if (sp.resultado) {
    where.push('resultado = ?');
    params.push(sp.resultado);
  }
  if (sp.desde) {
    where.push('fecha_hora_servidor >= ?');
    params.push(sp.desde);
  }
  if (sp.hasta) {
    where.push('fecha_hora_servidor <= ?');
    params.push(sp.hasta + ' 23:59:59');
  }

  return { where, params };
}

interface Props {
  searchParams: Promise<{
    page?: string;
    accion?: string;
    resultado?: string;
    desde?: string;
    hasta?: string;
  }>;
}

export default async function AdminAuditoria({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, Number(sp.page) || 1);

  const filters = buildFilters(sp);
  const whereClause = filters.where.join(' AND ');

  const totalRow = db.prepare<unknown[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE ${whereClause}`,
  ).get(...filters.params);
  const total = totalRow?.c ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  const eventos = db.prepare<unknown[], EventRow>(
    `SELECT id, fecha_hora_servidor, usuario_correo, rol, accion, resultado, detalle, ip
       FROM evento_auditoria
      WHERE ${whereClause}
      ORDER BY fecha_hora_servidor DESC
      LIMIT ? OFFSET ?`,
  ).all(...filters.params, PER_PAGE, (currentPage - 1) * PER_PAGE);

  const totalesGenerales = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE modulo = 'admin'`,
  ).get()?.c ?? 0;

  const totalSujetos = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE modulo = 'admin' AND accion LIKE '%sujeto%'`,
  ).get()?.c ?? 0;

  const totalPlantillas = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE modulo = 'admin' AND accion LIKE '%plantilla%'`,
  ).get()?.c ?? 0;

  const totalUsuarios = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE modulo = 'admin' AND accion LIKE '%usuario%'`,
  ).get()?.c ?? 0;

  const totalFallos = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria WHERE modulo = 'admin' AND resultado = 'fallo'`,
  ).get()?.c ?? 0;

  const inicio = total === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const fin = Math.min(currentPage * PER_PAGE, total);

  const filterParams: Record<string, string> = {};
  if (sp.accion)    filterParams.accion = sp.accion;
  if (sp.resultado) filterParams.resultado = sp.resultado;
  if (sp.desde)     filterParams.desde = sp.desde;
  if (sp.hasta)     filterParams.hasta = sp.hasta;

  return (
    <>
      <TopBar
        eyebrow="Administración SAGAF"
        title="Registro de auditoría"
        description="Historial completo de todas las creaciones, modificaciones y desactivaciones realizadas por administradores. Solo lectura."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Eventos totales',       value: totalesGenerales, tone: 'blue'  },
          { label: 'Sujetos obligados',      value: totalSujetos,     tone: 'teal'  },
          { label: 'Plantillas ROS',         value: totalPlantillas,  tone: 'green' },
          { label: 'Usuarios',               value: totalUsuarios,    tone: 'blue'  },
          { label: 'Con fallo',              value: totalFallos,      tone: 'red'   },
        ].map((k) => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="notice" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18 }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong>Registro inmutable:</strong> Toda creación, modificación o desactivación queda registrada automáticamente con usuario, rol, entidad afectada, cambios realizados, fecha del servidor e IP. Este log no puede modificarse.
        </span>
      </div>

      <AdminAuditFilters initial={{ accion: sp.accion ?? '', resultado: sp.resultado ?? '', desde: sp.desde ?? '', hasta: sp.hasta ?? '' }} />

      <div className="card">
        <div className="panel-head" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Acciones administrativas</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              {total > 0
                ? `Mostrando ${inicio}–${fin} de ${total} eventos`
                : 'Sin resultados para los filtros seleccionados'}
            </p>
          </div>
        </div>

        {eventos.length === 0 ? (
          <div className="notice">No hay eventos registrados aún.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Acción</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Entidad afectada</th>
                  <th>Cambios realizados</th>
                  <th>Resultado</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12 }}>{formatPanama(e.fecha_hora_servidor)}</span>
                    </td>
                    <td>
                      <Badge tone={ACCION_TONE[e.accion] ?? 'gray'}>
                        {ACCION_LABEL[e.accion] ?? e.accion}
                      </Badge>
                    </td>
                    <td style={{ fontSize: 13 }}>{e.usuario_correo ?? <span className="small">system</span>}</td>
                    <td><span className="small">{e.rol ?? '—'}</span></td>
                    <td style={{ fontSize: 13 }}><strong>{parsearEntidad(e.accion, e.detalle)}</strong></td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{parsearCambios(e.detalle)}</td>
                    <td>
                      <Badge tone={e.resultado === 'exito' ? 'green' : 'red'}>{e.resultado}</Badge>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/admin/auditoria"
        params={filterParams}
      />
    </>
  );
}
