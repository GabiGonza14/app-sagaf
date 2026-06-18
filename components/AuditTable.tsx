import { db } from '@/lib/db';
import { Badge } from './Badge';
import { formatPanama } from '@/lib/date';
import { AuditFilters, type AuditFilterValues } from './AuditFilters';
import { Pagination } from './Pagination';

const PER_PAGE = 25;

interface Row {
  id: string;
  fecha_hora_servidor: string;
  usuario_correo: string | null;
  rol: string | null;
  modulo: string;
  accion: string;
  resultado: string;
  ip: string | null;
  user_agent: string | null;
  recurso_afectado: string | null;
  criticidad: string;
  detalle: string | null;
}

interface Props {
  filters: AuditFilterValues;
  modulosDisponibles?: string[];
  page?: number;
}

const ACCION_LABEL: Record<string, string> = {
  login_password_ok:   'Inicio de sesión exitoso',
  login_failed:        'Intento de inicio de sesión fallido',
  mfa_setup_iniciado:  'Configuración MFA iniciada',
  mfa_verify_ok:       'Verificación MFA exitosa',
  mfa_verify_failed:   'Verificación MFA fallida',
  crear_ros:           'Crear ROS',
  guardar_borrador:    'Guardar borrador ROS',
  verificar_identidad: 'Verificar identidad de parte',
  crear_sujeto_obligado:      'Crear sujeto obligado',
  actualizar_sujeto_obligado: 'Modificar sujeto obligado',
  desactivar_sujeto_obligado: 'Desactivar sujeto obligado',
  activar_sujeto_obligado:    'Activar sujeto obligado',
  crear_plantilla_ros:        'Crear plantilla ROS',
  actualizar_plantilla_ros:   'Modificar plantilla ROS',
  crear_usuario:              'Crear usuario',
  actualizar_usuario:         'Modificar usuario',
  desactivar_usuario:         'Desactivar usuario',
  cargar_documento:           'Cargar documento',
  generar_reporte:            'Generar reporte',
  consulta_log:               'Consulta del log de auditoría',
  seed_inicial:               'Inicialización del sistema',
};

const MODULO_LABEL: Record<string, string> = {
  autenticacion: 'Autenticación',
  ros:           'ROS',
  admin:         'Administración',
  documentos:    'Documentos',
  reportes:      'Reportes',
  vinculos:      'Vínculos',
  auditoria:     'Auditoría',
  system:        'Sistema',
};

function parsearEntidad(accion: string, recurso: string | null, detalle: string | null): string {
  if (recurso) return recurso;
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    if (d.nombre)           return d.nombre;
    if (d.correo_afectado)  return d.correo_afectado;
    if (d.nuevo_usuario_id) return d.correo ?? '—';
    return '—';
  } catch {
    return '—';
  }
}

function parsearCambios(detalle: string | null): string {
  if (!detalle) return '';
  try {
    const d = JSON.parse(detalle);
    if (d.cambios) {
      return Object.entries(d.cambios)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
    }
    if (d.tipo)         return `tipo: ${d.tipo}`;
    if (d.rol_asignado) return `rol: ${d.rol_asignado}`;
    if (d.partes !== undefined) return `partes: ${d.partes}, monto: ${d.monto}`;
  } catch { /* noop */ }
  return '';
}

const TONO_RESULTADO: Record<string, 'green' | 'red' | 'amber'> = {
  exito: 'green', fallo: 'red', bloqueado: 'amber',
};
const TONO_CRITICIDAD: Record<string, 'gray' | 'amber' | 'red'> = {
  normal: 'gray', alta: 'amber', critica: 'red',
};
const TONO_MODULO: Record<string, 'blue' | 'teal' | 'amber' | 'red' | 'gray' | 'green'> = {
  autenticacion: 'blue',
  ros:           'teal',
  admin:         'amber',
  documentos:    'gray',
  auditoria:     'green',
  system:        'gray',
};

