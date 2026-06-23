import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { ShieldCheck } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { AdminAuditFilters } from './AdminAuditFilters';

export const revalidate = 0;

const PER_PAGE = 25;

const ROL_LABEL: Record<string, string> = {
  sujeto_obligado: 'Sujeto Obligado',
  analista: 'Analista',
  supervisor: 'Supervisor',
  auditor: 'Auditor',
  admin: 'Administrador',
};

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
  crear_sujeto_obligado:         'Crear sujeto obligado',
  actualizar_sujeto_obligado:    'Modificar sujeto obligado',
  desactivar_sujeto_obligado:    'Desactivar sujeto obligado',
  activar_sujeto_obligado:       'Activar sujeto obligado',
  eliminar_sujeto_obligado:      'Eliminar sujeto obligado',
  crear_plantilla_ros:           'Crear plantilla ROS',
  actualizar_plantilla_ros:      'Modificar plantilla ROS',
  activar_plantilla_ros:         'Activar plantilla ROS',
  desactivar_plantilla_ros:      'Desactivar plantilla ROS',
  eliminar_plantilla_ros:        'Eliminar plantilla ROS',
  agregar_campo_plantilla:       'Agregar campo a plantilla',
  eliminar_campo_plantilla:      'Eliminar campo de plantilla',
  agregar_documento_requerido:   'Agregar documento requerido',
  eliminar_documento_requerido:  'Eliminar documento requerido',
  crear_usuario:                 'Crear usuario',
  actualizar_usuario:            'Modificar usuario',
  desactivar_usuario:            'Desactivar usuario',
  eliminar_usuario:              'Eliminar usuario',
};

function parsearEntidad(_accion: string, detalle: string | null): string {
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    if (d.nombre)          return d.nombre;
    if (d.correo_afectado) return d.correo_afectado;
    if (d.plantilla)       return d.plantilla;
    if (d.campo)           return d.campo;
    if (d.documento)       return d.documento;
    return '—';
  } catch {
    return '—';
  }
}

const CAMPO_LABEL: Record<string, string> = {
  nombre: 'Nombre',
  ruc: 'RUC',
  tipo: 'Tipo',
  sector: 'Sector',
  estado: 'Estado',
  organismo_supervisor: 'Organismo supervisor',
  responsable_cumpl: 'Responsable cumplimiento',
  plantillas: 'Plantillas',
  version: 'Versión',
  activa: 'Activa',
  tipo_sujeto_obligado: 'Tipo de sujeto obligado',
  correo: 'Correo',
  rol_id: 'Rol',
  rol_asignado: 'Rol asignado',
  tipo_dato: 'Tipo de dato',
  tipo_requerimiento: 'Tipo de requerimiento',
  formatos_permitidos: 'Formatos',
  tamano_maximo_mb: 'Tamaño máx.',
};

function formatValor(v: unknown): string {
  if (Array.isArray(v)) return `${v.length} plantilla(s)`;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (v === null || v === undefined) return '—';
  return String(v);
}

function parsearCambios(detalle: string | null): string {
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    if (d.cambios) {
      return Object.entries(d.cambios)
        .map(([k, v]) => {
          const label = CAMPO_LABEL[k] ?? k;
          return `${label}: ${formatValor(v)}`;
        })
        .join(' · ');
    }
    if (d.campo && d.tipo)   return `Campo: ${d.campo} (${d.tipo})`;
    if (d.campo)             return `Campo: ${d.campo}`;
    if (d.documento && d.tipo) return `Documento: ${d.documento} (${d.tipo})`;
    if (d.documento)         return `Documento: ${d.documento}`;
    if (d.tipo)              return `Tipo: ${d.tipo}`;
    if (d.rol_asignado)      return `Rol: ${d.rol_asignado}`;
    if (d.plantillas)        return `Plantillas: ${formatValor(d.plantillas)}`;
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
                    <td style={{ fontSize: 13 }}>
                      {ACCION_LABEL[e.accion] ?? e.accion}
                    </td>
                    <td style={{ fontSize: 13 }}>{e.usuario_correo ?? <span className="small">system</span>}</td>
                    <td><span className="small">{e.rol ? (ROL_LABEL[e.rol] ?? e.rol) : '—'}</span></td>
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
