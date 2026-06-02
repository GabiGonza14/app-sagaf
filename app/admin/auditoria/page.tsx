import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { ShieldCheck } from 'lucide-react';

export const revalidate = 0;

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
  crear_sujeto_obligado:    'Crear sujeto obligado',
  actualizar_sujeto_obligado: 'Modificar sujeto obligado',
  crear_plantilla_ros:      'Crear plantilla ROS',
  crear_usuario:            'Crear usuario',
  actualizar_usuario:       'Modificar usuario',
};

const ACCION_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'gray'> = {
  crear_sujeto_obligado:      'green',
  actualizar_sujeto_obligado: 'blue',
  crear_plantilla_ros:        'green',
  crear_usuario:              'green',
  actualizar_usuario:         'blue',
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

export default async function AdminAuditoria() {
  const eventos = db.prepare<[], EventRow>(`
    SELECT id, fecha_hora_servidor, usuario_correo, rol, accion, resultado, detalle, ip
      FROM evento_auditoria
     WHERE modulo = 'admin'
     ORDER BY fecha_hora_servidor DESC
     LIMIT 300
  `).all();

  const totales = {
    total: eventos.length,
    sujetos: eventos.filter((e) => e.accion.includes('sujeto')).length,
    plantillas: eventos.filter((e) => e.accion.includes('plantilla')).length,
    usuarios: eventos.filter((e) => e.accion.includes('usuario')).length,
    fallos: eventos.filter((e) => e.resultado === 'fallo').length,
  };

  return (
    <>
      <TopBar
        eyebrow="Administración SAGAF"
        title="Registro de auditoría"
        description="Historial completo de todas las creaciones, modificaciones y desactivaciones realizadas por administradores (RE-03). Solo lectura."
      />

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Eventos totales',       value: totales.total,      tone: 'blue'  },
          { label: 'Sujetos obligados',      value: totales.sujetos,    tone: 'teal'  },
          { label: 'Plantillas ROS',         value: totales.plantillas, tone: 'green' },
          { label: 'Usuarios',               value: totales.usuarios,   tone: 'blue'  },
          { label: 'Con fallo',              value: totales.fallos,     tone: 'red'   },
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
          <strong>RE-03 — CU-06:</strong> Toda creación, modificación o desactivación queda registrada automáticamente con usuario, rol, entidad afectada, cambios realizados, fecha del servidor e IP. Este log no puede modificarse.
        </span>
      </div>

      <div className="card">
        <div className="panel-head" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Acciones administrativas</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Mostrando los 300 eventos más recientes del módulo admin
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
    </>
  );
}