export function AuditTable({ filters, modulosDisponibles, page = 1 }: Readonly<Props>) {
  const currentPage = Math.max(1, page);
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    where.push('(usuario_correo LIKE ? OR accion LIKE ? OR recurso_afectado LIKE ? OR detalle LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.modulo)     { where.push('modulo = ?');      params.push(filters.modulo); }
  if (filters.rol)        { where.push('rol = ?');         params.push(filters.rol); }
  if (filters.resultado)  { where.push('resultado = ?');   params.push(filters.resultado); }
  if (filters.criticidad) { where.push('criticidad = ?');  params.push(filters.criticidad); }
  if (filters.desde)      { where.push('fecha_hora_servidor >= ?'); params.push(filters.desde); }
  if (filters.hasta)      { where.push('fecha_hora_servidor <= ?'); params.push(filters.hasta + ' 23:59:59'); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = db.prepare<unknown[], { c: number }>(
    `SELECT COUNT(*) AS c FROM evento_auditoria ${whereClause}`,
  ).get(...params);
  const total = totalRow?.c ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  const rows = db.prepare<unknown[], Row>(
    `SELECT id, fecha_hora_servidor, usuario_correo, rol, modulo, accion, resultado, ip, user_agent, recurso_afectado, criticidad, detalle
       FROM evento_auditoria
       ${whereClause}
      ORDER BY fecha_hora_servidor DESC
      LIMIT ? OFFSET ?`,
  ).all(...params, PER_PAGE, (currentPage - 1) * PER_PAGE);

  const inicio = total === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const fin = Math.min(currentPage * PER_PAGE, total);

  const filterParams: Record<string, string> = {};
  if (filters.q)          filterParams.q = filters.q;
  if (filters.modulo)     filterParams.modulo = filters.modulo;
  if (filters.rol)        filterParams.rol = filters.rol;
  if (filters.resultado)  filterParams.resultado = filters.resultado;
  if (filters.criticidad) filterParams.criticidad = filters.criticidad;
  if (filters.desde)      filterParams.desde = filters.desde;
  if (filters.hasta)      filterParams.hasta = filters.hasta;

  return (
    <>
      <AuditFilters initial={filters} modulosDisponibles={modulosDisponibles} />

      {rows.length === 0 ? (
        <div className="notice">Sin eventos para los filtros seleccionados.</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Módulo</th>
                <th style={{ minWidth: 180 }}>Acción</th>
                <th style={{ whiteSpace: 'nowrap' }}>Entidad / Recurso</th>
                <th>Cambios</th>
                <th>Resultado</th>
                <th>Criticidad</th>
                <th>IP</th>
                <th>Dispositivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cambios = parsearCambios(r.detalle);
                const entidad = parsearEntidad(r.accion, r.recurso_afectado, r.detalle);
                const uaSuffix = r.user_agent && r.user_agent.length > 40 ? '…' : '';
                const uaLabel = r.user_agent ? r.user_agent.slice(0, 40) + uaSuffix : '—';
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {formatPanama(r.fecha_hora_servidor)}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.usuario_correo
                        ? r.usuario_correo
                        : <span className="small" style={{ color: 'var(--muted)' }}>sistema</span>}
                    </td>
                    <td><span className="small">{r.rol ?? '—'}</span></td>
                    <td>
                      <Badge tone={TONO_MODULO[r.modulo] ?? 'gray'}>
                        {MODULO_LABEL[r.modulo] ?? r.modulo}
                      </Badge>
                    </td>
                    <td>
                      <strong style={{ fontSize: 13 }}>
                        {ACCION_LABEL[r.accion] ?? r.accion}
                      </strong>
                    </td>
                    <td style={{ fontSize: 13 }}>{entidad}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{cambios || '—'}</td>
                    <td>
                      <Badge tone={TONO_RESULTADO[r.resultado] ?? 'gray'}>{r.resultado}</Badge>
                    </td>
                    <td>
                      <Badge tone={TONO_CRITICIDAD[r.criticidad] ?? 'gray'}>{r.criticidad}</Badge>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.ip ?? '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={r.user_agent ?? undefined}>
                      {uaLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/auditor"
        params={filterParams}
      />
    </>
  );
}
